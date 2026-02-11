import { beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import { extractSectionsFromPdf } from "../index";
import { classifySection } from "../processors/classifier";
import { extractBuildingBlocks } from "../llm/extract-building-blocks";
import { extractUnitBlocks } from "../llm/extract-unit-blocks";
import type { PdfSection } from "../raw/types";

const MV_PDF_PATH = path.resolve(__dirname, "../../../../../client/public/SAMPLE MV DOC.pdf");

let allSections: PdfSection[] = [];

function getSectionByHeading(pattern: RegExp): PdfSection {
    const section = allSections.find((entry) => pattern.test(entry.heading.text));
    if (!section) throw new Error(`Section not found for pattern: ${pattern.source}`);
    return section;
}

beforeAll(async () => {
    const result = await extractSectionsFromPdf(MV_PDF_PATH);
    allSections = result.sections;
});

describe("MV section extraction", () => {
    test("extracts separate buildings and units sections", () => {
        const buildings = getSectionByHeading(/^2\.\s*buildings/i);
        const units = getSectionByHeading(/^3\.\s*units/i);

        expect(buildings.heading.text).toMatch(/^2\.\s*buildings/i);
        expect(units.heading.text).toMatch(/^3\.\s*units/i);
        expect(buildings.rawText).not.toContain("3. Units (Rental Units)");
    });
});

describe("MV section classification", () => {
    test("1. Property Overview -> core.property_overview", async () => {
        const section = getSectionByHeading(/^1\.\s*property overview/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("core.property_overview");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("2. Buildings -> core.building", async () => {
        const section = getSectionByHeading(/^2\.\s*buildings/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("core.building");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("3. Units (Rental Units) -> units.unit_block", async () => {
        const section = getSectionByHeading(/^3\.\s*units/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("units.unit_block");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("4. Ownership Structure (MV) -> mv.owner_entity", async () => {
        const section = getSectionByHeading(/^4\.\s*ownership structure/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("mv.owner_entity");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("6. Administration -> manager/accountant container", async () => {
        const section = getSectionByHeading(/^6\.\s*administration/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("weg.property_manager");

        const processed = await result.processor.process(section);
        const itemTypes = new Set((processed.items ?? []).map((item) => item.sectionType));
        expect(itemTypes.has("weg.property_manager")).toBe(true);
        expect(itemTypes.has("weg.accountant")).toBe(true);
    });

    test("7. Special Rights -> weg.special_rights", async () => {
        const section = getSectionByHeading(/^7\.\s*special rights/i);
        const result = await classifySection(section, { managementType: "MV" });
        expect(result.processor.sectionType).toBe("weg.special_rights");
        expect(result.confidence).toBeGreaterThan(0.1);
    });
});

describe("MV block splitting", () => {
    test("splits buildings into two building blocks", async () => {
        const section = getSectionByHeading(/^2\.\s*buildings/i);
        const blocks = await extractBuildingBlocks(section);

        expect(blocks.length).toBe(2);
        expect(blocks[0]?.blockText).toContain("Building A");
        expect(blocks[1]?.blockText).toContain("Building B");
    });

    test("splits units into multiple unit blocks", async () => {
        const section = getSectionByHeading(/^3\.\s*units/i);
        const blocks = await extractUnitBlocks(section);

        expect(blocks.length).toBe(10);
        expect(blocks[0]?.blockText).toMatch(/^01\s+Apartment/i);
        expect(blocks[5]?.blockText).toMatch(/^06\s+Office/i);
    });
});
