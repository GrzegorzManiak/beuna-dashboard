import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
} from "./base";

const SPECIAL_RIGHTS_KEYWORDS = [
    "sondernutzungsrecht",
    "sonderrecht",
    "nutzungsrecht",
    "special rights",
    "exclusive access",
    "usage rights",
    "contractual rights",
    "garten",
    "terrasse",
    "balkon",
    "stellplatz",
    "parkplatz",
    "roof terrace",
    "parking spaces",
];

export class WegSpecialRightsProcessor implements SectionProcessor {
    readonly sectionType = "weg.special_rights" as const;
    readonly description = "Special usage rights (Sondernutzungsrechte)";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: SPECIAL_RIGHTS_KEYWORDS,
        });
        
        if (!hasPattern) return null;
        
        return calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            SPECIAL_RIGHTS_KEYWORDS
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
