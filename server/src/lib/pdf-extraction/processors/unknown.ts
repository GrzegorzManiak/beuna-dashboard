import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection } from "./types";
import { linesToPositions, extractHeadingText } from "./base";

/**
 * Fallback processor for sections that don't match any specific type
 */
export class UnknownProcessor implements SectionProcessor {
    readonly sectionType = "unknown" as const;
    readonly description = "Unclassified section";
    readonly isArrayBased = false;

    matches(_section: PdfSection): number {
        // Always matches as fallback with low confidence
        return 0.1;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.rawText),
            sectionType: this.sectionType,
            confidence: 0.1,
            renderable: false,
            textPosition: linesToPositions(section.lines),
        };
    }
}
