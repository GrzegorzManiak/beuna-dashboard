import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";

type SectionType =
    | "core.property_overview"
    | "core.address"
    | "core.building"
    | "units.unit_block"
    | "weg.special_rights"
    | "weg.mea_declaration"
    | "weg.property_manager"
    | "weg.accountant"
    | "mv.owner_entity"
    | "unknown";

type SectionClassification = {
    sectionId: string;
    sectionType: SectionType;
    confidence: number;
};

type SectionClassificationResult = {
    classifications: SectionClassification[];
    warnings: string[];
};

const SECTION_TYPE_DESCRIPTIONS: Record<SectionType, string> = {
    "core.property_overview": "High-level property identity, name, or overview of the asset.",
    "core.address": "Primary property address lines.",
    "core.building": "Building description block, includes building name or address.",
    "units.unit_block": "Unit block descriptions or lists of units (apartments, parking, etc.).",
    "weg.special_rights": "Special usage rights (Sondernutzungsrechte) sections.",
    "weg.mea_declaration": "MEA declaration (Miteigentumsanteile) - total co-ownership shares.",
    "weg.property_manager": "Property manager appointment details (Verwalter), including combined Verwaltung/Buchhaltung appointment sections such as 'Erstbestellung von Verwaltung und Buchhaltung'.",
    "weg.accountant": "Accountant or finance appointment details (Buchhaltung/Abrechnung).",
    "mv.owner_entity": "Owner or landlord entity information.",
    "unknown": "Does not match any known type.",
};

const SECTION_TYPES: SectionType[] = Object.keys(SECTION_TYPE_DESCRIPTIONS) as SectionType[];

const CLASSIFY_TOOL: JsonToolSchema = {
    name: "classify_pdf_section",
    description: "Classify a single PDF section into a predefined section type.",
    outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            sectionType: { type: "string", enum: SECTION_TYPES },
            confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["sectionType", "confidence"],
    },
};

const buildMessages = (section: PdfSection): LlmMessage[] => {
    const typeHints = SECTION_TYPES.map((type) => `${type}: ${SECTION_TYPE_DESCRIPTIONS[type]}`).join("\n");
    return [
        {
            role: "system",
            content: [
                "You are classifying PDF sections into a fixed set of section types.",
                "Choose the single best sectionType from the list.",
                "Return JSON that matches the schema.",
                "Use unknown when unsure.",
                "If a section mentions both Verwaltung/Verwalter and Buchhaltung/Abrechnung, choose weg.property_manager.",
                "Section types:",
                typeHints,
            ].join("\n"),
        },
        {
            role: "user",
            content: JSON.stringify({
                sectionId: section.id,
                heading: section.heading.text,
                text: section.rawText,
            }),
        },
    ];
};

const runPool = async <T>(tasks: Array<() => Promise<T>>, concurrency: number) => {
    const results: T[] = new Array(tasks.length);
    let index = 0;
    const runnerCount = Math.max(1, Math.min(concurrency, tasks.length));

    const runners = Array.from({ length: runnerCount }, async () => {
        while (true) {
            const current = index;
            index += 1;
            if (current >= tasks.length) break;
            const task = tasks[current];
            if (!task) break;
            results[current] = await task();
        }
    });

    await Promise.all(runners);
    return results;
};

const coerceSectionType = (value: unknown): SectionType => {
    if (typeof value !== "string") return "unknown";
    return SECTION_TYPES.includes(value as SectionType) ? (value as SectionType) : "unknown";
};

const coerceConfidence = (value: unknown) => {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 1) return 1;
    return num;
};

async function classifySections(
    sections: PdfSection[],
    concurrency = 10,
): Promise<SectionClassificationResult> {
    if (!sections.length) return { classifications: [], warnings: [] };

    const tasks = sections.map((section) => async () => {
        try {
            const result = await runJsonTool<{ sectionType?: unknown; confidence?: unknown }>({
                tool: CLASSIFY_TOOL,
                messages: buildMessages(section),
            });

            const sectionType = coerceSectionType(result.parsed?.sectionType);
            const confidence = coerceConfidence(result.parsed?.confidence);

            return {
                sectionId: section.id,
                sectionType,
                confidence,
                warning: result.parsed ? null : `LLM response missing for ${section.id}.`,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                sectionId: section.id,
                sectionType: "unknown" as SectionType,
                confidence: 0,
                warning: `LLM classification failed for ${section.id}: ${message}`,
            };
        }
    });

    const results = await runPool(tasks, concurrency);
    const warnings: string[] = [];
    const classifications = results.map((result) => {
        if (result.warning) warnings.push(result.warning);
        return {
            sectionId: result.sectionId,
            sectionType: result.sectionType,
            confidence: result.confidence,
        };
    });

    return { classifications, warnings };
}

export {
    classifySections,
    type SectionType,
    type SectionClassification,
    type SectionClassificationResult,
};
