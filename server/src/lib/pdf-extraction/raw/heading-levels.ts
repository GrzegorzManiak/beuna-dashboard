import type { PdfLine } from "./types";
import { percentile } from "../utils/math";
import { leadingEnumerationScore } from "../utils/structure";

type HeadingLevelOptions = {
    minPrimaryCount?: number;
};

function selectPrimaryHeadings(
    headings: PdfLine[],
    options: HeadingLevelOptions = {},
) {
    if (headings.length < 3) return headings;

    const sizes = headings.map((line) => line.fontSize);
    const p75 = percentile(sizes, 0.75);
    const p9 = percentile(sizes, 0.9);
    const threshold = (p75 + p9) / 2;

    const minPrimaryCount = options.minPrimaryCount ?? 3;

    const filtered = headings.filter((line) => {
        const enumScore = leadingEnumerationScore(line.text);
        if (line.text.includes("§")) return true;
        if (enumScore >= 0.8) return true;
        return line.fontSize >= threshold;
    });

    return filtered.length >= minPrimaryCount ? filtered : headings;
}

export {
    selectPrimaryHeadings,
    type HeadingLevelOptions,
};
