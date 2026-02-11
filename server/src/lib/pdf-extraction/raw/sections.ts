import type { PdfLine, PdfSection, Position } from "./types";
import type { LineStats } from "./line-stats";
import { normalizeForMatch, splitTokens, uppercaseRatio, containsLetter } from "../utils/text";
import { leadingEnumerationScore } from "../utils/structure";

const isSimilarFont = (a: PdfLine, b: PdfLine) => {
    const ratio = Math.abs(a.fontSize - b.fontSize) / Math.max(a.fontSize, 1);
    return ratio <= 0.12;
};

const isNearby = (a: PdfLine, b: PdfLine, stats: LineStats) => {
    if (a.page !== b.page) return false;
    const gap = Math.abs(b.y - a.y);
    const threshold = Math.max(stats.gap.median * 1.2, a.fontSize * 1.4);
    return gap <= threshold;
};

const isAligned = (a: PdfLine, b: PdfLine) => {
    const xDelta = Math.abs(a.x - b.x);
    const widthDelta = Math.abs(a.width - b.width);
    return xDelta <= 16 || widthDelta <= 24;
};

const shouldMergeHeading = (a: PdfLine, b: PdfLine, stats: LineStats) =>
    isNearby(a, b, stats) && isSimilarFont(a, b) && isAligned(a, b);

const mergeHeadingLines = (lines: PdfLine[]): PdfLine => {
    const first = lines[0];
    if (!first) throw new Error("Heading merge requires at least one line.");
    const text = lines.map((line) => line.text).join(" ");
    const x = Math.min(...lines.map((line) => line.x));
    const right = Math.max(...lines.map((line) => line.x + line.width));
    const width = right - x;
    const fontSize =
        lines.reduce((sum, line) => sum + line.fontSize, 0) / lines.length;
    const height = Math.max(...lines.map((line) => line.height));
    const bold = lines.some((line) => line.bold);

    return {
        ...first,
        text,
        tokens: splitTokens(text),
        x,
        width,
        fontSize,
        height,
        bold,
    };
};

const linesToPositions = (lines: PdfLine[]): Position[] => {
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
};

const SECTION_HEADING_KEYWORDS = [
    "teilungserklaerung",
    "teilungsurkunde",
    "grundbuchstand",
    "grundbuch",
    "aufteilung",
    "sondernutzungsrecht",
    "gemeinschaftsordnung",
    "kosten",
    "verteilung",
    "verwalter",
    "verwaltung",
    "versicherung",
    "schlussbestimmung",
    "schluss",
    "bestimmung",
    "begruendung",
    "einleitung",
    "praeambel",
    "preambel",
    "objektbeschreibung",
    "gebaeude",
    "gebaude",
    "anlage",
];

const INLINE_LABEL_KEYWORDS = [
    "anschrift",
    "adresse",
    "address",
    "gemarkung",
    "flurstück",
    "flurstueck",
    "blatt",
    "grundstueck",
    "grundstück",
    "grundstuecksgroesse",
    "grundstücksgröße",
    "hrb",
    "handelsregister",
];

const UNIT_ENTRY_KEYWORDS = [
    "einheit",
    "wohnung",
    "stellplatz",
    "tiefgarage",
    "garage",
    "parking",
    "unit",
];

const UNIT_DETAIL_KEYWORDS = [
    "wohnflaeche",
    "wohnfläche",
    "wohnflache",
    "nutzflaeche",
    "nutzfläche",
    "nutzflache",
    "zimmer",
    "raeume",
    "räume",
    "raume",
    "keller",
    "kellerraum",
    "terrasse",
    "dachterrasse",
    "balkon",
    "miteigentumsanteil",
    "miteigentumsanteile",
    "mea",
];

type SectionBuildOptions = {
    includePreamble?: boolean;
};

function buildSections(
    lines: PdfLine[],
    headingLines: PdfLine[],
    stats: LineStats,
    options: SectionBuildOptions = {},
): PdfSection[] {
    const includePreamble = options.includePreamble ?? false;

    const isRealSectionHeading = (line: PdfLine) => {
        const normalized = normalizeForMatch(line.text);
        if (!normalized || !containsLetter(line.text)) return false;

        const tokens = line.tokens.length ? line.tokens : splitTokens(line.text);
        const hasSectionSymbol = line.text.includes("§");
        const hasHeadingKeyword = SECTION_HEADING_KEYWORDS.some((keyword) => normalized.includes(keyword));
        const hasUnitKeyword = UNIT_ENTRY_KEYWORDS.some((keyword) => normalized.includes(keyword));
        const enumScore = leadingEnumerationScore(line.text);
        const isEnumeratedUnitHeading =
            hasUnitKeyword
            && enumScore >= 0.7
            && tokens.length <= 8
            && !/\bnr\.?\b/i.test(line.text);
        if (hasUnitKeyword && /\d/.test(line.text) && !hasSectionSymbol && !isEnumeratedUnitHeading) return false;

        if (!hasSectionSymbol && INLINE_LABEL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return false;
        if (!hasSectionSymbol && !hasHeadingKeyword &&
            UNIT_DETAIL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return false;

        const hasArea = /\b\d{1,4}\s*(m²|m2|qm)\b/i.test(line.text);
        const hasRooms = /\bzimmer\b/i.test(line.text);
        if (!hasSectionSymbol && hasArea && (hasRooms || hasUnitKeyword)) return false;

        const capsScore = uppercaseRatio(line.text);
        const hasFraction = /\d+\s*\/\s*\d+/.test(line.text);
        if (hasFraction && !hasHeadingKeyword && enumScore < 1) return false;

        if (line.text.includes("§")) return true;
        if (hasHeadingKeyword) return true;
        if (capsScore >= 0.6 && tokens.length <= 10) return true;
        if (line.bold && tokens.length <= 12) return true;
        if (enumScore >= 0.7 && tokens.length <= 8) {
            if (line.fontSize >= stats.fontSize.p75 || capsScore >= 0.4) return true;
        }
        if (line.fontSize >= stats.fontSize.p90 && tokens.length <= 12) return true;
        return false;
    };

    const refinedHeadingLines = headingLines.filter((line) => isRealSectionHeading(line));
    const activeHeadings = refinedHeadingLines.length ? refinedHeadingLines : headingLines;
    const headingIds = new Set(activeHeadings.map((line) => line.id));
    const sections: PdfSection[] = [];
    let current: PdfSection | null = null;
    let sectionIndex = 0;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line) {
            i += 1;
            continue;
        }
        if (headingIds.has(line.id)) {
            const headingBlock: PdfLine[] = [line];
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j];
                if (!nextLine) break;
                if (!headingIds.has(nextLine.id)) break;
                const lastHeading = headingBlock[headingBlock.length - 1];
                if (!lastHeading) break;
                if (!shouldMergeHeading(lastHeading, nextLine, stats)) break;
                headingBlock.push(nextLine);
                j += 1;
            }

            const heading = headingBlock.length > 1 ? mergeHeadingLines(headingBlock) : line;
            const section = {
                id: `section-${sectionIndex++}`,
                heading,
                lines: [...headingBlock],
                rawText: "",
                textPosition: [],
            };
            current = section;
            sections.push(section);
            i = j;
            continue;
        }

        if (!current && includePreamble) {
            const section = {
                id: `section-${sectionIndex++}`,
                heading: line,
                lines: [line],
                rawText: "",
                textPosition: [],
            };
            current = section;
            sections.push(section);
        }

        if (current) current.lines.push(line);
        i += 1;
    }

    for (const section of sections) {
        section.rawText = section.lines.map((line) => line.text).join("\n");
        section.textPosition = linesToPositions(section.lines);
    }

    return sections;
}

export {
    buildSections,
    type SectionBuildOptions,
};
