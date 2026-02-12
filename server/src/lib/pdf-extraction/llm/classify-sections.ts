import { runJsonTool, type JsonToolResult, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";
import type { SectionType } from "@shared/section-types";

type SectionClassification = {
    sectionId: string;
    sectionType: SectionType;
    confidence: number;
};

type SectionClassificationResult = {
    classifications: SectionClassification[];
    warnings: string[];
};

type RunJsonToolFn = <T>(args: {
    tool: JsonToolSchema;
    messages: LlmMessage[];
    model?: string;
    timeoutMs?: number;
}) => Promise<JsonToolResult<T>>;

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
                "IMPORTANT: weg.mea_declaration requires an EXPLICIT mention of 'MEA', 'Miteigentumsanteile', or 'Miteigentumsanteil'. Area measurements like m², qm, or Quadratmeter are NOT MEA declarations. Numbers followed by 'm' or 'm²' are square-metre figures, not co-ownership shares.",
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

const normalizeForRules = (value: string): string => {
    return value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
};

const UNIT_FIELD_SIGNALS = [
    "nutzungstyp",
    "gebaudezugehorigkeit",
    "lage",
    "grosse",
    "wohnflache",
    "zimmer",
    "baujahr",
    "beschreibung",
    "aufteilungsplan",
    "sondereigentum",
];

const PROPERTY_OVERVIEW_SIGNALS = [
    "grundbuchstand",
    "eigentumsverhaltnisse",
    "grundbuch",
    "alleineigentumer",
    "teilungserklarung",
    "objektnummer",
    "objektname",
    "verwaltungstyp",
];

type RuleClassification = {
    sectionType: SectionType;
    confidence: number;
};

const countKeywordHits = (text: string, keywords: string[]): number => {
    return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
};

const looksLikeUnitBlockSnippet = (text: string): boolean => {
    const normalized = normalizeForRules(text);
    if (!normalized) return false;

    const hasUnitAnchor = /\beinheit(?:en)?\s*(?:nr|nummer)?\s*\.?\s*\d{1,3}\b/.test(normalized);
    if (!hasUnitAnchor) return false;

    const signalHits = countKeywordHits(normalized, UNIT_FIELD_SIGNALS);
    const hasUnitFraction = /\b\d{1,4}(?:[.,]\d+)?\s*\/\s*1[.\s]?000\b/.test(normalized);

    return signalHits >= 1 || hasUnitFraction;
};

const hasExplicitMeaDeclaration = (text: string): boolean => {
    const normalized = normalizeForRules(text);
    if (!normalized) return false;
    if (!normalized.includes("eigentum am grundstuck")) return false;
    if (!normalized.includes("zerlegt") && !normalized.includes("geteilt")) return false;
    if (!normalized.includes("miteigentumsanteil") && !/\bmea\b/.test(normalized)) return false;

    const hasSplitPhrase =
        /\bwird\s+(?:in|mn)\b/.test(normalized) || normalized.includes("wird zerlegt");
    if (!hasSplitPhrase) return false;

    if (looksLikeUnitBlockSnippet(normalized)) return false;

    return /\b\d{3,6}\b/.test(normalized);
};

const looksLikePropertyOverviewSnippet = (text: string): boolean => {
    const normalized = normalizeForRules(text);
    if (!normalized) return false;

    const keywordHits = countKeywordHits(normalized, PROPERTY_OVERVIEW_SIGNALS);
    if (keywordHits < 2) return false;

    const hasOverviewAnchor =
        normalized.includes("grundbuchstand") ||
        normalized.includes("eigentumsverhaltnisse") ||
        normalized.includes("grundbuch");

    return hasOverviewAnchor && !looksLikeUnitBlockSnippet(normalized) && !hasExplicitMeaDeclaration(normalized);
};

const classifyManualSelectionByRules = (heading: string, text: string): RuleClassification | null => {
    const textWithHeading = `${heading}\n${text}`.trim();
    if (!textWithHeading) return null;

    if (looksLikeUnitBlockSnippet(textWithHeading)) {
        return { sectionType: "units.unit_block", confidence: 0.96 };
    }

    if (hasExplicitMeaDeclaration(textWithHeading)) {
        return { sectionType: "weg.mea_declaration", confidence: 0.95 };
    }

    if (looksLikePropertyOverviewSnippet(textWithHeading)) {
        return { sectionType: "core.property_overview", confidence: 0.9 };
    }

    return null;
};

async function classifySections(
    sections: PdfSection[],
    concurrency = 10,
    runTool: RunJsonToolFn = runJsonTool,
): Promise<SectionClassificationResult> {
    if (!sections.length) return { classifications: [], warnings: [] };

    const tasks = sections.map((section) => async () => {
        try {
            const result = await runTool<{ sectionType?: unknown; confidence?: unknown }>({
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

/**
 * Classify a single piece of raw text + heading using the LLM.
 * Used for user drag-selections that don't have PdfSection structure.
 */
async function classifySectionWithLlm(
    text: string,
    heading: string,
    runTool: RunJsonToolFn = runJsonTool,
): Promise<{ sectionType: SectionType; confidence: number }> {
    const ruleBased = classifyManualSelectionByRules(heading, text);
    if (ruleBased && ruleBased.confidence >= 0.95) {
        return ruleBased;
    }

    const typeHints = SECTION_TYPES.map((type) => `${type}: ${SECTION_TYPE_DESCRIPTIONS[type]}`).join("\n");
    const messages: LlmMessage[] = [
        {
            role: "system",
            content: [
                "You are classifying PDF sections into a fixed set of section types.",
                "Choose the single best sectionType from the list.",
                "Return JSON that matches the schema.",
                "Use unknown when unsure.",
                "If a section mentions both Verwaltung/Verwalter and Buchhaltung/Abrechnung, choose weg.property_manager.",
                "IMPORTANT: weg.mea_declaration requires an EXPLICIT mention of 'MEA', 'Miteigentumsanteile', or 'Miteigentumsanteil'. Area measurements like m², qm, or Quadratmeter are NOT MEA declarations. Numbers followed by 'm' or 'm²' are square-metre figures, not co-ownership shares.",
                "Section types:",
                typeHints,
            ].join("\n"),
        },
        {
            role: "user",
            content: JSON.stringify({ heading, text }),
        },
    ];

    const result = await runTool<{ sectionType?: unknown; confidence?: unknown }>({
        tool: CLASSIFY_TOOL,
        messages,
    });

    const llmSectionType = coerceSectionType(result.parsed?.sectionType);
    const llmConfidence = coerceConfidence(result.parsed?.confidence);
    if (ruleBased) {
        const llmLikelyNoisy =
            llmSectionType === "unknown" ||
            llmSectionType === "weg.mea_declaration" ||
            llmSectionType === "units.unit_block";
        if (llmLikelyNoisy) {
            return {
                sectionType: ruleBased.sectionType,
                confidence: Math.max(ruleBased.confidence, llmConfidence),
            };
        }
    }

    return {
        sectionType: llmSectionType,
        confidence: llmConfidence,
    };
}

export {
    classifySections,
    classifySectionWithLlm,
    type SectionType,
    type SectionClassification,
    type SectionClassificationResult,
};
