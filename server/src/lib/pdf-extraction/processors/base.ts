import type { PdfSection, PdfLine, Position } from "../raw/types";
import { normalizeForMatch } from "../utils/text";

/**
 * Utility functions for section processors
 */

/**
 * Regex that matches common German / international company-type suffixes.
 * Used to verify that a section references a real legal entity.
 */
const ENTITY_SUFFIX_RE =
    /\b(gmbh|ag|kg|ug|gbr|ohg|e\.?\s?v\.?|ev|ltd|inc|llc|s\.?a\.?r\.?l\.?|s\.?a\.?|co\.?\s?kg|gmbh\s?&\s?co)\b/i;

/**
 * Returns `true` when `text` contains at least one entity-type reference
 * (e.g. "GmbH", "AG", "KG", "e.V.", etc.).
 */
export function containsEntityReference(text: string): boolean {
    return ENTITY_SUFFIX_RE.test(text);
}

/**
 * Converts PDF lines to highlight positions grouped by page
 */
export function linesToPositions(lines: PdfLine[]): Position[] {
    if (!lines.length) return [];
    
    const byPage = new Map<number, PdfLine[]>();
    for (const line of lines) {
        if (!byPage.has(line.page)) byPage.set(line.page, []);
        byPage.get(line.page)!.push(line);
    }

    const positions: Position[] = [];
    for (const [page, pageLines] of byPage.entries()) {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxRight = Number.NEGATIVE_INFINITY;
        let maxBottom = Number.NEGATIVE_INFINITY;

        for (const line of pageLines) {
            minX = Math.min(minX, line.x);
            minY = Math.min(minY, line.y);
            maxRight = Math.max(maxRight, line.x + line.width);
            maxBottom = Math.max(maxBottom, line.y + line.height);
        }

        if (Number.isFinite(minX) && Number.isFinite(minY)) {
            positions.push({
                page,
                x: minX,
                y: minY,
                width: Math.max(0, maxRight - minX),
                height: Math.max(0, maxBottom - minY),
            });
        }
    }

    return positions.sort((a, b) => a.page - b.page);
}

/**
 * Checks if text contains any of the given keywords (case-insensitive, normalized)
 */
export function containsAnyKeyword(text: string, keywords: string[]): boolean {
    const normalized = normalizeForMatch(text);
    return keywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)));
}

/**
 * Checks if text matches a pattern (heading + content indicators)
 */
export function hasStructuralPattern(section: PdfSection, options: {
    headingKeywords?: string[];
    contentKeywords?: string[];
    minLines?: number;
    maxLines?: number;
}): boolean {
    const { headingKeywords = [], contentKeywords = [], minLines, maxLines } = options;
    
    // Check line count bounds
    if (minLines !== undefined && section.lines.length < minLines) return false;
    if (maxLines !== undefined && section.lines.length > maxLines) return false;
    
    // Check heading keywords if provided
    if (headingKeywords.length > 0) {
        const hasHeadingMatch = containsAnyKeyword(section.heading.text, headingKeywords);
        if (!hasHeadingMatch) return false;
    }
    
    // Check content keywords if provided
    if (contentKeywords.length > 0) {
        const hasContentMatch = containsAnyKeyword(section.rawText, contentKeywords);
        if (!hasContentMatch) return false;
    }
    
    return true;
}

/**
 * Extract heading text for display (first line or truncated raw text)
 */
export function extractHeadingText(rawText: string, maxLength = 120): string {
    const firstLine = rawText.split("\n")[0]?.trim();
    if (firstLine && firstLine.length <= maxLength) return firstLine;
    return rawText.slice(0, maxLength).trim();
}

/**
 * Calculate basic confidence based on keyword matches
 */
export function calculateKeywordConfidence(
    text: string,
    strongKeywords: string[],
    weakKeywords: string[] = []
): number {
    const normalized = normalizeForMatch(text);
    
    let strongMatches = 0;
    for (const keyword of strongKeywords) {
        if (normalized.includes(normalizeForMatch(keyword))) {
            strongMatches++;
        }
    }
    
    let weakMatches = 0;
    for (const keyword of weakKeywords) {
        if (normalized.includes(normalizeForMatch(keyword))) {
            weakMatches++;
        }
    }
    
    if (strongMatches === 0 && weakMatches === 0) return 0;
    
    // Weight strong keywords more heavily
    const score = (strongMatches * 0.8 + weakMatches * 0.2) / Math.max(strongKeywords.length + weakKeywords.length * 0.5, 1);
    return Math.min(score, 1.0);
}

/**
 * Given a block's raw text (from an LLM / regex extractor) and the parent
 * section, find the contiguous span of PdfLines that best covers the block.
 *
 * Strategy:
 *   1. Normalize each block line and each section line.
 *   2. Find the first section line that matches the first block line.
 *   3. Walk forward greedily, matching block lines to section lines.
 *   4. Return the matched PdfLine slice.
 *
 * The `searchStart` parameter lets callers advance a cursor so that
 * sequential blocks don't re-match the same lines.
 */
export function findLinesForBlock(
    section: PdfSection,
    blockText: string,
    searchStart = 0,
): { lines: PdfLine[]; nextCursor: number } {
    const blockLines = blockText
        .split("\n")
        .map((l) => normalizeForMatch(l))
        .filter(Boolean);

    if (!blockLines.length) return { lines: [], nextCursor: searchStart };

    const sectionLines = section.lines;

    // Find the first section line that matches the first block line
    let anchorIndex = -1;
    for (let i = searchStart; i < sectionLines.length; i++) {
        const norm = normalizeForMatch(sectionLines[i]!.text);
        if (!norm) continue;
        if (norm.includes(blockLines[0]!) || blockLines[0]!.includes(norm)) {
            anchorIndex = i;
            break;
        }
    }

    if (anchorIndex < 0) {
        // Fallback: try a looser token-overlap search
        return findLinesForBlockFuzzy(section, blockLines, searchStart);
    }

    // Walk forward matching remaining block lines
    let endIndex = anchorIndex;
    let blockCursor = 1;
    for (let i = anchorIndex + 1; i < sectionLines.length && blockCursor < blockLines.length; i++) {
        const norm = normalizeForMatch(sectionLines[i]!.text);
        if (!norm) continue;
        const blockLine = blockLines[blockCursor]!;
        if (norm.includes(blockLine) || blockLine.includes(norm)) {
            endIndex = i;
            blockCursor++;
        }
    }

    const matched = sectionLines.slice(anchorIndex, endIndex + 1);
    return { lines: matched, nextCursor: endIndex + 1 };
}

/**
 * Fuzzy fallback: score each section line window by token overlap with the
 * block text, and pick the best contiguous span.
 */
function findLinesForBlockFuzzy(
    section: PdfSection,
    blockLines: string[],
    searchStart: number,
): { lines: PdfLine[]; nextCursor: number } {
    const blockTokens = new Set(blockLines.flatMap((l) => l.split(/\s+/).filter((t) => t.length > 2)));
    if (!blockTokens.size) return { lines: [], nextCursor: searchStart };

    const sectionLines = section.lines;
    let bestStart = searchStart;
    let bestEnd = searchStart;
    let bestScore = 0;

    // Sliding window: try spans roughly the length of the block
    const windowSize = Math.max(blockLines.length, 3);

    for (let start = searchStart; start < sectionLines.length; start++) {
        const end = Math.min(start + windowSize * 2, sectionLines.length);
        let score = 0;
        for (let i = start; i < end; i++) {
            const tokens = normalizeForMatch(sectionLines[i]!.text).split(/\s+/);
            for (const token of tokens) {
                if (token.length > 2 && blockTokens.has(token)) score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestStart = start;
            bestEnd = end;
        }
    }

    if (bestScore === 0) return { lines: [], nextCursor: searchStart };

    const matched = sectionLines.slice(bestStart, bestEnd);
    return { lines: matched, nextCursor: bestEnd };
}

/**
 * Detect MEA declaration pattern in text
 * Looks for patterns like "Das Eigentum am Grundstück wird in X Miteigentumsanteile (MEA) zerlegt"
 */
export function containsMeaDeclaration(text: string): boolean {
    const normalized = normalizeForMatch(text);

    // Strong pattern: "eigentum am grundstück wird in X miteigentumsanteile zerlegt"
    const declarationPattern =
        /(?:das\s+)?eigentum\s+am\s+grundst(?:ü|ue)ck.*?wird\s+in\s+(\d[\d\s.,]*)\s*miteigentumsanteile?\s*\(?\s*MEA\s*\)?/i;

    if (declarationPattern.test(normalized)) return true;

    // Fallback: look for key MEA indicators together.
    // "mea" must appear as a standalone word/acronym (not as a substring of
    // another word) or as the full form "miteigentumsanteil(e)".  Area
    // measurements like "2 450 m" / "m²" / "qm" must NOT trigger this.
    const hasEigentum = normalized.includes("eigentum") && normalized.includes("grundst");
    const hasMea = normalized.includes("miteigentumsanteil") || /\bmea\b/i.test(normalized);
    const hasZerlegt = normalized.includes("zerlegt") || normalized.includes("geteilt");
    const hasNumber = /\b\d{3,5}\b/.test(text); // MEA count is usually 3-5 digits

    return hasEigentum && hasMea && (hasZerlegt || hasNumber);
}

/**
 * Find the line range that contains the MEA declaration within a section
 * Returns the start and end indices of the MEA paragraph
 */
export function findMeaDeclarationRange(section: PdfSection): { start: number; end: number } | null {
    const lines = section.lines;
    let meaStart = -1;
    let meaEnd = -1;

    // Look for the declaration pattern across consecutive lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const lineText = line.text;

        // Check if this line contains MEA indicators
        if (containsMeaDeclaration(lineText)) {
            meaStart = i;
            meaEnd = i;
            break;
        }
    }

    // If not found in single line, check multi-line patterns
    if (meaStart < 0) {
        // Check for MEA keywords across a window of lines
        for (let i = 0; i < lines.length - 1; i++) {
            const windowText = lines.slice(i, i + 4).map((l) => l.text).join(" ");
            if (containsMeaDeclaration(windowText)) {
                meaStart = i;
                // Find the end of the paragraph (look for unit entry indicators or blank lines)
                meaEnd = i;
                for (let j = i + 1; j < lines.length; j++) {
                    const text = lines[j]!.text;
                    // Stop if we hit a unit entry (Einheit Nr., etc.)
                    if (/(?:einheit|unit|wohnung)\s*(?:nr\.?|nummer|\d)/i.test(text)) {
                        break;
                    }
                    // Stop if we hit a major heading
                    if (text.includes("§") || (lines[j]!.bold && text.length < 50)) {
                        break;
                    }
                    meaEnd = j;
                }
                break;
            }
        }
    }

    if (meaStart >= 0 && meaEnd >= meaStart) {
        return { start: meaStart, end: meaEnd + 1 };
    }

    return null;
}

/**
 * Split a section into MEA declaration and remaining content
 * Returns an array of sections (MEA section first, then the rest)
 */
export function splitMeaDeclaration(section: PdfSection): PdfSection[] {
    const range = findMeaDeclarationRange(section);

    if (!range) {
        return [section];
    }

    // Check if MEA content is substantial enough to warrant a split
    const meaLines = section.lines.slice(range.start, range.end);
    if (meaLines.length < 1) {
        return [section];
    }

    // Create MEA declaration section
    const meaSection: PdfSection = {
        ...section,
        id: `${section.id}-mea`,
        heading: meaLines[0]!,
        lines: meaLines,
        rawText: meaLines.map((l) => l.text).join("\n"),
        textPosition: linesToPositions(meaLines),
    };

    // Create remaining section (if there are lines left)
    const remainingLines = [
        ...section.lines.slice(0, range.start),
        ...section.lines.slice(range.end),
    ];

    if (remainingLines.length === 0) {
        return [meaSection];
    }

    const remainingSection: PdfSection = {
        ...section,
        heading: remainingLines[0]!,
        lines: remainingLines,
        rawText: remainingLines.map((l) => l.text).join("\n"),
        textPosition: linesToPositions(remainingLines),
    };

    return [meaSection, remainingSection];
}
