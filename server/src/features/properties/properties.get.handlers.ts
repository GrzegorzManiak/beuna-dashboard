import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { prisma } from "@db";
import type {
    PropertyIdParams,
    PropertySectionsStreamQuery,
} from "./properties";
import {
    PDF_CACHE_TTL_MS,
    getPropertyDocument,
    getStoredSections,
    getBasicDetailsExtract,
    startSectionTask,
} from "./properties.service";

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

    // Check if the property actually has a document before starting extraction.
    // Seeded or manually-created properties may not have one.
    const propertyDoc = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { documentData: true },
    });
    if (!propertyDoc?.documentData) {
        sendSocketPayload(socket, { error: "no_document" });
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
        const message = error instanceof Error ? error.message : `Section processing failed: ${String(error)}`;
        req.log.error(
            { err: error, propertyId, sessionId, message },
            "Property section stream task failed",
        );
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

export {
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsHandler,
    getPropertySectionsStreamHandler,
};
