import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const OWNER_KEYWORDS = [
    "eigentuemer",
    "vermieter",
    "gesellschaft",
    "gmbh",
    "firma",
    "besitzer",
];

export class MvOwnerEntityProcessor implements SectionProcessor {
    readonly sectionType = "mv.owner_entity" as const;
    readonly description = "Owner or landlord entity information";
    readonly isArrayBased = false;
    readonly propertyTypeScope = "MV" as const;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: OWNER_KEYWORDS,
        });
        
        if (!hasPattern) return null;
        
        return calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            OWNER_KEYWORDS
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
