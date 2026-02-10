import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection, SectionItem } from "./types";
import {
    containsAnyKeyword,
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
    findLinesForBlock,
} from "./base";

const BUILDING_KEYWORDS = [
    "gebaeude",
    "gebaeudedaten",
    "objektbeschreibung",
    "haus",
    "wohnanlage",
    "immobilie",
    "bauwerk",
    "anwesen",
    "liegenschaft",
];

const BUILDING_CONTENT_KEYWORDS = [
    "stockwerk",
    "etage",
    "baujahr",
    "adresse",
    "strasse",
    "lage",
    "grundstueck",
    "wohnflaeche",
    "nutzflaeche",
];

export class CoreBuildingsProcessor implements SectionProcessor {
    readonly sectionType = "core.buildings" as const;
    readonly description = "Buildings block containing multiple building entries";
    readonly isArrayBased = true;

    matches(section: PdfSection): number | null {
        // Quick reject: too short
        if (section.lines.length < 2) return null;
        
        // Check for building-related keywords
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: BUILDING_KEYWORDS,
            contentKeywords: BUILDING_CONTENT_KEYWORDS,
            minLines: 2,
        });
        
        if (!hasPattern) return null;
        
        // Calculate confidence based on keyword density
        const headingConfidence = calculateKeywordConfidence(
            section.heading.text,
            BUILDING_KEYWORDS
        );
        
        const contentConfidence = calculateKeywordConfidence(
            section.rawText,
            BUILDING_CONTENT_KEYWORDS,
            BUILDING_KEYWORDS
        );
        
        // Weight heading more heavily than content
        return headingConfidence * 0.7 + contentConfidence * 0.3;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        const { extractBuildingBlocks } = await import("../llm/extract-building-blocks");
        
        const blocks = await extractBuildingBlocks(section);
        const sectionPositions = linesToPositions(section.lines);
        
        // Compute per-block bounding boxes by matching block text to section lines
        let cursor = 0;
        const items: SectionItem[] = blocks.map((block, index) => {
            const { lines, nextCursor } = findLinesForBlock(section, block.blockText, cursor);
            cursor = nextCursor;
            const positions = lines.length ? linesToPositions(lines) : sectionPositions;
            return {
                id: `building-${index + 1}-${Date.now()}`,
                rawText: block.blockText.trim(),
                state: "needs_review" as const,
                confidence: 0.85,
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
