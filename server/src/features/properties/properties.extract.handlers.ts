import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import { classifySectionWithLlm } from "../../lib/pdf-extraction/llm/classify-sections";
import { extractSectionFields } from "../../lib/pdf-extraction/llm/extract-section-fields";
import type { SectionType } from "@shared/section-types";
import type { PropertyIdParams } from "./properties";

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

    if (!rawText || typeof rawText !== "string") 
        return reply.code(400).send({ error: "rawText is required." });
    
    if (!sectionType || typeof sectionType !== "string") 
        return reply.code(400).send({ error: "sectionType is required." });
    
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) return reply.code(404).send({ error: "Property not found." });
    
    try {
        const result = await extractSectionFields(rawText, sectionType as SectionType, buildings);
        if (!result) return reply.send({ sectionId, fields: {} });
        

        const fields: Record<string, string | number | boolean | null> = {};
        for (const f of result.fields) fields[f.key] = f.value;
    
        console.log(`[extract] ${sectionType} ${sectionId} →`, JSON.stringify(fields));
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (UUID_RE.test(sectionId)) try {
            await prisma.propertySection.updateMany({
                where: { id: sectionId, propertyId },
                data: { fields: fields as any, state: "needs_review" }
            });
        } 
        
        catch (persistErr) {
            console.error(`[extract] Failed to persist fields for ${sectionId}:`, persistErr);
        }
        
        return reply.send({
            sectionId,
            fields,
            elapsedMs: result.elapsedMs,
        });
    } 
    
    catch (error) {
        const message = error instanceof Error ? error.message : "Extraction failed";
        return reply.code(500).send({ error: message });
    }
}

export {
    classifySectionHandler,
    extractSectionFieldsHandler,
};
