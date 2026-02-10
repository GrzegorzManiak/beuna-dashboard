import type { PdfLine } from "./types";
import { mean, median, percentile, stdDev } from "../utils/math";

type LineStats = {
    fontSize: {
        mean: number;
        median: number;
        std: number;
        p75: number;
        p90: number;
    };
    height: {
        median: number;
    };
    gap: {
        median: number;
    };
    leftMargin: number;
    pageWidth: Map<number, number>;
    gapAbove: Map<number, number>;
};

function computeLineStats(lines: PdfLine[]): LineStats {
    const fontSizes = lines.map((line) => line.fontSize);
    const heights = lines.map((line) => line.height);

    const fontMean = mean(fontSizes);
    const fontMedian = median(fontSizes);
    const fontStd = stdDev(fontSizes, fontMean);

    const gapAbove = new Map<number, number>();
    const gaps: number[] = [];
    const pageWidth = new Map<number, number>();
    const byPage = new Map<number, PdfLine[]>();

    for (const line of lines) {
        if (!byPage.has(line.page)) byPage.set(line.page, []);
        byPage.get(line.page)!.push(line);
        const width = line.x + line.width;
        pageWidth.set(line.page, Math.max(pageWidth.get(line.page) ?? 0, width));
    }

    for (const pageLines of byPage.values()) {
        const sorted = [...pageLines].sort((a, b) => a.y - b.y);
        for (let i = 1; i < sorted.length; i += 1) {
            const prev = sorted[i - 1];
            const current = sorted[i];
            if (!prev || !current) continue;
            const gap = current.y - prev.y;
            if (gap >= 0) {
                gaps.push(gap);
                gapAbove.set(current.id, gap);
            }
        }
    }

    const bodyCandidates = lines.filter((line) => line.tokens.length >= 6);
    const marginPool = bodyCandidates.length ? bodyCandidates : lines;
    const leftMargin = median(marginPool.map((line) => line.x));

    return {
        fontSize: {
            mean: fontMean,
            median: fontMedian,
            std: fontStd,
            p75: percentile(fontSizes, 0.75),
            p90: percentile(fontSizes, 0.9),
        },
        height: {
            median: median(heights),
        },
        gap: {
            median: median(gaps),
        },
        leftMargin,
        pageWidth,
        gapAbove,
    };
}

export {
    computeLineStats,
    type LineStats,
};
