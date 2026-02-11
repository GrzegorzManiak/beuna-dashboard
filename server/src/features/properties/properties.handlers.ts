import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { prisma } from "@db";
import { classifySectionWithLlm } from "../../lib/pdf-extraction/llm/classify-sections";
import { extractSectionFields } from "../../lib/pdf-extraction/llm/extract-section-fields";
import type { SectionType } from "@shared/section-types";
import type {
    UpdatePropertyBody,
    PropertyIdParams,
    PropertySectionsStreamQuery,
    SectionIdParams,
    CreateSectionBody,
    UpdateSectionBody,
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

    const propertyIds = properties.map((property) => property.id);
    const sections = propertyIds.length > 0
        ? await prisma.propertySection.findMany({
            where: {
                propertyId: { in: propertyIds },
                sectionType: "core.building",
            },
            select: {
                propertyId: true,
                items: true,
            },
        })
        : [];

    const buildingCountByPropertyId = new Map<string, number>();
    for (const section of sections) {
        const countForSection = Array.isArray(section.items) && section.items.length > 0
            ? section.items.length
            : 1;
        const previous = buildingCountByPropertyId.get(section.propertyId) ?? 0;
        buildingCountByPropertyId.set(section.propertyId, previous + countForSection);
    }

    const result = properties.map((p) => ({
        id: p.id,
        propertyNumber: p.propertyNumber,
        name: p.name,
        managementType: p.managementType,
        status: p.status,
        relation: p.managerId === user.id ? "MANAGER" : "ACCOUNTANT",
        buildingCount: buildingCountByPropertyId.get(p.id) ?? 0,
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

async function getPropertySectionsHandler(
    req: FastifyRequest<{ Params: PropertyIdParams }>,
    reply: FastifyReply
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });
    if (!property) return reply.code(404).send({ error: "Property not found" });

    const sections = await getStoredSections(propertyId);
    return reply.send({ sections });
}

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

    // If sections have already been processed and stored, just return them
    // immediately. No need to re-extract, re-classify, or re-process anything.
    const storedSections = await getStoredSections(propertyId);
    if (storedSections.length > 0) {
        const basicDetails = await getBasicDetailsExtract(propertyId);
        sendSocketPayload(socket, { status: "ready", sections: storedSections, basicDetails });
        sendSocketPayload(socket, { status: "complete", sections: storedSections, basicDetails });
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
                    id: section.id ?? `temp-${index}`,
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
        const result = await classifySectionWithLlm(text, heading || text.slice(0, 100));

        return reply.send({
            sectionType: result.sectionType,
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

type ExtractSectionFieldsParams = {
    propertyId: string;
    sectionId: string;
};

type ExtractSectionFieldsBody = {
    rawText: string;
    sectionType: SectionType;
    buildings?: Array<{ uuid: string; name: string }>;
};

async function extractSectionFieldsHandler(
    req: FastifyRequest<{ Params: ExtractSectionFieldsParams; Body: ExtractSectionFieldsBody }>,
    reply: FastifyReply,
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId, sectionId } = req.params;
    const { rawText, sectionType, buildings } = req.body;

    if (!rawText || typeof rawText !== "string") {
        return reply.code(400).send({ error: "rawText is required." });
    }
    if (!sectionType || typeof sectionType !== "string") {
        return reply.code(400).send({ error: "sectionType is required." });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });
    if (!property) {
        return reply.code(404).send({ error: "Property not found." });
    }

    try {
        const result = await extractSectionFields(rawText, sectionType as SectionType, buildings);

        if (!result) {
            return reply.send({ sectionId, fields: {} });
        }

        // Convert field array to a flat key→value map so the client can
        // spread it directly into SectionData.fields.
        const fields: Record<string, string | number | boolean | null> = {};
        for (const f of result.fields) {
            fields[f.key] = f.value;
        }

        console.log(`[extract] ${sectionType} ${sectionId} →`, JSON.stringify(fields));

        // Persist extraction result to the database so it won't be re-extracted.
        // Only attempt for real DB UUIDs — item-expanded IDs (e.g. "unit-10-...")
        // are client-only and don't exist in the PropertySection table.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (UUID_RE.test(sectionId)) {
            try {
                await prisma.propertySection.updateMany({
                    where: { id: sectionId, propertyId },
                    data: {
                        fields: fields as any,
                        state: "needs_review",
                    },
                });
            } catch (persistErr) {
                // Non-critical — the client will also try to persist
                console.error(`[extract] Failed to persist fields for ${sectionId}:`, persistErr);
            }
        }

        return reply.send({
            sectionId,
            fields,
            elapsedMs: result.elapsedMs,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Extraction failed";
        return reply.code(500).send({ error: message });
    }
}

async function createPropertySectionHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Body: CreateSectionBody }>,
    reply: FastifyReply,
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId } = req.params;
    const { headingText, rawText, textPosition, sectionType, confidence, state, fields } = req.body;

    if (!textPosition) {
        return reply.code(400).send({ error: "textPosition is required." });
    }

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });
    if (!property) return reply.code(404).send({ error: "Property not found." });

    // Determine next sectionIndex
    const maxIndex = await prisma.propertySection.aggregate({
        where: { propertyId },
        _max: { sectionIndex: true },
    });
    const nextIndex = (maxIndex._max.sectionIndex ?? -1) + 1;

    const section = await prisma.propertySection.create({
        data: {
            propertyId,
            sectionIndex: nextIndex,
            headingText: headingText ?? "",
            rawText: rawText ?? "",
            textPosition: textPosition as any,
            sectionType: sectionType ?? "unknown",
            confidence: confidence ?? 0,
            state: state ?? null,
            fields: fields ? (fields as any) : undefined,
        },
        select: {
            id: true,
            sectionIndex: true,
            headingText: true,
            rawText: true,
            textPosition: true,
            sectionType: true,
            confidence: true,
            renderable: true,
            state: true,
            fields: true,
            items: true,
        },
    });

    return reply.code(201).send({ section });
}

async function updatePropertySectionHandler(
    req: FastifyRequest<{ Params: SectionIdParams; Body: UpdateSectionBody }>,
    reply: FastifyReply,
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId, sectionId } = req.params;
    const { sectionType, confidence, state, fields, rawText, headingText, items } = req.body;

    const existing = await prisma.propertySection.findFirst({
        where: { id: sectionId, propertyId },
        select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "Section not found." });

    const data: Record<string, unknown> = {};
    if (sectionType !== undefined) data.sectionType = sectionType;
    if (confidence !== undefined) data.confidence = confidence;
    if (state !== undefined) data.state = state;
    if (fields !== undefined) data.fields = fields;
    if (rawText !== undefined) data.rawText = rawText;
    if (headingText !== undefined) data.headingText = headingText;
    if (items !== undefined) data.items = items;

    if (!Object.keys(data).length) {
        return reply.code(400).send({ error: "No fields to update." });
    }

    const section = await prisma.propertySection.update({
        where: { id: sectionId },
        data,
        select: {
            id: true,
            sectionIndex: true,
            headingText: true,
            rawText: true,
            textPosition: true,
            sectionType: true,
            confidence: true,
            renderable: true,
            state: true,
            fields: true,
            items: true,
        },
    });

    return reply.send({ section });
}

async function deletePropertySectionHandler(
    req: FastifyRequest<{ Params: SectionIdParams }>,
    reply: FastifyReply,
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId, sectionId } = req.params;

    const existing = await prisma.propertySection.findFirst({
        where: { id: sectionId, propertyId },
        select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "Section not found." });

    await prisma.propertySection.delete({ where: { id: sectionId } });

    return reply.code(204).send();
}

export {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsHandler,
    getPropertySectionsStreamHandler,
    updatePropertyHandler,
    classifySectionHandler,
    extractSectionFieldsHandler,
    createPropertySectionHandler,
    updatePropertySectionHandler,
    deletePropertySectionHandler,
};
