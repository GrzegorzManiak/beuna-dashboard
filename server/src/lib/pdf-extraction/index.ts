import { extractPdfTextItems, extractPdfTextItemsFromBuffer } from "./raw/pdf";
import { buildLines, type LineBuildOptions } from "./raw/lines";
import { computeLineStats } from "./raw/line-stats";
import { scoreHeadings, type HeadingConfig } from "./raw/heading-score";
import { selectPrimaryHeadings } from "./raw/heading-levels";
import { buildSections, type SectionBuildOptions } from "./raw/sections";
import type { PdfLine, PdfSection } from "./raw/types";
import { classifySections, type SectionClassificationResult, type SectionType } from "./llm/classify-sections";
import {
    extractBasicDetails,
    type BasicDetailsExtract,
    type BasicFieldKey,
    type BasicFieldValue,
} from "./llm/extract-basic-details";
import {
    extractBuildingBlocks,
    type ExtractedBlock as BuildingBlock,
} from "./llm/extract-building-blocks";
import {
    extractUnitBlocks,
    type ExtractedBlock as UnitBlock,
} from "./llm/extract-unit-blocks";
import {
    extractAdministrationBlocks,
    type AdministrationBlock,
} from "./llm/extract-administration-blocks";

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

async function extractSectionsFromBuffer(
    buffer: Buffer | Uint8Array,
    options: ExtractSectionsOptions = {},
): Promise<ExtractSectionsResult> {
    const items = await extractPdfTextItemsFromBuffer(buffer);
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
    extractSectionsFromBuffer,
    classifySections,
    extractBasicDetails,
    extractBuildingBlocks,
    extractUnitBlocks,
    extractAdministrationBlocks,
    type ExtractSectionsOptions,
    type ExtractSectionsResult,
    type SectionClassificationResult,
    type SectionType as LegacySectionType,
    type BasicDetailsExtract,
    type BasicFieldKey,
    type BasicFieldValue,
    type BuildingBlock,
    type UnitBlock,
    type AdministrationBlock,
};

// Export new processor system
export {
    classifySection as classifySectionWithProcessor,
    classifySections as classifySectionsWithProcessors,
    getAllProcessors,
    getProcessorByType,
    getArrayBasedSectionTypes,
    type SectionProcessor,
    type ProcessedSection,
    type ClassificationResult,
    type SectionType,
    type SectionItem,
} from "./processors";
