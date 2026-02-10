import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";

type ExtractedBlock = {
    blockText: string;
};

const BUILDING_MARKER_REGEX = /^\s*(\(\s*\d+\s*\)\s*)?geb[äa]ude\s*\d+/i;

const BUILDING_BLOCK_TOOL: JsonToolSchema = {
    name: "extract_building_blocks",
    description: "Extract each building paragraph from a property section.",
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
                        buildingNumber: { type: "string" },
                    },
                    required: ["blockText", "buildingNumber"],
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
            "Extract every building paragraph.",
            "Each block should start with the building marker (e.g. '(1) Gebäude', 'Gebäude 1').",
            "Include the full paragraph text until the next building marker.",
            "Return blockText verbatim from the input, keeping line breaks.",
            "Do not return any block that contains more than one building marker or the entire section.",
        ].join("\n"),
    },
    {
        role: "user",
        content: section.rawText,
    },
];

const normalizeWhitespace = (value: string) =>
    value.replace(/\s+/g, " ").trim();

const getBlockLines = (blockText: string) =>
    blockText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

const countBuildingMarkersInBlock = (blockText: string) => {
    const lines = getBlockLines(blockText);
    return lines.filter((line) => BUILDING_MARKER_REGEX.test(line)).length;
};

const startsWithBuildingMarker = (blockText: string) => {
    const lines = getBlockLines(blockText);
    const firstLine = lines[0];
    if (!firstLine) return false;
    return BUILDING_MARKER_REGEX.test(firstLine);
};

const collectBuildingMarkers = (section: PdfSection) =>
    section.lines
        .map((line) => line.text.trim())
        .filter(Boolean)
        .filter((text) => BUILDING_MARKER_REGEX.test(text));

const splitBuildingBlocksFallback = (section: PdfSection): ExtractedBlock[] => {
    const blocks: string[] = [];
    let current: string[] = [];

    for (const line of section.lines) {
        const text = line.text.trim();
        if (!text) continue;
        const isStart = BUILDING_MARKER_REGEX.test(text);
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

async function extractBuildingBlocks(section: PdfSection): Promise<ExtractedBlock[]> {
    const fallbackBlocks = splitBuildingBlocksFallback(section);
    if (fallbackBlocks.length >= 2) return fallbackBlocks;

    try {
        const markers = collectBuildingMarkers(section);
        const result = await runJsonTool<{ blocks?: Array<{ blockText?: unknown }> }>({
            tool: BUILDING_BLOCK_TOOL,
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
                const buildingMarkersInBlock = countBuildingMarkersInBlock(block.blockText);
                if (buildingMarkersInBlock === 0) return false;
                if (markerCount >= 2 && buildingMarkersInBlock > 1) return false;
                if (!startsWithBuildingMarker(block.blockText)) return false;
                return true;
            });

        if (filtered.length && blocksAreSequential(section.rawText, filtered)) return filtered;
    } catch {
        return fallbackBlocks;
    }

    return fallbackBlocks;
}

export {
    extractBuildingBlocks,
    type ExtractedBlock,
};
