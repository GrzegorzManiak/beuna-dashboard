import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";

type BasicFieldKey =
    | "propertyName"
    | "propertyId"
    | "managementTypeHint"
    | "street"
    | "houseNumber"
    | "postalCode"
    | "city"
    | "country";

type BasicFieldValue = {
    key: BasicFieldKey;
    value: string | null;
};

type BasicDetailsExtract = {
    fields: BasicFieldValue[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASIC_FIELD_KEYS: BasicFieldKey[] = [
    "propertyName",
    "propertyId",
    "managementTypeHint",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "country",
];

const BASIC_DETAILS_TOOL: JsonToolSchema = {
    name: "extract_property_type_and_basic_details",
    description: "Extract property type and basic details from PDF sections.",
    outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            fields: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        key: { type: "string", enum: BASIC_FIELD_KEYS },
                        value: { type: ["string", "null"] },
                    },
                    required: ["key", "value"],
                },
            },
        },
        required: ["fields"],
    },
};

// ---------------------------------------------------------------------------
// LLM prompt
// ---------------------------------------------------------------------------

function buildMessages(sections: PdfSection[]): LlmMessage[] {
    const payload = sections.map((section, index) => ({
        index,
        heading: section.heading.text,
        text: section.rawText,
    }));

    return [
        {
            role: "system",
            content: [
                "Extract property type (WEG/MV/unknown) and basic details from the provided sections.",
                "If a field is missing, return null for its value.",
                "Fields to extract:",
                BASIC_FIELD_KEYS.join(", "),
            ].join("\n"),
        },
        {
            role: "user",
            content: JSON.stringify({ sections: payload }),
        },
    ];
}

// ---------------------------------------------------------------------------
// Value normalization helpers
// ---------------------------------------------------------------------------

function coerceValue(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
    if (typeof value === "boolean") return value ? "true" : "false";
    return null;
}

function normalizeManagementType(value: string | null): string | null {
    if (!value) return null;
    const upper = value.trim().toUpperCase();
    if (!upper) return null;
    if (upper.includes("WEG")) return "WEG";
    if (upper.includes("MV")) return "MV";
    if (upper.includes("W")) return "WEG";
    if (upper.includes("M")) return "MV";
    return null;
}

const COMPANY_SUFFIX_RE = /\b(gmbh|ag|kg|ug|gbr|e\.v\.|ev|ltd|inc|llc|s\.?a\.?r\.?l\.?|s\.?a\.?)\b/i;

function isLikelyCompanyName(value: string | null): boolean {
    if (!value) return false;
    return COMPANY_SUFFIX_RE.test(value);
}

function isPropertyIdCandidate(value: string | null): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    return trimmed.length >= 3 && /\d/.test(trimmed);
}

// ---------------------------------------------------------------------------
// Normalize LLM output into a clean field array
// ---------------------------------------------------------------------------

type RawField = { key?: unknown; value?: unknown };

function normalizeFields(input: RawField[]): BasicFieldValue[] {
    const byKey = new Map<BasicFieldKey, RawField>();
    for (const entry of input) {
        if (typeof entry.key !== "string") continue;
        if (!BASIC_FIELD_KEYS.includes(entry.key as BasicFieldKey)) continue;
        byKey.set(entry.key as BasicFieldKey, entry);
    }

    return BASIC_FIELD_KEYS.map((key) => {
        const raw = coerceValue(byKey.get(key)?.value);

        let value: string | null;
        if (key === "managementTypeHint") {
            value = normalizeManagementType(raw);
        } else if (key === "propertyName" && isLikelyCompanyName(raw)) {
            value = null;
        } else if (key === "propertyId" && !isPropertyIdCandidate(raw)) {
            value = null;
        } else {
            value = raw;
        }

        return { key, value };
    });
}

// ---------------------------------------------------------------------------
// Regex-based heuristic fallbacks (fill gaps the LLM missed)
// ---------------------------------------------------------------------------

function findLineMatch(
    sections: PdfSection[],
    regex: RegExp,
    valueIndex = 0,
): string | null {
    for (const section of sections) {
        for (const line of section.lines) {
            const match = line.text.match(regex);
            if (!match) continue;
            const value = (match[valueIndex] ?? match[0])?.trim();
            if (value) return value;
        }
    }
    return null;
}

function findAddressMatch(sections: PdfSection[]) {
    const fullRe = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-\s]+?)\s+(\d{1,4}[a-zA-Z]?)\s*[,\s]+\s*(\d{5})\s+([A-Za-zÄÖÜäöüß\-\s]+)/;
    const streetRe = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-\s]+?)\s+(\d{1,4}[a-zA-Z]?)/;
    const postalRe = /(\d{5})\s+([A-Za-zÄÖÜäöüß\-\s]+)/;

    let streetMatch: { street: string; houseNumber: string } | null = null;
    let postalMatch: { postalCode: string; city: string } | null = null;

    for (const section of sections) {
        for (const line of section.lines) {
            const full = line.text.match(fullRe);
            if (full?.[1] && full[2] && full[3] && full[4]) {
                return {
                    street: full[1].trim(),
                    houseNumber: full[2].trim(),
                    postalCode: full[3].trim(),
                    city: full[4].trim(),
                };
            }
            if (!streetMatch) {
                const m = line.text.match(streetRe);
                if (m?.[1] && m[2]) streetMatch = { street: m[1].trim(), houseNumber: m[2].trim() };
            }
            if (!postalMatch) {
                const m = line.text.match(postalRe);
                if (m?.[1] && m[2]) postalMatch = { postalCode: m[1].trim(), city: m[2].trim() };
            }
            if (streetMatch && postalMatch) break;
        }
        if (streetMatch && postalMatch) break;
    }

    return { ...streetMatch, ...postalMatch };
}

function applyHeuristics(fields: BasicFieldValue[], sections: PdfSection[]): BasicFieldValue[] {
    const map = new Map<BasicFieldKey, BasicFieldValue>(fields.map((f) => [f.key, f]));

    const fill = (key: BasicFieldKey, value: string | null | undefined) => {
        if (!value) return;
        const current = map.get(key);
        if (current?.value && current.value.toLowerCase() !== "unknown") return;
        map.set(key, { key, value });
    };

    // Property name – look for quoted text
    const nameMatch = findLineMatch(sections, /[„"](.*?)["""]/, 1);
    if (nameMatch && !isLikelyCompanyName(nameMatch)) {
        fill("propertyName", nameMatch);
    }

    // Property ID
    const idMatch = findLineMatch(
        sections,
        /(?:Objekt(?:nummer|nr\.?|nummern)?|Objekt-Nr\.?|Objekt\s*Nr\.?)\s*[:.]?\s*([A-Za-z0-9./-]+)/i,
        1,
    );
    if (isPropertyIdCandidate(idMatch)) fill("propertyId", idMatch);

    // Management type
    if (findLineMatch(sections, /\bWEG\b/i)) fill("managementTypeHint", "WEG");
    else if (findLineMatch(sections, /\bMV\b/i)) fill("managementTypeHint", "MV");

    // Address
    const addr = findAddressMatch(sections);
    fill("street", addr.street);
    fill("houseNumber", addr.houseNumber);
    fill("postalCode", addr.postalCode);
    fill("city", addr.city);

    // Country
    fill("country", findLineMatch(
        sections,
        /\b(Deutschland|Germany|Österreich|Austria|Schweiz|Switzerland)\b/i,
        1,
    ));

    return BASIC_FIELD_KEYS.map((key) => map.get(key) ?? { key, value: null });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function extractBasicDetails(
    sections: PdfSection[],
): Promise<{ extract: BasicDetailsExtract }> {
    if (!sections.length) {
        return { extract: { fields: normalizeFields([]) } };
    }

    const limitedSections = sections.slice(0, 8);

    let parsed: RawField[] = [];
    try {
        const result = await runJsonTool<{ fields?: RawField[] }>({
            tool: BASIC_DETAILS_TOOL,
            messages: buildMessages(limitedSections),
        });
        parsed = result.parsed?.fields ?? [];
    } catch {
        parsed = [];
    }

    const normalized = normalizeFields(parsed);
    const fields = applyHeuristics(normalized, limitedSections);

    return { extract: { fields } };
}

export {
    extractBasicDetails,
    type BasicDetailsExtract,
    type BasicFieldKey,
    type BasicFieldValue,
};
