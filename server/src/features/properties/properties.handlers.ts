import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type {
    UpdatePropertyBody,
    PropertyIdParams,
} from "./properties";
import { createExpiringCache } from "../../lib/expiring-cache";

type DocumentCacheEntry = {
    data: Buffer;
    mimeType: string;
    name: string;
};

const PDF_CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PROPERTY_NAME = "Unnamed property";
const DEFAULT_DOCUMENT_NAME = "property.pdf";

const documentCache = createExpiringCache<DocumentCacheEntry>(PDF_CACHE_TTL_MS);

async function listPropertiesHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const user = req.user!;

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

    const user = req.user!;
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
                managerId: user.id,
                accountantId: user.id,
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
        data: property.documentData,
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
        },
    });

    if (!property) return reply.code(404)
        .send({ error: "Property not found" });

    return reply.send({ property });
}

async function updatePropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Body: UpdatePropertyBody }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;
    const { name, managementType, managerId, accountantId, status } = req.body;

    const data: UpdatePropertyBody = {
        name,
        managementType,
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
        },
    });

    return reply.send({ property });
}

export {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyDocumentHandler,
    getPropertyHandler,
    updatePropertyHandler,
};
