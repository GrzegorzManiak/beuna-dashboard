import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const MEA_KEYWORDS = [
    "mea",
    "miteigentumsanteil",
    "anteil",
    "summe",
    "kontrolle",
    "pruefung",
    "1000stel",
    "tausendstel",
];

export class WegMeaDeclarationProcessor implements SectionProcessor {
    readonly sectionType = "weg.mea_declaration" as const;
    readonly description = "MEA declaration section (total co-ownership shares)";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        // MEA sections are typically short
        if (section.lines.length > 20) return null;
        if (section.lines.length < 1) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: MEA_KEYWORDS,
            contentKeywords: MEA_KEYWORDS,
        });
        
        if (!hasPattern) return null;
        
        return calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            MEA_KEYWORDS
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
