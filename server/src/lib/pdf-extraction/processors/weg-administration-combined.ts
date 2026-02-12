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
    "administration",
    "property manager",
    "accountant",
];

const ACCOUNTANT_KEYWORDS = [
    "buchhaltung",
    "abrechnung",
    "buchfuehrung",
    "accountant",
    "bookkeeping",
    "finance",
];

const MANAGER_KEYWORDS = [
    "verwalter",
    "verwaltung",
    "hausverwaltung",
    "property manager",
    "manager",
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
    readonly propertyTypeScope = "ANY" as const;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 4) return null;
        if (!containsAnyKeyword(section.heading.text, ADMIN_HEADING_KEYWORDS)) return null;

        const bodyNorm = normalizeForMatch(section.rawText);
        const hasManager = MANAGER_KEYWORDS.some((keyword) => bodyNorm.includes(keyword));
        const hasAccountant = ACCOUNTANT_KEYWORDS.some((keyword) => bodyNorm.includes(keyword));

        if (!hasManager && !hasAccountant) return null;

        const hasEnum = section.lines.some((l) => ENUM_MARKER_RE.test(l.text));
        const roleBlocks = splitAtRoleHeadings(section.lines);
        if (!hasEnum && roleBlocks.length < 2) return null;

        return 0.75;
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        const enumBlocks = splitAtEnumMarkers(section.lines);
        const roleBlocks = splitAtRoleHeadings(section.lines);
        const subBlocks = enumBlocks.length > 0 ? enumBlocks : roleBlocks;
        const sectionPositions = linesToPositions(section.lines);

        const items: SectionItem[] = [];

        for (let i = 0; i < subBlocks.length; i++) {
            const block = subBlocks[i]!;
            const blockText = block.lines.map((l) => l.text).join("\n");

            const firstLineNorm = normalizeForMatch(block.lines[0]?.text ?? "");
            const fullBlockNorm = normalizeForMatch(blockText);

            let subType: "weg.property_manager" | "weg.accountant" | null = block.roleHint ?? null;
            if (!subType && ACCOUNTANT_KEYWORDS.some((keyword) => firstLineNorm.includes(keyword))) {
                subType = "weg.accountant";
            } else if (!subType && MANAGER_KEYWORDS.some((keyword) => firstLineNorm.includes(keyword))) {
                subType = "weg.property_manager";
            }

            if (!subType) {
                if (ACCOUNTANT_KEYWORDS.some((keyword) => fullBlockNorm.includes(keyword)))
                    subType = "weg.accountant";
                else if (MANAGER_KEYWORDS.some((keyword) => fullBlockNorm.includes(keyword))) 
                    subType = "weg.property_manager";
            }

            if (!subType) continue;
            if (!containsEntityReference(blockText)) continue;

            items.push({
                id: `admin-${subType.split(".")[1]}-${Date.now()}-${i}`,
                rawText: blockText.trim(),
                sectionType: subType,
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
function splitAtEnumMarkers(lines: PdfLine[]): Array<{ lines: PdfLine[]; roleHint?: "weg.property_manager" | "weg.accountant" }> {
    const blocks: Array<{ lines: PdfLine[]; roleHint?: "weg.property_manager" | "weg.accountant" }> = [];
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

function detectRoleHint(text: string): "weg.property_manager" | "weg.accountant" | null {
    const normalized = normalizeForMatch(text);
    if (ACCOUNTANT_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "weg.accountant";
    if (MANAGER_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "weg.property_manager";
    return null;
}

function splitAtRoleHeadings(lines: PdfLine[]): Array<{ lines: PdfLine[]; roleHint?: "weg.property_manager" | "weg.accountant" }> {
    const blocks: Array<{ lines: PdfLine[]; roleHint?: "weg.property_manager" | "weg.accountant" }> = [];
    let current: { lines: PdfLine[]; roleHint?: "weg.property_manager" | "weg.accountant" } | null = null;

    for (const line of lines) {
        const roleHint = detectRoleHint(line.text);
        if (roleHint) {
            if (current && current.lines.length > 0) blocks.push(current);
            current = { lines: [line], roleHint };
            continue;
        }
        if (current) current.lines.push(line);
    }

    if (current && current.lines.length > 0) blocks.push(current);
    return blocks;
}
