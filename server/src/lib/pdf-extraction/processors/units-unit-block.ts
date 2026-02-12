import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection, SectionItem } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
    findLinesForBlock,
} from "./base";

const UNIT_KEYWORDS = [
    "wohnung",
    "einheit",
    "einheitenbeschreibung",
    "aufteilungsplan",
    "sondereigentum",
    "tiefgaragenstellplatz",
    "stellplatz",
    "kellerraum",
    "gartenanteil",
    "unit",
    "units",
    "rental unit",
    "apartment",
];

const UNIT_CONTENT_KEYWORDS = [
    "nr",
    "nummer",
    "lage",
    "stockwerk",
    "flaeche",
    "qm",
    "mea",
    "anteil",
    "raum",
    "zimmer",
    "floor",
    "area",
    "description",
    "unit",
    "type",
];

export class UnitsBlockProcessor implements SectionProcessor {
    readonly sectionType = "units.unit_block" as const;
    readonly description = "Units block containing multiple unit entries";
    readonly isArrayBased = true;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: UNIT_KEYWORDS,
            contentKeywords: UNIT_CONTENT_KEYWORDS,
            minLines: 2,
        });
        
        if (!hasPattern) return null;
        
        const headingConfidence = calculateKeywordConfidence(
            section.heading.text,
            UNIT_KEYWORDS
        );
        
        const contentConfidence = calculateKeywordConfidence(
            section.rawText,
            UNIT_CONTENT_KEYWORDS,
            UNIT_KEYWORDS
        );
        
        return headingConfidence * 0.6 + contentConfidence * 0.4;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        const { extractUnitBlocks } = await import("../llm/extract-unit-blocks");
        
        const blocks = await extractUnitBlocks(section);
        const sectionPositions = linesToPositions(section.lines);
        
        // Compute per-block bounding boxes by matching block text to section lines
        let cursor = 0;
        const items: SectionItem[] = blocks.map((block, index) => {
            const { lines, nextCursor } = findLinesForBlock(section, block.blockText, cursor);
            cursor = nextCursor;
            const positions = lines.length ? linesToPositions(lines) : sectionPositions;
            return {
                id: `unit-${index + 1}-${Date.now()}`,
                rawText: block.blockText.trim(),
                confidence: 0.87,
                textPosition: positions,
            };
        });
        
        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.heading.text || section.rawText),
            sectionType: this.sectionType,
            confidence: 0.7,
            renderable: false,
            textPosition: sectionPositions,
            items,
        };
    }
}
