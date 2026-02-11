/**
 * Classification tests for each PDF section.
 * Run: bun test server/src/lib/pdf-extraction/__tests__/classification.test.ts
 */
import { describe, expect, test, beforeAll } from "bun:test";
import path from "node:path";
import { extractSectionsFromPdf } from "../index";
import { classifySection } from "../processors/classifier";
import { extractUnitBlocks } from "../llm/extract-unit-blocks";
import { extractBuildingBlocks } from "../llm/extract-building-blocks";
import type { PdfSection } from "../raw/types";

const PDF_PATH = path.resolve(__dirname, "../../../../../client/public/test.pdf");

let allSections: PdfSection[] = [];

beforeAll(async () => {
    const result = await extractSectionsFromPdf(PDF_PATH);
    allSections = result.sections;
});

describe("PDF section extraction", () => {
    test("extracts 7 sections from test PDF", () => {
        expect(allSections.length).toBe(7);
    });
});

describe("section classification", () => {
    test("§ 1 Grundbuchstand und Eigentumsverhältnisse → core.property_overview", async () => {
        const section = allSections[0]!;
        expect(section.heading.text).toContain("Grundbuchstand");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("core.property_overview");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("§ 2 Objektbeschreibung und Gebäudedaten → core.building", async () => {
        const section = allSections[1]!;
        expect(section.heading.text).toContain("Gebäudedaten");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("core.building");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("§ 3 Aufteilungsplan und Einheitenbeschreibung → units.unit_block", async () => {
        const section = allSections[2]!;
        expect(section.heading.text).toContain("Einheitenbeschreibung");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("units.unit_block");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("§ 4 Sondernutzungsrechte → weg.special_rights", async () => {
        const section = allSections[3]!;
        expect(section.heading.text).toContain("Sondernutzungsrechte");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("weg.special_rights");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("§ 5 Erstbestellung von Verwaltung und Buchhaltung → weg.property_manager", async () => {
        const section = allSections[4]!;
        expect(section.heading.text).toContain("Verwaltung");

        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("weg.property_manager");
        expect(result.confidence).toBeGreaterThan(0.1);
    });

    test("§ 6 Schlussbestimmungen → unknown", async () => {
        const section = allSections[5]!;
        expect(section.heading.text).toContain("Schlussbestimmungen");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("unknown");
    });

    test("signature mark 'X' → unknown", async () => {
        const section = allSections[6]!;
        expect(section.heading.text).toBe("X");
        
        const result = await classifySection(section);
        expect(result.processor.sectionType).toBe("unknown");
    });
});

describe("unit block splitting", () => {
    test("splits units section into exactly 10 blocks", async () => {
        const unitSection = allSections[2]!;
        const blocks = await extractUnitBlocks(unitSection);
        expect(blocks.length).toBe(10);
    });

    test("each block starts with a unit marker", async () => {
        const unitSection = allSections[2]!;
        const blocks = await extractUnitBlocks(unitSection);
        
        for (const block of blocks) {
            const firstLine = block.blockText.split("\n")[0]?.trim() ?? "";
            expect(firstLine).toMatch(/\d+[\.,]\s*einheit/i);
        }
    });

    test("block 9 is the parking group (Einheiten Nr. 09 bis 13)", async () => {
        const unitSection = allSections[2]!;
        const blocks = await extractUnitBlocks(unitSection);
        
        const parkingBlock = blocks[8]!;
        expect(parkingBlock.blockText).toContain("Einheiten Nr. 09 bis 13");
        expect(parkingBlock.blockText).toContain("Parking");
    });

    test("block 10 is the garden unit (Einheit Nr. 14)", async () => {
        const unitSection = allSections[2]!;
        const blocks = await extractUnitBlocks(unitSection);
        
        const gardenBlock = blocks[9]!;
        expect(gardenBlock.blockText).toContain("Einheit Nr. 14");
        expect(gardenBlock.blockText).toContain("Garden");
    });
});

describe("building block splitting", () => {
    test("splits buildings section into 2 blocks", async () => {
        const buildingSection = allSections[1]!;
        const blocks = await extractBuildingBlocks(buildingSection);
        expect(blocks.length).toBe(2);
    });

    test("block 1 is Gebäude 1 (Haus A - Parkside)", async () => {
        const buildingSection = allSections[1]!;
        const blocks = await extractBuildingBlocks(buildingSection);
        
        expect(blocks[0]!.blockText).toContain("Gebäude 1");
        expect(blocks[0]!.blockText).toContain("Haus A");

        expect(blocks[0]!.blockText).not.toContain("Gebäude 2");
        expect(blocks[0]!.blockText).not.toContain("Haus B");
    });

    test("block 2 is Gebäude 2 (Haus B - Cityside)", async () => {
        const buildingSection = allSections[1]!;
        const blocks = await extractBuildingBlocks(buildingSection);
        
        expect(blocks[1]!.blockText).toContain("Gebäude 2");
        expect(blocks[1]!.blockText).toContain("Haus B");

        expect(blocks[1]!.blockText).not.toContain("Gebäude 1");
        expect(blocks[1]!.blockText).not.toContain("Haus A");
    });
});
