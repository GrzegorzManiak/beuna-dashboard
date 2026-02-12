import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import {
    DEFAULT_DOCUMENT_NAME,
    DEFAULT_PROPERTY_NAME,
} from "./properties.service";

async function createPropertyHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

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
                managerId: user.id,
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

export { createPropertyHandler };
