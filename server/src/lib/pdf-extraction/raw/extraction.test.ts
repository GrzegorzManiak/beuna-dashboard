import { describe, expect, it } from "vitest";
import { buildLines } from "./lines";
import { computeLineStats } from "./line-stats";
import { scoreHeadings } from "./heading-score";
import { selectPrimaryHeadings } from "./heading-levels";
import { buildSections } from "./sections";
import type { PdfLine, PdfTextItem } from "./types";

const createItem = (overrides: Partial<PdfTextItem>): PdfTextItem => ({
    page: 1,
    text: "",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    fontSize: 10,
    fontName: "Helvetica",
    hasEOL: false,
    ...overrides,
});

const createLine = (overrides: Partial<PdfLine> & { text: string }): PdfLine => {
    const tokens = overrides.tokens ?? overrides.text.split(" ").filter(Boolean);
    return {
        id: 0,
        page: 1,
        text: overrides.text,
        x: 0,
        y: 0,
        width: 100,
        height: 10,
        fontSize: 10,
        fontName: "Helvetica",
        bold: false,
        ...overrides,
        tokens,
    };
};

describe("pdf-extraction raw pipeline", () => {
    it("buildLines merges items and preserves spacing", () => {
        const items: PdfTextItem[] = [
            createItem({ text: "URKUNDENROLLE", x: 10, width: 100, fontSize: 12 }),
            createItem({ text: "NR.", x: 130, width: 20, fontSize: 12 }),
            createItem({ text: "2024/05-B", x: 165, width: 80, fontSize: 12 }),
        ];

        const lines = buildLines(items);
        expect(lines.length).toBe(1);
        expect(lines[0]?.text).toBe("URKUNDENROLLE NR. 2024/05-B");
    });

    it("scoreHeadings detects stronger heading lines", () => {
        const heading = createLine({
            id: 1,
            text: "TEILUNGSERKLAERUNG",
            fontSize: 18,
            bold: true,
            y: 10,
        });
        const body = createLine({
            id: 2,
            text: "Der Eigentuemer erklaert hiermit die Aufteilung.",
            fontSize: 10,
            bold: false,
            y: 30,
        });

        const stats = computeLineStats([heading, body]);
        const result = scoreHeadings([heading, body], stats);
        const headingIds = result.headings.map((entry) => entry.line.id);
        expect(headingIds).toContain(heading.id);

        const primary = selectPrimaryHeadings(result.headings.map((entry) => entry.line));
        const primaryIds = primary.map((line) => line.id);
        expect(primaryIds).toContain(heading.id);
    });

    it("buildSections keeps subheadings within a single section", () => {
        const heading = createLine({
            id: 1,
            text: "§ 2 Objektbeschreibung und Gebaeudedaten",
            fontSize: 16,
            bold: true,
            y: 10,
        });
        const body = createLine({
            id: 2,
            text: "Auf dem Grundstueck werden zwei Baukoerper errichtet.",
            fontSize: 10,
            y: 30,
        });
        const subheading = createLine({
            id: 3,
            text: "(1) Gebaeude 1 (Haus A - Parkside)",
            fontSize: 10,
            y: 50,
        });
        const detail = createLine({
            id: 4,
            text: "Das Gebaeude erstreckt sich ueber mehrere Etagen.",
            fontSize: 10,
            y: 70,
        });

        const lines = [heading, body, subheading, detail];
        const stats = computeLineStats(lines);
        const sections = buildSections(lines, [heading], stats);

        expect(sections.length).toBe(1);
        const section = sections[0];
        expect(section?.rawText).toContain("(1) Gebaeude 1");
        expect(section?.rawText.split("\n").length).toBe(4);
        expect(section?.textPosition.length).toBe(1);
        expect(section?.textPosition[0]?.width).toBeGreaterThan(0);
    });
});
