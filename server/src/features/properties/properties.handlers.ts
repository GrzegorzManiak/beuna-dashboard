import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { prisma } from "@db";
import { classifySection } from "../../lib/pdf-extraction/processors/classifier";
import type {
    UpdatePropertyBody,
    PropertyIdParams,
    PropertySectionsStreamQuery,
} from "./properties";
import {
    DEFAULT_DOCUMENT_NAME,
    DEFAULT_PROPERTY_NAME,
    PDF_CACHE_TTL_MS,
    getPropertyDocument,
    getStoredSections,
    getBasicDetailsExtract,
    startSectionTask,
} from "./properties.service";
async function listPropertiesHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const properties = await prisma.property.findMany({
        where: {
            OR: [
                { managerId: user.id },
                { accountantId: user.id },
            ],
        },
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
        },
        orderBy: { propertyNumber: "asc" },
    });

    const result = properties.map((p) => ({
        id: p.id,
        propertyNumber: p.propertyNumber,
        name: p.name,
        managementType: p.managementType,
        status: p.status,
        relation: p.managerId === user.id ? "MANAGER" : "ACCOUNTANT",
    }));

    return reply.send({ properties: result });
}

async function createPropertyHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    if (!req.isMultipart()) return reply.code(400).send({ error: "Multipart form data is required" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "PDF file is required" });
    if (file.mimetype !== "application/pdf") return reply.code(400).send({ error: "Only PDF files are supported" });

    const buffer = await file.toBuffer();
    if (buffer.length === 0) return reply.code(400).send({ error: "PDF file is empty" });

    const trimmedName = file.filename?.trim();
    const documentName = trimmedName ? trimmedName : DEFAULT_DOCUMENT_NAME;

    const property = await prisma.$transaction(async (tx) => {
        const counter = await tx.propertyCounter.upsert({
            where: { id: 1 },
            update: { current: { increment: 1 } },
            create: { id: 1, current: 1 },
            select: { current: true },
        });

        return tx.property.create({
            data: {
                propertyNumber: counter.current,
                name: DEFAULT_PROPERTY_NAME,
                managementType: "UNKNOWN",
                status: "DRAFT",
                documentName,
                documentMimeType: file.mimetype,
                documentData: buffer,
                documentUploadedAt: new Date(),
            },
            select: {
                id: true,
                propertyNumber: true,
                name: true,
                managementType: true,
                status: true,
                managerId: true,
                accountantId: true,
                addressStreet: true,
                addressPostalCode: true,
                addressCity: true,
            },
        });
    });

    return reply.code(201).send({ property });
}

async function getPropertyDocumentHandler(
    req: FastifyRequest<{ Params: PropertyIdParams }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;

    const document = await getPropertyDocument(propertyId);
    if (!document) return reply.code(404).send({ error: "Property document not found" });

    reply.header("Content-Type", document.mimeType);
    reply.header("Content-Disposition", `inline; filename="${document.name}"`);
    reply.header("Cache-Control", `private, max-age=${Math.floor(PDF_CACHE_TTL_MS / 1000)}`);
    return reply.send(document.data);
}

async function getPropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
            addressStreet: true,
            addressPostalCode: true,
            addressCity: true,
        },
    });

    if (!property) return reply.code(404)
        .send({ error: "Property not found" });

    return reply.send({ property });
}

const sendSocketPayload = (
    socket: WebSocket,
    payload: Record<string, unknown>,
) => {
    if (socket.readyState !== socket.OPEN) {
        return;
    }
    const jsonStr = JSON.stringify(payload);
    socket.send(jsonStr);
};

async function getPropertySectionsStreamHandler(
    socket: WebSocket,
    req: FastifyRequest<{ Params: PropertyIdParams; Querystring: PropertySectionsStreamQuery }>
) {
    const { propertyId } = req.params;
    const sessionId = req.query?.sessionId?.trim();

    if (!sessionId) {
        sendSocketPayload(socket, { error: "Missing sessionId." });
        socket.close();
        return;
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true },
    });

    if (!session) {
        sendSocketPayload(socket, { error: "Invalid session." });
        socket.close();
        return;
    }

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });

    if (!property) {
        sendSocketPayload(socket, { error: "Property not found." });
        socket.close();
        return;
    }

    
    // Track accumulated sections for streaming updates
    const accumulatedSections: any[] = [];
    let latestBasicDetails: any = null;
    let basicDetailsResolved = false;
    
    try {
        await startSectionTask(propertyId, {
            awaitBasicDetails: true, // WAIT for basic details to complete
            onBasicDetailsUpdated: (basicDetails) => {
                latestBasicDetails = basicDetails;
                basicDetailsResolved = true;
                sendSocketPayload(socket, { 
                    status: "update", 
                    basicDetails,
                    sections: accumulatedSections.filter(s => s.renderable !== false),
                });
            },
            onSectionProcessed: (section, index, total) => {
                
                const sectionIndex = (section as any)._sectionIndex ?? index;
                const sectionData = {
                    id: `temp-${index}`,
                    sectionIndex,
                    headingText: section.headingText,
                    rawText: section.rawText,
                    textPosition: section.textPosition,
                    sectionType: section.sectionType,
                    confidence: section.confidence,
                    renderable: section.renderable !== false,
                    items: section.items || undefined,
                };
                
                accumulatedSections.push(sectionData);
                
                // Send update with all sections so far
                sendSocketPayload(socket, { 
                    status: "update", 
                    sections: accumulatedSections.filter(s => s.renderable !== false),
                    basicDetails: latestBasicDetails,
                });
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Section processing failed.";
        sendSocketPayload(socket, { error: message });
        socket.close();
        return;
    }

    // Always send the final "complete" payload from this handler's socket,
    // even if this handler joined an already-running task (e.g. due to React
    // Strict Mode double-mount creating two WebSocket connections).
    const sections = await getStoredSections(propertyId);
    const basicDetails = await getBasicDetailsExtract(propertyId);
    sendSocketPayload(socket, { status: "complete", sections, basicDetails });
    socket.close();
}

async function updatePropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Body: UpdatePropertyBody }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;
    const {
        name,
        managementType,
        addressStreet,
        addressPostalCode,
        addressCity,
        managerId,
        accountantId,
        status,
    } = req.body;

    const data: UpdatePropertyBody = {
        name,
        managementType,
        addressStreet,
        addressPostalCode,
        addressCity,
        managerId,
        accountantId,
        status,
    };

    const hasUpdates = Object.values(data)
        .some((value) => value !== undefined);

    if (!hasUpdates) return reply.code(400)
        .send({ error: "No fields to update" });

    const existing = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });

    if (!existing) return reply.code(404)
        .send({ error: "Property not found" });

    const property = await prisma.property.update({
        where: { id: propertyId },
        data,
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
            addressStreet: true,
            addressPostalCode: true,
            addressCity: true,
        },
    });

    return reply.send({ property });
}

type ClassifySectionBody = {
    text: string;
    heading?: string;
};

type ClassifySectionParams = PropertyIdParams;

async function classifySectionHandler(
    req: FastifyRequest<{ Params: ClassifySectionParams; Body: ClassifySectionBody }>,
    reply: FastifyReply
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId } = req.params;
    const { text, heading } = req.body;

    if (!text || typeof text !== "string") {
        return reply.code(400).send({ error: "text is required and must be a string" });
    }

    // Verify user has access to this property
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });

    if (!property) {
        return reply.code(404).send({ error: "Property not found" });
    }

    try {
        const mockSection = {
            id: `user-selection-${Date.now()}`,
            heading: { text: heading || text.slice(0, 50) } as any,
            lines: [] as any[],
            rawText: text,
            textPosition: [] as any[],
        };

        const result = await classifySection(mockSection);

        return reply.send({
            sectionType: result.processor.sectionType,
            confidence: result.confidence,
        });
    } catch (error) {
        console.error("Error classifying section:", error);
        return reply.code(500).send({
            error: "Classification failed",
            sectionType: "unknown",
            confidence: 0,
        });
    }
}

export {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsStreamHandler,
    updatePropertyHandler,
    classifySectionHandler,
};
