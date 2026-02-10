import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";

type ExtractedBlock = {
    blockText: string;
};

const UNIT_START_REGEX = /^\s*(\d+\.\s*)?einheit(?:en)?\b/i;
const UNIT_MARKER_REGEX = /einheit(?:en)?\s*nr\.?\s*\d+/i;
const UNIT_KEYWORDS = [
    "einheit",
    "wohnung",
    "appartement",
    "apartment",
    "stellplatz",
    "stellplaetze",
    "parkplatz",
    "parking",
    "tiefgarage",
    "garage",
    "keller",
    "lager",
    "gewerbe",
    "buero",
    "buro",
];
const UNIT_KEYWORD_GROUP = UNIT_KEYWORDS.join("|");
const UNIT_ABBREV_REGEX = /^\s*(?:we|te|ge|tp|sp)\s*[-.]?\s*\d+\b/i;
const UNIT_NUMBER_ABBREV_REGEX = /^\s*\d+\s*(?:we|te|ge|tp|sp)\b/i;
const UNIT_NUMBER_FIRST_REGEX = new RegExp(
    `^\\s*(?:\\(\\s*)?\\d+\\s*(?:\\)\\s*)?(?:[.\\-]\\s*)?(?:${UNIT_KEYWORD_GROUP})\\b`,
    "i",
);
const UNIT_NUMBER_PREFIXED_PARKING_REGEX = new RegExp(
    "^\\s*(?:\\(\\s*)?\\d+\\s*(?:\\)\\s*)?(?:[.\\-]\\s*)?(?:tg|pkw|kfz|tiefgarage|tiefgaragen?)\\s*[- ]?\\s*(?:stellplatz|parkplatz)\\b",
    "i",
);
const UNIT_PREFIXED_PARKING_NUMBER_REGEX = new RegExp(
    "^\\s*(?:tg|pkw|kfz|tiefgarage|tiefgaragen?)\\s*[- ]?\\s*(?:stellplatz|parkplatz)\\b\\s*(?:nr\\.?\\s*)?\\d+\\b",
    "i",
);
const UNIT_KEYWORD_NUMBER_REGEX = new RegExp(
    `^\\s*(?:${UNIT_KEYWORD_GROUP})\\b\\s*(?:nr\\.?\\s*)?\\d+\\b`,
    "i",
);
const UNIT_NR_KEYWORD_REGEX = new RegExp(
    `^\\s*nr\\.?\\s*\\d+\\s*(?:${UNIT_KEYWORD_GROUP})\\b`,
    "i",
);

const isUnitMarkerLine = (text: string) =>
    UNIT_START_REGEX.test(text)
    || UNIT_MARKER_REGEX.test(text)
    || UNIT_ABBREV_REGEX.test(text)
    || UNIT_NUMBER_ABBREV_REGEX.test(text)
    || UNIT_NUMBER_FIRST_REGEX.test(text)
    || UNIT_NUMBER_PREFIXED_PARKING_REGEX.test(text)
    || UNIT_PREFIXED_PARKING_NUMBER_REGEX.test(text)
    || UNIT_KEYWORD_NUMBER_REGEX.test(text)
    || UNIT_NR_KEYWORD_REGEX.test(text);

const isUnitMarkerAtLines = (lines: string[], index: number) => {
    const current = lines[index]?.trim();
    if (!current) return false;
    if (isUnitMarkerLine(current)) return true;
    const next = lines[index + 1]?.trim();
    if (!next) return false;
    return isUnitMarkerLine(`${current} ${next}`);
};

const UNIT_BLOCK_TOOL: JsonToolSchema = {
    name: "extract_unit_blocks",
    description: "Extract each unit block from a units section.",
    outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            blocks: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        blockText: { type: "string" },
                        unitNumber: { type: "string" },
                    },
                    required: ["blockText", "unitNumber"],
                },
            },
        },
        required: ["blocks"],
    },
};

const buildMessages = (section: PdfSection): LlmMessage[] => [
    {
        role: "system",
        content: [
            "Extract every unit block (Einheit).",
            "Each block starts with a unit marker like 'Einheit Nr. 01' or '1. Einheit'.",
            "Treat numbered apartment or parking markers like '8. Wohnung', 'Stellplatz Nr. 9', or 'TG-Stellplatz 9' as unit starts.",
            "Also treat abbreviations like 'WE 08' (Wohnungseinheit) or 'TP 09' (Tiefgaragenplatz) as unit starts.",
            "Each unit block can be multiple lines long, and includes all text until the next unit marker or the end of the section.",
            "Include the full block text until the next unit marker.",
            "Return blockText verbatim from the input, keeping line breaks.",
            "Make sure every unit marker in the text appears in exactly one block.",
            "Do not return any block that contains more than one unit marker or the entire section.",
        ].join("\n"),
    },
    {
        role: "user",
        content: section.rawText,
    },
];

const normalizeWhitespace = (value: string) =>
    value.replace(/\s+/g, " ").trim();

const normalizeForMatch = (value: string) =>
    normalizeWhitespace(value).toLowerCase();

const collectUnitMarkers = (section: PdfSection): string[] => {
    const lines = section.lines.map((line) => line.text);
    const markers: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
        const current = lines[i]?.trim();
        if (!current) continue;
        if (isUnitMarkerLine(current)) {
            markers.push(current);
            continue;
        }
        // Only use the combined check when the current line is NOT itself
        // a marker. If the combined (current + next) test matches, record
        // the combined text and skip the next line to avoid double-counting.
        const next = lines[i + 1]?.trim();
        if (!next) continue;
        if (isUnitMarkerLine(`${current} ${next}`)) {
            markers.push(`${current}\n${next}`);
            i += 1; // skip next line — it's part of this marker
        }
    }
    return markers;
};

const getBlockLines = (blockText: string) =>
    blockText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

const countUnitMarkersInBlock = (blockText: string) => {
    const lines = getBlockLines(blockText);
    let count = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const current = lines[i]?.trim();
        if (!current) continue;
        if (isUnitMarkerLine(current)) {
            count += 1;
            continue;
        }
        // Combined check: if current + next matches, count once and skip next
        const next = lines[i + 1]?.trim();
        if (next && isUnitMarkerLine(`${current} ${next}`)) {
            count += 1;
            i += 1;
        }
    }
    return count;
};

const startsWithUnitMarker = (blockText: string) => {
    const lines = getBlockLines(blockText);
    if (!lines.length) return false;
    return isUnitMarkerAtLines(lines, 0);
};

const getMarkerCoverage = (markers: string[], blocks: ExtractedBlock[]) => {
    const normalizedMarkers = Array.from(new Set(markers.map(normalizeForMatch).filter(Boolean)));
    const normalizedBlocks = blocks.map((block) => normalizeForMatch(block.blockText));
    let covered = 0;

    for (const marker of normalizedMarkers) {
        if (normalizedBlocks.some((block) => block.includes(marker))) covered += 1;
    }

    return {
        markerCount: normalizedMarkers.length,
        coveredCount: covered,
        isComplete: normalizedMarkers.length > 0 && covered === normalizedMarkers.length,
    };
};

const splitUnitBlocksFallback = (section: PdfSection): ExtractedBlock[] => {
    const blocks: string[] = [];
    let current: string[] = [];

    for (let i = 0; i < section.lines.length; i += 1) {
        const text = section.lines[i]?.text.trim();
        if (!text) continue;
        // Only split on lines where the current line itself is a unit marker.
        // Do NOT use the combined (current + next) check here — it would
        // incorrectly mark the tail line of the previous unit as a new block
        // start because the *next* line happens to contain "Einheit Nr. XX".
        const isStart = isUnitMarkerLine(text);
        if (isStart && current.length) {
            blocks.push(current.join("\n"));
            current = [];
        }
        if (isStart || current.length) current.push(text);
    }

    if (current.length) blocks.push(current.join("\n"));
    if (!blocks.length) return [];

    return blocks
        .map((blockText) => ({ blockText: blockText.trim() }))
        .filter((block) => normalizeWhitespace(block.blockText).length > 0);
};

const blocksAreSequential = (rawText: string, blocks: ExtractedBlock[]): boolean => {
    let cursor = 0;
    for (const block of blocks) {
        const blockText = block.blockText;
        if (!blockText) return false;
        const index = rawText.indexOf(blockText, cursor);
        if (index < 0) return false;
        cursor = index + blockText.length;
    }
    return true;
};

async function extractUnitBlocks(section: PdfSection): Promise<ExtractedBlock[]> {
    const fallbackBlocks = splitUnitBlocksFallback(section);
    const markers = collectUnitMarkers(section);
    const fallbackCoverage = getMarkerCoverage(markers, fallbackBlocks);
    const fallbackIsComplete = fallbackBlocks.length > 0
        && (fallbackCoverage.markerCount > 0 ? fallbackCoverage.isComplete : fallbackBlocks.length >= 2);
    if (fallbackIsComplete) return fallbackBlocks;

    try {
        const result = await runJsonTool<{ blocks?: Array<{ blockText?: unknown }> }>({
            tool: UNIT_BLOCK_TOOL,
            messages: buildMessages(section),
        });

        const blocks = result.parsed?.blocks ?? [];
        const cleaned = blocks
            .map((block) => (typeof block.blockText === "string" ? block.blockText.trim() : ""))
            .filter((blockText) => normalizeWhitespace(blockText).length > 0)
            .map((blockText) => ({ blockText }));

        const markerCount = markers.length;
        const filtered = markerCount === 0
            ? cleaned
            : cleaned.filter((block) => {
                const unitMarkersInBlock = countUnitMarkersInBlock(block.blockText);
                if (unitMarkersInBlock === 0) return false;
                if (markerCount >= 2 && unitMarkersInBlock > 1) return false;
                if (!startsWithUnitMarker(block.blockText)) return false;
                return true;
            });

        if (filtered.length && blocksAreSequential(section.rawText, filtered)) {
            if (!markers.length) return filtered;
            const llmCoverage = getMarkerCoverage(markers, filtered);
            if (llmCoverage.coveredCount >= fallbackCoverage.coveredCount) return filtered;
        }
    } catch {
        return fallbackBlocks;
    }

    return fallbackBlocks;
}

export {
    extractUnitBlocks,
    type ExtractedBlock,
};
