import type { PdfSection, PdfLine } from "../raw/types";
import type { SectionProcessor, ProcessedSection, SectionItem } from "./types";
import {
    containsAnyKeyword,
    linesToPositions,
    extractHeadingText,
    containsEntityReference,
} from "./base";
import { normalizeForMatch } from "../utils/text";

const ADMIN_HEADING_KEYWORDS = [
    "verwaltung",
    "verwalter",
    "hausverwaltung",
];

const ACCOUNTANT_KEYWORDS = [
    "buchhaltung",
    "abrechnung",
    "buchfuehrung",
];

/**
 * Regex that matches enumeration markers like "(1)", "(2)", etc.
 * Used to find the start of sub-blocks inside a combined admin section.
 */
const ENUM_MARKER_RE = /^\s*\(\d+\)\s/;

/**
 * Combined administration processor.
 *
 * Handles the common German WEG pattern where both the property manager
 * and accountant appointments live inside a single section (e.g.
 * "§ 5 Erstbestellung von Verwaltung und Buchhaltung").
 *
 * The processor:
 *   1. Only matches when the section heading contains admin keywords
 *      AND the body contains both manager and accountant indicators.
 *   2. Splits the section at enumeration markers `(1)`, `(2)`, etc.
 *   3. Classifies each sub-block as `weg.property_manager` or
 *      `weg.accountant` based on keyword content.
 *   4. Only emits an item if the sub-block references a legal entity
 *      (GmbH, AG, KG, etc.).
 */
export class WegAdministrationCombinedProcessor implements SectionProcessor {
    readonly sectionType = "weg.property_manager" as const;
    readonly description = "Combined administration section (manager + accountant)";
    readonly isArrayBased = true;
    readonly propertyTypeScope = "WEG" as const;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 4) return null;

        // Heading must contain an admin keyword
        if (!containsAnyKeyword(section.heading.text, ADMIN_HEADING_KEYWORDS)) return null;

        // Body must contain both manager AND accountant indicators
        const bodyNorm = normalizeForMatch(section.rawText);
        const hasManager =
            bodyNorm.includes("verwalter") ||
            bodyNorm.includes("verwaltung") ||
            bodyNorm.includes("hausverwaltung");
        const hasAccountant =
            bodyNorm.includes("buchhaltung") ||
            bodyNorm.includes("abrechnung") ||
            bodyNorm.includes("buchfuehrung");

        if (!hasManager || !hasAccountant) return null;

        // Must have at least one enumeration marker to split on
        const hasEnum = section.lines.some((l) => ENUM_MARKER_RE.test(l.text));
        if (!hasEnum) return null;

        // Higher confidence than the individual processors so we win the bid
        return 0.75;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        const subBlocks = splitAtEnumMarkers(section.lines);
        const sectionPositions = linesToPositions(section.lines);

        const items: SectionItem[] = [];

        for (let i = 0; i < subBlocks.length; i++) {
            const block = subBlocks[i]!;
            const blockText = block.lines.map((l) => l.text).join("\n");

            // Use the first line (the enumeration marker line) for sub-type
            // classification.  This avoids false matches from incidental
            // mentions of "Verwalter" inside the accountant block or vice
            // versa.
            const firstLineNorm = normalizeForMatch(block.lines[0]?.text ?? "");
            const fullBlockNorm = normalizeForMatch(blockText);

            // Determine sub-type — check accountant first since "Verwalter"
            // can appear in the accountant body as a passing reference.
            let subType: "weg.property_manager" | "weg.accountant" | null = null;
            if (
                firstLineNorm.includes("buchhaltung") ||
                firstLineNorm.includes("abrechnung") ||
                firstLineNorm.includes("buchfuehrung") ||
                firstLineNorm.includes("buchfuhrung") ||
                firstLineNorm.includes("accountant")
            ) {
                subType = "weg.accountant";
            } else if (
                firstLineNorm.includes("verwalter") ||
                firstLineNorm.includes("verwaltung") ||
                firstLineNorm.includes("hausverwaltung") ||
                firstLineNorm.includes("property manager")
            ) {
                subType = "weg.property_manager";
            }

            // Fallback: try the full block text if the first line wasn't enough
            if (!subType) {
                if (
                    fullBlockNorm.includes("buchhaltung") ||
                    fullBlockNorm.includes("abrechnung") ||
                    fullBlockNorm.includes("buchfuehrung")
                ) {
                    subType = "weg.accountant";
                } else if (
                    fullBlockNorm.includes("verwalter") ||
                    fullBlockNorm.includes("verwaltung") ||
                    fullBlockNorm.includes("hausverwaltung")
                ) {
                    subType = "weg.property_manager";
                }
            }

            // Skip blocks we can't classify or that lack an entity reference
            if (!subType) continue;
            if (!containsEntityReference(blockText)) continue;

            items.push({
                id: `admin-${subType.split(".")[1]}-${Date.now()}-${i}`,
                rawText: blockText.trim(),
                sectionType: subType,
                state: "needs_review",
                confidence: 0.8,
                textPosition: linesToPositions(block.lines),
            });
        }

        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.heading.text || section.rawText),
            sectionType: this.sectionType,
            confidence: 0.75,
            renderable: false, // container is not rendered; items are
            textPosition: sectionPositions,
            items,
        };
    }
}

/**
 * Split an array of PdfLines at enumeration markers like `(1)`, `(2)`, etc.
 * Returns one sub-block per marker.  Lines before the first marker are
 * discarded (they're usually the heading / intro paragraph).
 */
function splitAtEnumMarkers(lines: PdfLine[]): Array<{ lines: PdfLine[] }> {
    const blocks: Array<{ lines: PdfLine[] }> = [];
    let current: PdfLine[] | null = null;

    for (const line of lines) {
        if (ENUM_MARKER_RE.test(line.text)) {
            // Start a new block
            if (current && current.length > 0) {
                blocks.push({ lines: current });
            }
            current = [line];
        } else if (current) {
            current.push(line);
        }
        // Lines before the first marker are skipped
    }

    // Push the last block
    if (current && current.length > 0) {
        blocks.push({ lines: current });
    }

    return blocks;
}
