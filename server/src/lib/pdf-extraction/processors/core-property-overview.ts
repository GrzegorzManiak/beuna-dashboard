import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const OVERVIEW_KEYWORDS = [
    "teilungserklaerung",
    "grundstueck",
    "bezeichnung",
    "eigentumsverhaeltnisse",
    "grundbuch",
    "teilungsplan",
    "property overview",
    "property name",
    "legal owner",
    "land registry",
    "ownership structure",
];

export class CorePropertyOverviewProcessor implements SectionProcessor {
    readonly sectionType = "core.property_overview" as const;
    readonly description = "High-level property identity and overview";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2 || section.lines.length > 50) return null;
        
        const hasPattern = hasStructuralPattern(section, { headingKeywords: OVERVIEW_KEYWORDS });    
        if (!hasPattern) return null;
        
        return calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            OVERVIEW_KEYWORDS
        );
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.rawText),
            sectionType: this.sectionType,
            confidence: 0.6,
            renderable: true,
            textPosition: linesToPositions(section.lines),
        };
    }
}
