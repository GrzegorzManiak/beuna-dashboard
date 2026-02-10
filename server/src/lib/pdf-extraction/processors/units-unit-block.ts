import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection, SectionItem } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const UNIT_KEYWORDS = [
    "wohnung",
    "einheit",
    "sondereigentum",
    "tiefgaragenstellplatz",
    "stellplatz",
    "kellerraum",
    "gartenanteil",
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
];

export class UnitsBlocksProcessor implements SectionProcessor {
    readonly sectionType = "units.unit_blocks" as const;
    readonly description = "Units block containing multiple unit entries";
    readonly isArrayBased = true;

    matches(section: PdfSection): number | null {
        // Quick reject: too short
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
        
        // Convert blocks to items
        const items: SectionItem[] = blocks.map((block, index) => ({
            id: `unit-${index + 1}-${Date.now()}`,
            rawText: block.blockText.trim(),
        }));
        
        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.heading.text || section.rawText),
            sectionType: this.sectionType,
            confidence: 0.7,
            renderable: true,
            textPosition: linesToPositions(section.lines),
            items,
        };
    }
}
