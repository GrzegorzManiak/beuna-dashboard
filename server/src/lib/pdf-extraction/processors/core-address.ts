import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const ADDRESS_KEYWORDS = [
    "anschrift",
    "adresse",
    "lage",
    "strasse",
    "plz",
    "ort",
    "stadt",
];

export class CoreAddressProcessor implements SectionProcessor {
    readonly sectionType = "core.address" as const;
    readonly description = "Primary property address information";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        // Address sections are typically short
        if (section.lines.length > 10) return null;
        if (section.lines.length < 1) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: ADDRESS_KEYWORDS,
        });
        
        if (!hasPattern) return null;
        
        return calculateKeywordConfidence(
            section.heading.text,
            ADDRESS_KEYWORDS
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
