import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type {
    PropertyIdParams,
    SectionIdParams,
    CreateSectionBody,
    UpdateSectionBody,
} from "./properties";

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
    createPropertySectionHandler,
    updatePropertySectionHandler,
    deletePropertySectionHandler,
};
