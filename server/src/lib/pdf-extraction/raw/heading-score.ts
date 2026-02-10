import type { PdfLine } from "./types";
import type { LineStats } from "./line-stats";
import { clamp, mean, stdDev } from "../utils/math";
import { uppercaseRatio, titleCaseRatio } from "../utils/text";
import { leadingEnumerationScore } from "../utils/structure";

type HeadingScore = {
    line: PdfLine;
    score: number;
    features: {
        fontRank: number;
        fontSize: number;
        height: number;
        bold: number;
        caps: number;
        short: number;
        gap: number;
        align: number;
        enumeration: number;
        title: number;
        listPenalty: number;
    };
};

type HeadingConfig = {
    minScore?: number;
    stdMultiplier?: number;
    maxHeadingRatio?: number;
};

const HEADING_SCORE_WEIGHTS = {
    fontRank: 0.4,
    heightRank: 0.1,
    boldScore: 0.1,
    capsScore: 0.08,
    titleScore: 0.05,
    shortScore: 0.1,
    gapScore: 0.1,
    alignScore: 0.05,
    enumerationScore: 0.02,
};

const percentileRank = (values: number[], value: number) => {
    if (!values.length) return 0;
    let below = 0;
    for (const v of values) if (v <= value) below += 1;
    return below / values.length;
};

const scoreLine = (line: PdfLine, stats: LineStats, fontSizes: number[]) => {
    const fontRank = percentileRank(fontSizes, line.fontSize);
    const heightRank = clamp(line.height / Math.max(stats.height.median, 1));
    const boldScore = line.bold ? 1 : 0;
    const capsScore = uppercaseRatio(line.text);
    const titleScore = titleCaseRatio(line.tokens);
    const shortScore = clamp(1 - Math.max(0, line.tokens.length - 8) / 8);

    const gap = stats.gapAbove.get(line.id) ?? stats.gap.median;
    const gapScore = clamp((gap / Math.max(stats.gap.median, 1) - 1) / 1.5);

    const leftDistance = Math.abs(line.x - stats.leftMargin);
    const leftScore = clamp(1 - leftDistance / Math.max(1, stats.leftMargin * 0.5));

    const pageWidth = stats.pageWidth.get(line.page) ?? 0;
    const center = line.x + line.width / 2;
    const centerDistance = pageWidth ? Math.abs(center - pageWidth / 2) : 0;
    const centerScore = pageWidth
        ? clamp(1 - centerDistance / Math.max(1, pageWidth / 2))
        : 0;

    const alignScore = Math.max(leftScore, centerScore * 0.9);
    const enumerationScore = leadingEnumerationScore(line.text);
    const trimmed = line.text.trim();
    const listPenalty = trimmed.startsWith("•") || trimmed.startsWith("-") ? 0.2 : 0;

    const score =
        fontRank * HEADING_SCORE_WEIGHTS.fontRank +
        heightRank * HEADING_SCORE_WEIGHTS.heightRank +
        boldScore * HEADING_SCORE_WEIGHTS.boldScore +
        capsScore * HEADING_SCORE_WEIGHTS.capsScore +
        titleScore * HEADING_SCORE_WEIGHTS.titleScore +
        shortScore * HEADING_SCORE_WEIGHTS.shortScore +
        gapScore * HEADING_SCORE_WEIGHTS.gapScore +
        alignScore * HEADING_SCORE_WEIGHTS.alignScore +
        enumerationScore * HEADING_SCORE_WEIGHTS.enumerationScore -
        listPenalty;

    return {
        line,
        score: clamp(score),
        features: {
            fontRank,
            fontSize: fontRank,
            height: heightRank,
            bold: boldScore,
            caps: capsScore,
            title: titleScore,
            short: shortScore,
            gap: gapScore,
            align: alignScore,
            enumeration: enumerationScore,
            listPenalty,
        },
    } satisfies HeadingScore;
};

function scoreHeadings(
    lines: PdfLine[],
    stats: LineStats,
    config: HeadingConfig = {},
) {
    const fontSizes = lines.map((line) => line.fontSize);
    const scored = lines.map((line) => scoreLine(line, stats, fontSizes));
    const scores = scored.map((item) => item.score);

    const baseMean = mean(scores);
    const baseStd = stdDev(scores, baseMean);

    const minScore = config.minScore ?? 0.58;
    const stdMultiplier = config.stdMultiplier ?? 0.6;
    const maxHeadingRatio = config.maxHeadingRatio ?? 0.2;

    let threshold = Math.max(minScore, baseMean + baseStd * stdMultiplier);

    const isEligibleHeading = (item: HeadingScore) => {
        const { fontRank, bold, enumeration } = item.features;
        return fontRank >= 0.6 || bold >= 1 || enumeration >= 0.8;
    };

    let headings = scored.filter(
        (item) => item.score >= threshold && isEligibleHeading(item),
    );

    if (!headings.length) {
        threshold = Math.max(minScore - 0.08, baseMean);
        headings = scored.filter(
            (item) => item.score >= threshold && isEligibleHeading(item),
        );
    }

    if (headings.length > lines.length * maxHeadingRatio) {
        const sortedScores = [...scores].sort((a, b) => a - b);
        const idx = Math.floor(sortedScores.length * (1 - maxHeadingRatio));
        threshold = Math.max(threshold, sortedScores[idx] ?? threshold);
        headings = scored.filter(
            (item) => item.score >= threshold && isEligibleHeading(item),
        );
    }

    return { scored, headings, threshold };
}

export {
    scoreLine,
    scoreHeadings,
    type HeadingScore,
    type HeadingConfig,
};
