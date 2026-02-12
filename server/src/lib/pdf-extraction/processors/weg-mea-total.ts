import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
    containsAnyKeyword,
} from "./base";

const MEA_KEYWORDS = [
    "mea",
    "miteigentumsanteil",
    "miteigentumsanteile",
    "anteil",
    "summe",
    "kontrolle",
    "pruefung",
    "1000stel",
    "tausendstel",
    "zerlegt",
    "eigentum am grundstueck",
];

const TOTAL_MEA_PATTERN = /(\d[\d\s.,]*)\s*(?:miteigentums?|anteil?|MEA\s*st[ei]|stel)/i;

export class WegMeaDeclarationProcessor implements SectionProcessor {
    readonly sectionType = "weg.mea_declaration" as const;
    readonly description = "MEA declaration section (total co-ownership shares)";
    readonly isArrayBased = false;

    matches(section: PdfSection): number | null {
        if (section.lines.length > 15) return null;
        if (section.lines.length < 1) return null;

        const fullText = section.heading.text + "\n" + section.rawText;

        const declarationPattern =
            /(\d[\d\s.,]*)\s*(?:miteigentumsanteile?|MEA)|\b(?:miteigentumsanteile?|MEA)\s*[:(]?\s*(\d[\d\s.,]*)/i;

        if (declarationPattern.test(fullText)) return 0.9;

        const hasMeaKeyword = containsAnyKeyword(fullText, [
            "miteigentumsanteile", "MEA", "zerlegt", "anteile", "miteigentumsanteile"
        ]);

        if (!hasMeaKeyword) return null;
        if (TOTAL_MEA_PATTERN.test(fullText)) return 0.7;
    
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: MEA_KEYWORDS,
            contentKeywords: MEA_KEYWORDS,
        });

        if (!hasPattern) return null;

        return calculateKeywordConfidence(fullText, MEA_KEYWORDS);
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
