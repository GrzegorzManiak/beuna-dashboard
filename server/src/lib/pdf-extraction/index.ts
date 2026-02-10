import { extractPdfTextItems } from "./raw/pdf";
import { buildLines, type LineBuildOptions } from "./raw/lines";
import { computeLineStats } from "./raw/line-stats";
import { scoreHeadings, type HeadingConfig } from "./raw/heading-score";
import { selectPrimaryHeadings } from "./raw/heading-levels";
import { buildSections, type SectionBuildOptions } from "./raw/sections";
import type { PdfLine, PdfSection } from "./raw/types";
import { classifySections, type SectionClassificationResult, type SectionType } from "./llm/classify-sections";

type ExtractSectionsOptions = {
    lineBuild?: LineBuildOptions;
    heading?: HeadingConfig;
    section?: SectionBuildOptions;
    headingLevel?: "primary" | "all";
};

type ExtractSectionsResult = {
    sections: PdfSection[];
    lines: PdfLine[];
    headings: PdfLine[];
    headingThreshold: number;
};

async function extractSectionsFromPdf(
    pdfPath: string,
    options: ExtractSectionsOptions = {},
): Promise<ExtractSectionsResult> {
    const items = await extractPdfTextItems(pdfPath);
    const lines = buildLines(items, options.lineBuild);
    const stats = computeLineStats(lines);
    const headingResult = scoreHeadings(lines, stats, options.heading);
    const headingCandidates = headingResult.headings.map((entry) => entry.line);
    const headings =
        options.headingLevel === "all"
            ? headingCandidates
            : selectPrimaryHeadings(headingCandidates);
    const sections = buildSections(lines, headings, stats, options.section);

    return {
        sections,
        lines,
        headings,
        headingThreshold: headingResult.threshold,
    };
}

export {
    extractSectionsFromPdf,
    type ExtractSectionsOptions,
    type ExtractSectionsResult,
    classifySections,
    type SectionClassificationResult,
    type SectionType,
};
