import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { prisma } from "@db";
import type {
    UpdatePropertyBody,
    PropertyIdParams,
    PropertySectionsQuery,
    PropertySectionsStreamQuery,
} from "./properties";
import { createExpiringCache } from "../../lib/expiring-cache";
import { extractSectionsFromBuffer, classifySections } from "../../lib/pdf-extraction";

type DocumentCacheEntry = {
    data: Buffer;
    mimeType: string;
    name: string;
};

const PDF_CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PROPERTY_NAME = "Unnamed property";
const DEFAULT_DOCUMENT_NAME = "property.pdf";
const SECTION_POLL_INTERVAL_MS = 1_000;
const SECTION_POLL_MAX_WAIT_MS = 25_000;

const documentCache = createExpiringCache<DocumentCacheEntry>(PDF_CACHE_TTL_MS);
const sectionTasks = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const getStoredSections = async (propertyId: string) => {
    return prisma.propertySection.findMany({
        where: { propertyId },
        orderBy: { sectionIndex: "asc" },
        select: {
            id: true,
            sectionIndex: true,
            headingText: true,
            rawText: true,
            textPosition: true,
            sectionType: true,
            confidence: true,
        },
    });
};

const startSectionTask = (propertyId: string) => {
    const existing = sectionTasks.get(propertyId);
    if (existing) return existing;

    const task = (async () => {
        const existingCount = await prisma.propertySection.count({ where: { propertyId } });
        if (existingCount > 0) return;

        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
                documentData: true,
            },
        });

        if (!property?.documentData) throw new Error("Property document not found");

        const sectionsResult = await extractSectionsFromBuffer(Buffer.from(property.documentData));
        const classification = await classifySections(sectionsResult.sections, 10);
        const classificationMap = new Map(
            classification.classifications.map((entry) => [entry.sectionId, entry]),
        );

        const rows = sectionsResult.sections.map((section, index) => {
            const classified = classificationMap.get(section.id);
            return {
                propertyId,
                sectionIndex: index,
                headingText: section.heading.text,
                rawText: section.rawText,
                textPosition: section.textPosition,
                sectionType: classified?.sectionType ?? "unknown",
                confidence: classified?.confidence ?? 0,
            };
        });

        if (!rows.length) return;

        await prisma.propertySection.createMany({
            data: rows,
            skipDuplicates: true,
        });
    })().finally(() => {
        sectionTasks.delete(propertyId);
    });

    sectionTasks.set(propertyId, task);
    return task;
};

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

    const cached = documentCache.get(propertyId);
    if (cached) {
        reply.header("Content-Type", cached.mimeType);
        reply.header("Content-Disposition", `inline; filename="${cached.name}"`);
        reply.header("Cache-Control", `private, max-age=${Math.floor(PDF_CACHE_TTL_MS / 1000)}`);
        return reply.send(cached.data);
    }

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            documentName: true,
            documentMimeType: true,
            documentData: true,
        },
    });

    if (!property?.documentData) return reply.code(404).send({ error: "Property document not found" });

    const documentName = property.documentName ?? DEFAULT_DOCUMENT_NAME;
    const mimeType = property.documentMimeType ?? "application/pdf";

    documentCache.set(propertyId, {
        data: Buffer.from(property.documentData),
        mimeType,
        name: documentName,
    });

    reply.header("Content-Type", mimeType);
    reply.header("Content-Disposition", `inline; filename="${documentName}"`);
    reply.header("Cache-Control", `private, max-age=${Math.floor(PDF_CACHE_TTL_MS / 1000)}`);
    return reply.send(property.documentData);
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
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(payload));
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

    const existing = await getStoredSections(propertyId);
    if (existing.length) {
        sendSocketPayload(socket, { status: "ready", sections: existing });
        socket.close();
        return;
    }

    try {
        await startSectionTask(propertyId);
        const sections = await getStoredSections(propertyId);
        sendSocketPayload(socket, { status: "ready", sections });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Section processing failed.";
        sendSocketPayload(socket, { error: message });
    } finally {
        socket.close();
    }
}

async function getPropertySectionsHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Querystring: PropertySectionsQuery }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;
    const waitMsRaw = req.query?.waitMs;
    const waitMs = Number.isFinite(waitMsRaw)
        ? Math.min(Math.max(waitMsRaw ?? 0, 0), SECTION_POLL_MAX_WAIT_MS)
        : 0;
    const deadline = waitMs ? Date.now() + waitMs : 0;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });

    if (!property) return reply.code(404).send({ error: "Property not found" });

    let started = false;
    while (true) {
        const sections = await getStoredSections(propertyId);
        if (sections.length) {
            return reply.send({
                status: "ready",
                sections,
            });
        }

        if (!started) {
            started = true;
            startSectionTask(propertyId).catch(() => null);
        }

        if (!waitMs || Date.now() >= deadline) {
            return reply.send({
                status: "pending",
                sections: [],
            });
        }

        await sleep(SECTION_POLL_INTERVAL_MS);
    }
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

export {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsStreamHandler,
    getPropertySectionsHandler,
    updatePropertyHandler,
};
