import type { PdfLine, PdfTextItem } from "./types";
import { median } from "../utils/math";
import { isBoldFontName, splitTokens } from "../utils/text";

type LineBuildOptions = {
    yToleranceRatio?: number;
    xGapRatio?: number;
};

const DEFAULT_OPTIONS: Required<LineBuildOptions> = {
    yToleranceRatio: 0.35,
    xGapRatio: 0.25,
};

const finalizeLine = (
    items: PdfTextItem[],
    lineId: number,
    xGapRatio: number,
): PdfLine | null => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    if (!first) return null;

    let text = "";
    let prev: PdfTextItem | undefined;
    for (const item of sorted) {
        if (prev) {
            const gap = item.x - (prev.x + prev.width);
            const avgCharWidth = prev.width / Math.max(prev.text.length, 1);
            const gapThreshold = Math.max(
                avgCharWidth * 0.5,
                prev.fontSize * xGapRatio,
            );
            if (gap > gapThreshold) text += " ";
        }
        text += item.text;
        prev = item;
    }

    if (!text.trim()) return null;

    const fontSizes = sorted.map((item) => item.fontSize);
    const heights = sorted.map((item) => item.height);
    const fontSize = median(fontSizes);
    const height = Math.max(...heights, 0);
    const x = Math.min(...sorted.map((item) => item.x));
    const right = Math.max(...sorted.map((item) => item.x + item.width));
    const width = right - x;

    const fontCounts = new Map<string, number>();
    for (const item of sorted) {
        const name = item.fontName || "";
        fontCounts.set(name, (fontCounts.get(name) ?? 0) + 1);
    }
    let fontName = "";
    let maxCount = 0;
    for (const [name, count] of fontCounts.entries()) {
        if (count > maxCount) {
            maxCount = count;
            fontName = name;
        }
    }

    return {
        id: lineId,
        page: first.page,
        text,
        tokens: splitTokens(text),
        x,
        y: first.y,
        width,
        height,
        fontSize,
        fontName,
        bold: isBoldFontName(fontName),
    };
};

function buildLines(
    items: PdfTextItem[],
    options: LineBuildOptions = {},
): PdfLine[] {
    const merged: PdfLine[] = [];
    const { yToleranceRatio, xGapRatio } = { ...DEFAULT_OPTIONS, ...options };

    const itemsByPage = new Map<number, PdfTextItem[]>();
    for (const item of items) {
        if (!itemsByPage.has(item.page)) itemsByPage.set(item.page, []);
        itemsByPage.get(item.page)!.push(item);
    }

    let lineId = 0;
    for (const pageItems of itemsByPage.values()) {
        const fontSizes = pageItems.map((item) => item.fontSize);
        const medianFontSize = median(fontSizes) || 1;
        const yTolerance = medianFontSize * yToleranceRatio;

        const sorted = [...pageItems].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        let current: PdfTextItem[] = [];
        let currentY = 0;

        for (const item of sorted) {
            if (!current.length) {
                current = [item];
                currentY = item.y;
                if (item.hasEOL) {
                    const line = finalizeLine(current, lineId++, xGapRatio);
                    if (line) merged.push(line);
                    current = [];
                }
                continue;
            }

            const yDelta = Math.abs(item.y - currentY);
            if (yDelta <= yTolerance) {
                current.push(item);
                currentY = (currentY * (current.length - 1) + item.y) / current.length;
                if (item.hasEOL) {
                    const line = finalizeLine(current, lineId++, xGapRatio);
                    if (line) merged.push(line);
                    current = [];
                }
            } else {
                const line = finalizeLine(current, lineId++, xGapRatio);
                if (line) merged.push(line);
                current = [item];
                currentY = item.y;
                if (item.hasEOL) {
                    const flushed = finalizeLine(current, lineId++, xGapRatio);
                    if (flushed) merged.push(flushed);
                    current = [];
                }
            }
        }

        const tail = finalizeLine(current, lineId++, xGapRatio);
        if (tail) merged.push(tail);
    }

    return merged.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
}

export {
    buildLines,
    type LineBuildOptions,
};
