import type { PdfSection } from "../raw/types";
import type { SectionProcessor, ProcessedSection, SectionItem } from "./types";
import {
    hasStructuralPattern,
    linesToPositions,
    extractHeadingText,
    calculateKeywordConfidence,
    findLinesForBlock,
} from "./base";
import { normalizeForMatch } from "../utils/text";

/**
 * Keywords that signal a combined administration section
 * (contains both property-manager AND accountant sub-blocks).
 */
const HEADING_KEYWORDS = [
    "verwalter",
    "verwaltung",
    "hausverwaltung",
];

const ACCOUNTANT_KEYWORDS = [
    "buchhaltung",
    "abrechnung",
    "buchfuehrung",
];

/** Keywords to detect the manager sub-block, e.g. "(1) WEG-Verwalter" */
const MANAGER_BLOCK_KEYWORDS = [
    "verwalter",
    "verwaltung",
    "hausverwaltung",
];

/**
 * Detects an enumerated sub-block start, e.g. "(2) Buchhaltung" or "(1) WEG-Verwalter".
 * Returns the 0-based line index inside `section.lines` or -1.
 *
 * When `requireEnum` is true, only matches lines that start with a parenthesised
 * number like "(1)" or "(2)".  This prevents matching the section heading itself
 * (which also contains the keyword but is not a sub-block marker).
 */
function findSubBlockStart(
    section: PdfSection,
    keywords: string[],
    searchFrom = 0,
    requireEnum = false,
): number {
    for (let i = searchFrom; i < section.lines.length; i++) {
        const raw = section.lines[i]!.text.trim();
        const norm = normalizeForMatch(raw);
        if (!norm) continue;

        const hasEnum = /^\(\d+\)/.test(raw) || /^\{\d+\}/.test(raw);
        const hasKeyword = keywords.some((kw) => norm.includes(normalizeForMatch(kw)));

        if (hasEnum && hasKeyword) return i;
        // Non-enumerated fallback: only if requireEnum is off, and skip line 0
        // (the heading) to avoid false positives.
        if (!requireEnum && hasKeyword && i > 0) return i;
    }
    return -1;
}

export class WegAdministrationCombinedProcessor implements SectionProcessor {
    readonly sectionType = "weg.administration" as const;
    readonly description = "Combined administration section (property manager + accountant)";
    readonly isArrayBased = true;

    matches(section: PdfSection): number | null {
        if (section.lines.length < 4) return null;

        // Heading must mention management / Verwaltung
        const hasManagerHeading = hasStructuralPattern(section, {
            headingKeywords: HEADING_KEYWORDS,
            minLines: 4,
        });
        if (!hasManagerHeading) return null;

        // Body must ALSO contain accountant keywords — that's what makes this
        // a *combined* section rather than a plain property-manager section.
        const bodyNorm = normalizeForMatch(section.rawText);
        const hasAccountant = ACCOUNTANT_KEYWORDS.some((kw) =>
            bodyNorm.includes(normalizeForMatch(kw))
        );
        if (!hasAccountant) return null;

        // Calculate confidence — boost because we matched both halves
        const managerConf = calculateKeywordConfidence(
            section.heading.text + " " + section.rawText,
            HEADING_KEYWORDS,
        );
        const accountantConf = calculateKeywordConfidence(
            section.rawText,
            ACCOUNTANT_KEYWORDS,
        );

        // Combined confidence should be higher than either individual processor
        return Math.min(managerConf + accountantConf * 0.5, 1.0);
    }

    async process(section: PdfSection): Promise<ProcessedSection> {
        const sectionPositions = linesToPositions(section.lines);

        // Find where each enumerated sub-block begins.
        // requireEnum = true so we match "(1) WEG-Verwalter" but NOT the
        // section heading "§ 5 … Verwaltung …" which also contains the keyword.
        const managerStart = findSubBlockStart(section, MANAGER_BLOCK_KEYWORDS, 0, true);
        const accountantStart = findSubBlockStart(section, ACCOUNTANT_KEYWORDS, Math.max(managerStart + 1, 1));

        const items: SectionItem[] = [];

        if (managerStart >= 0 && accountantStart > managerStart) {
            // Both sub-blocks found — slice precisely
            const managerLines = section.lines.slice(managerStart, accountantStart);
            const accountantLines = section.lines.slice(accountantStart);

            const managerText = managerLines.map((l) => l.text).join("\n").trim();
            const accountantText = accountantLines.map((l) => l.text).join("\n").trim();

            items.push({
                id: `property-manager-${Date.now()}`,
                rawText: managerText,
                sectionType: "weg.property_manager",
                state: "needs_review",
                confidence: 0.85,
                textPosition: linesToPositions(managerLines),
            });

            items.push({
                id: `accountant-${Date.now() + 1}`,
                rawText: accountantText,
                sectionType: "weg.accountant",
                state: "needs_review",
                confidence: 0.85,
                textPosition: linesToPositions(accountantLines),
            });
        } else if (accountantStart > 0) {
            // Only accountant marker found — manager is everything before it (skip heading line 0)
            const managerLines = section.lines.slice(1, accountantStart);
            const accountantLines = section.lines.slice(accountantStart);

            items.push({
                id: `property-manager-${Date.now()}`,
                rawText: managerLines.map((l) => l.text).join("\n").trim(),
                sectionType: "weg.property_manager",
                state: "needs_review",
                confidence: 0.75,
                textPosition: linesToPositions(managerLines),
            });

            items.push({
                id: `accountant-${Date.now() + 1}`,
                rawText: accountantLines.map((l) => l.text).join("\n").trim(),
                sectionType: "weg.accountant",
                state: "needs_review",
                confidence: 0.85,
                textPosition: linesToPositions(accountantLines),
            });
        } else {
            // Fallback: couldn't split, treat entire section as manager
            items.push({
                id: `property-manager-${Date.now()}`,
                rawText: section.rawText.trim(),
                sectionType: "weg.property_manager",
                state: "needs_review",
                confidence: 0.7,
                textPosition: sectionPositions,
            });
        }

        return {
            rawText: section.rawText.trim(),
            headingText: extractHeadingText(section.heading.text || section.rawText),
            sectionType: this.sectionType,
            confidence: 0.85,
            renderable: false,
            textPosition: sectionPositions,
            items,
        };
    }
}
