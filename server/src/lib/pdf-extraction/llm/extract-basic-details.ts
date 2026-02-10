import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection, Position } from "../raw/types";

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
    sourceText: string | null;
    sectionIndex: number | null;
    position: Position | null;
};

type BasicDetailsExtract = {
    fields: BasicFieldValue[];
};

type BasicFieldInput = {
    key?: unknown;
    value?: unknown;
    sourceText?: unknown;
    sectionIndex?: unknown;
};

type FieldMatch = {
    sectionIndex: number;
    value: string;
    sourceText: string;
};

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
    description: "Extract property type and basic details with minimal source text snippets.",
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
                        sourceText: { type: ["string", "null"] },
                        sectionIndex: { type: ["integer", "null"] },
                    },
                    required: ["key", "value", "sourceText", "sectionIndex"],
                },
            },
        },
        required: ["fields"],
    },
};

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

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
                "Extract property type (WEG/MV/unknown) and basic details.",
                "Return the smallest exact sourceText snippet that contains each value.",
                "sourceText must be copied verbatim from the section text.",
                "Use sectionIndex from the payload.",
                "If a field is missing, return nulls.",
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

function coerceValue(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
    if (typeof value === "boolean") return value ? "true" : "false";
    return null;
}

function coerceSourceText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    return value.trim() ? value : null;
}

function coerceSectionIndex(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(numeric)) return null;
    if (numeric < 0) return null;
    return numeric;
}

function normalizeManagementType(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const upper = trimmed.toUpperCase();

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
    if (!trimmed) return false;
    if (!/\d/.test(trimmed)) return false;
    return trimmed.length >= 3;
}

function normalizeFields(input: BasicFieldInput[]): BasicFieldValue[] {
    const byKey = new Map<BasicFieldKey, BasicFieldInput>();
    for (const entry of input) {
        if (!entry.key || typeof entry.key !== "string") continue;
        if (!BASIC_FIELD_KEYS.includes(entry.key as BasicFieldKey)) continue;
        byKey.set(entry.key as BasicFieldKey, entry);
    }

    return BASIC_FIELD_KEYS.map((key) => {
        const entry = byKey.get(key);
        const rawValue = coerceValue(entry?.value);
        const value = key === "managementTypeHint"
            ? normalizeManagementType(rawValue)
            : key === "propertyName" && isLikelyCompanyName(rawValue)
                ? null
            : key === "propertyId" && !isPropertyIdCandidate(rawValue)
                ? null
                : rawValue;
        return {
            key,
            value,
            sourceText: key === "propertyName" && isLikelyCompanyName(rawValue)
                ? null
                : key === "propertyId" && !isPropertyIdCandidate(rawValue)
                ? null
                : coerceSourceText(entry?.sourceText),
            sectionIndex: key === "propertyName" && isLikelyCompanyName(rawValue)
                ? null
                : key === "propertyId" && !isPropertyIdCandidate(rawValue)
                ? null
                : coerceSectionIndex(entry?.sectionIndex),
            position: null,
        };
    });
}

function hasUsableValue(value: string | null): boolean {
    if (!value) return false;
    return value.trim().toLowerCase() !== "unknown";
}

function findLineMatch(
    sections: PdfSection[],
    regex: RegExp,
    valueIndex = 0,
): FieldMatch | null {
    for (const [sectionIndex, section] of sections.entries()) {
        for (const line of section.lines) {
            const match = line.text.match(regex);
            if (!match) continue;
            const value = (match[valueIndex] ?? match[0])?.trim();
            if (!value) continue;
            return {
                sectionIndex,
                value,
                sourceText: value,
            };
        }
    }
    return null;
}

function findPropertyNameWithContext(sections: PdfSection[]): FieldMatch | null {
    const contextRegex = /\b(name|namen|objekt|objektnamen|bezeichnet|geführt|fuehrt)\b/i;
    const quotedRegex = /[„"](.*?)[“”"]/;
    for (const [sectionIndex, section] of sections.entries()) {
        for (const line of section.lines) {
            if (!contextRegex.test(line.text)) continue;
            const match = line.text.match(quotedRegex);
            const value = match?.[1]?.trim();
            if (!value || isLikelyCompanyName(value)) continue;
            return {
                sectionIndex,
                value,
                sourceText: value,
            };
        }
    }
    return null;
}

function findAddressMatch(sections: PdfSection[]) {
    const fullRegex = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-\s]+?)\s+(\d{1,4}[a-zA-Z]?)\s*[,\s]+\s*(\d{5})\s+([A-Za-zÄÖÜäöüß\-\s]+)/;
    const streetRegex = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-\s]+?)\s+(\d{1,4}[a-zA-Z]?)/;
    const postalRegex = /(\d{5})\s+([A-Za-zÄÖÜäöüß\-\s]+)/;

    let streetMatch: { sectionIndex: number; street: string; houseNumber: string } | null = null;
    let postalMatch: { sectionIndex: number; postalCode: string; city: string } | null = null;

    for (const [sectionIndex, section] of sections.entries()) {
        for (const line of section.lines) {
            const full = line.text.match(fullRegex);
            if (full && full[1] && full[2] && full[3] && full[4]) {
                return {
                    street: { sectionIndex, value: full[1].trim(), sourceText: full[1].trim() },
                    houseNumber: { sectionIndex, value: full[2].trim(), sourceText: full[2].trim() },
                    postalCode: { sectionIndex, value: full[3].trim(), sourceText: full[3].trim() },
                    city: { sectionIndex, value: full[4].trim(), sourceText: full[4].trim() },
                };
            }

            if (!streetMatch) {
                const street = line.text.match(streetRegex);
                if (street && street[1] && street[2]) {
                    streetMatch = {
                        sectionIndex,
                        street: street[1].trim(),
                        houseNumber: street[2].trim(),
                    };
                }
            }

            if (!postalMatch) {
                const postal = line.text.match(postalRegex);
                if (postal && postal[1] && postal[2]) {
                    postalMatch = {
                        sectionIndex,
                        postalCode: postal[1].trim(),
                        city: postal[2].trim(),
                    };
                }
            }

            if (streetMatch && postalMatch) break;
        }
        if (streetMatch && postalMatch) break;
    }

    const match: {
        street?: FieldMatch;
        houseNumber?: FieldMatch;
        postalCode?: FieldMatch;
        city?: FieldMatch;
    } = {};

    if (streetMatch) {
        match.street = {
            sectionIndex: streetMatch.sectionIndex,
            value: streetMatch.street,
            sourceText: streetMatch.street,
        };
        match.houseNumber = {
            sectionIndex: streetMatch.sectionIndex,
            value: streetMatch.houseNumber,
            sourceText: streetMatch.houseNumber,
        };
    }

    if (postalMatch) {
        match.postalCode = {
            sectionIndex: postalMatch.sectionIndex,
            value: postalMatch.postalCode,
            sourceText: postalMatch.postalCode,
        };
        match.city = {
            sectionIndex: postalMatch.sectionIndex,
            value: postalMatch.city.trim(),
            sourceText: postalMatch.city.trim(),
        };
    }

    return match;
}

function applyMatch(
    current: BasicFieldValue,
    match: FieldMatch,
    overrideValue?: string,
): BasicFieldValue {
    return {
        ...current,
        value: current.value ?? overrideValue ?? match.value,
        sourceText: current.sourceText ?? match.sourceText,
        sectionIndex: current.sectionIndex ?? match.sectionIndex,
    };
}

function applyHeuristics(fields: BasicFieldValue[], sections: PdfSection[]): BasicFieldValue[] {
    const map = new Map<BasicFieldKey, BasicFieldValue>(fields.map((field) => [field.key, field]));
    const updateField = (key: BasicFieldKey, match: FieldMatch | null | undefined, overrideValue?: string) => {
        if (!match) return;
        const current = map.get(key);
        if (!current) return;
        const needsValue = !hasUsableValue(current.value);
        const needsSource = !current.sourceText || current.sectionIndex === null;
        if (!needsValue && !needsSource) return;
        map.set(key, applyMatch(current, match, overrideValue));
    };

    const nameMatch = findLineMatch(sections, /[„"](.*?)[“”"]/);
    const filteredNameMatch = nameMatch && !isLikelyCompanyName(nameMatch.value) ? nameMatch : null;
    updateField("propertyName", filteredNameMatch);
    if (!filteredNameMatch) {
        const contextualName = findPropertyNameWithContext(sections);
        updateField("propertyName", contextualName);
    }

    const propertyIdMatch = findLineMatch(
        sections,
        /(?:Objekt(?:nummer|nr|nr\.|nummern)?|Objektnummer|Objekt-Nr\.?|Objekt\s*Nr\.?)\s*[:.]?\s*([A-Za-z0-9./-]+)/i,
        1,
    );
    const propertyIdCandidate = propertyIdMatch && isPropertyIdCandidate(propertyIdMatch.value)
        ? propertyIdMatch
        : null;
    updateField("propertyId", propertyIdCandidate);

    const wegMatch = findLineMatch(sections, /\bWEG\b/i);
    const mvMatch = findLineMatch(sections, /\bMV\b/i);
    if (wegMatch) updateField("managementTypeHint", wegMatch, "WEG");
    if (!wegMatch && mvMatch) updateField("managementTypeHint", mvMatch, "MV");

    const addressMatch = findAddressMatch(sections);
    updateField("street", addressMatch.street);
    updateField("houseNumber", addressMatch.houseNumber);
    updateField("postalCode", addressMatch.postalCode);
    updateField("city", addressMatch.city);

    const countryMatch = findLineMatch(sections, /\b(Deutschland|Germany|Österreich|Austria|Schweiz|Switzerland)\b/i, 1);
    updateField("country", countryMatch);

    return BASIC_FIELD_KEYS.map((key) => map.get(key) ?? {
        key,
        value: null,
        sourceText: null,
        sectionIndex: null,
        position: null,
    });
}

function findFieldPosition(section: PdfSection, sourceText: string): Position | null {
    const target = normalizeWhitespace(sourceText);
    if (!target) return null;

    for (const line of section.lines) {
        const lineText = line.text;
        const directIndex = lineText.toLowerCase().indexOf(target.toLowerCase());
        if (directIndex >= 0) {
            const avgCharWidth = line.width / Math.max(lineText.length, 1);
            const x = line.x + avgCharWidth * directIndex;
            const width = avgCharWidth * target.length;
            return {
                page: line.page,
                x,
                y: line.y,
                width,
                height: line.height,
            };
        }

        const normalizedLine = normalizeWhitespace(lineText).toLowerCase();
        const normalizedTarget = target.toLowerCase();
        const normalizedIndex = normalizedLine.indexOf(normalizedTarget);
        if (normalizedIndex >= 0) {
            const ratioStart = normalizedIndex / Math.max(normalizedLine.length, 1);
            const ratioWidth = normalizedTarget.length / Math.max(normalizedLine.length, 1);
            return {
                page: line.page,
                x: line.x + ratioStart * line.width,
                y: line.y,
                width: line.width * ratioWidth,
                height: line.height,
            };
        }
    }

    return null;
}

function tokenize(value: string): string[] {
    return normalizeWhitespace(value)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/gu)
        .filter((token) => token.length > 1);
}

function findTokenSpan(tokens: string[], normalizedLine: string): { matched: number; start: number; end: number } | null {
    if (!tokens.length) return null;
    let matched = 0;
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;

    for (const token of tokens) {
        const index = normalizedLine.indexOf(token);
        if (index < 0) continue;
        matched += 1;
        start = Math.min(start, index);
        end = Math.max(end, index + token.length);
    }

    if (!matched || !Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { matched, start, end };
}

function bigramSimilarity(a: string, b: string): number {
    if (a.length < 2 || b.length < 2) return 0;
    const toBigrams = (value: string) => {
        const result = new Set<string>();
        for (let i = 0; i < value.length - 1; i += 1) {
            result.add(value.slice(i, i + 2));
        }
        return result;
    };
    const aSet = toBigrams(a);
    const bSet = toBigrams(b);
    if (!aSet.size || !bSet.size) return 0;
    let intersection = 0;
    for (const entry of aSet) {
        if (bSet.has(entry)) intersection += 1;
    }
    return (2 * intersection) / (aSet.size + bSet.size);
}

function findFuzzyFieldPosition(section: PdfSection, sourceText: string): Position | null {
    const tokens = tokenize(sourceText);
    if (!tokens.length) return null;

    const normalizedTarget = normalizeWhitespace(sourceText).toLowerCase();
    let best:
        | {
              score: number;
              start: number;
              end: number;
              normalizedLength: number;
              line: PdfSection["lines"][number];
          }
        | null = null;
    let bestSimilarityLine: PdfSection["lines"][number] | null = null;
    let bestSimilarity = 0;

    for (const line of section.lines) {
        const normalizedLine = normalizeWhitespace(line.text).toLowerCase();
        if (!normalizedLine) continue;
        const tokenMatch = findTokenSpan(tokens, normalizedLine);
        if (tokenMatch) {
            const score = tokenMatch.matched / tokens.length;
            if (!best || score > best.score || (score === best.score && (tokenMatch.end - tokenMatch.start) < (best.end - best.start))) {
                best = {
                    score,
                    start: tokenMatch.start,
                    end: tokenMatch.end,
                    normalizedLength: normalizedLine.length,
                    line,
                };
            }
        } else {
            const similarity = bigramSimilarity(
                normalizedTarget.replace(/\s+/g, ""),
                normalizedLine.replace(/\s+/g, ""),
            );
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestSimilarityLine = line;
            }
        }
    }

    if (best && best.score >= 0.4 && best.normalizedLength > 0) {
        const ratioStart = best.start / best.normalizedLength;
        const ratioWidth = Math.max(1, best.end - best.start) / best.normalizedLength;
        return {
            page: best.line.page,
            x: best.line.x + ratioStart * best.line.width,
            y: best.line.y,
            width: best.line.width * ratioWidth,
            height: best.line.height,
        };
    }

    if (bestSimilarityLine && bestSimilarity >= 0.6) {
        return {
            page: bestSimilarityLine.page,
            x: bestSimilarityLine.x,
            y: bestSimilarityLine.y,
            width: bestSimilarityLine.width,
            height: bestSimilarityLine.height,
        };
    }

    return null;
}

function buildPositions(fields: BasicFieldValue[], sections: PdfSection[]): BasicFieldValue[] {
    return fields.map((field) => {
        if (field.sectionIndex === null) return field;
        const section = sections[field.sectionIndex];
        if (!section || !field.sourceText) return field;
        const directPosition = findFieldPosition(section, field.sourceText);
        const position = directPosition ?? findFuzzyFieldPosition(section, field.sourceText);
        return {
            ...field,
            position,
        };
    });
}

function uniquePositions(positions: Position[]): Position[] {
    const seen = new Set<string>();
    const result: Position[] = [];
    for (const pos of positions) {
        const key = `${pos.page}:${pos.x}:${pos.y}:${pos.width}:${pos.height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(pos);
    }
    return result;
}

function sortPositions(positions: Position[]): Position[] {
    return positions.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
}

function groupPositionsBySectionIndex(fields: BasicFieldValue[]): Map<number, Position[]> {
    const grouped = new Map<number, Position[]>();
    for (const field of fields) {
        if (field.sectionIndex === null) continue;
        if (!field.position) continue;
        const current = grouped.get(field.sectionIndex) ?? [];
        current.push(field.position);
        grouped.set(field.sectionIndex, current);
    }

    for (const [index, positions] of grouped.entries()) {
        grouped.set(index, sortPositions(uniquePositions(positions)));
    }

    return grouped;
}

async function extractBasicDetails(
    sections: PdfSection[],
): Promise<{
    extract: BasicDetailsExtract;
    highlightBySectionIndex: Map<number, Position[]>;
}> {
    if (!sections.length) {
        return {
            extract: { fields: normalizeFields([]) },
            highlightBySectionIndex: new Map(),
        };
    }

    const limitedSections = sections.slice(0, 8);
    let parsedFields: BasicFieldInput[] = [];
    try {
        const result = await runJsonTool<{ fields?: BasicFieldInput[] }>({
            tool: BASIC_DETAILS_TOOL,
            messages: buildMessages(limitedSections),
        });
        parsedFields = result.parsed?.fields ?? [];
    } catch {
        parsedFields = [];
    }

    const normalizedFields = normalizeFields(parsedFields);
    const heuristicFields = applyHeuristics(normalizedFields, limitedSections);
    const withPositions = buildPositions(heuristicFields, limitedSections);
    const highlightBySectionIndex = groupPositionsBySectionIndex(withPositions);

    return {
        extract: { fields: withPositions },
        highlightBySectionIndex,
    };
}

export {
    extractBasicDetails,
    type BasicDetailsExtract,
    type BasicFieldKey,
    type BasicFieldValue,
};
