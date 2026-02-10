import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const MANAGER_KEYWORDS = [
    "verwalter",
    "verwaltung",
    "hausverwaltung",
];

export class WegPropertyManagerProcessor implements SectionProcessor {
    readonly sectionType = "weg.property_manager" as const;
    readonly description = "Property manager appointment section";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: MANAGER_KEYWORDS,
            minLines: 2,
        });
        
        if (!hasPattern) return null;
        
        const confidence = calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            MANAGER_KEYWORDS
        );
        
        return confidence;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.heading.text || section.rawText),
            sectionType: this.sectionType,
            confidence: 0.7,
            renderable: true,
            textPosition: linesToPositions(section.lines),
        };
    }
}
