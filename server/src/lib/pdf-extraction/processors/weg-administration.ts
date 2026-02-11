import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
    containsEntityReference,
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
    readonly propertyTypeScope = "WEG" as const;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 2) return null;
        
        const hasPattern = hasStructuralPattern(section, {
            headingKeywords: MANAGER_KEYWORDS,
            minLines: 2,
        });
        
        if (!hasPattern) return null;

        // The section must reference a legal entity (GmbH, AG, KG, etc.)
        // to be treated as a property manager appointment.  Without an
        // entity the section is just a generic administration heading.
        if (!containsEntityReference(section.rawText)) return null;
        
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
