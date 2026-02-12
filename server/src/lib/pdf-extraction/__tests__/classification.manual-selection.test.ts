import { describe, expect, test } from "bun:test";
import type { JsonToolResult, JsonToolSchema, LlmMessage } from "../llm/client";
import { classifySectionWithLlm } from "../llm/classify-sections";
import { classifySection } from "../processors/classifier";
import type { PdfLine, PdfSection } from "../raw/types";

const MANUAL_SELECTION_HEADING = "§ 1 Grundbuchstand und Eigentumsverhältnisse";

const MANUAL_SELECTION_TEXT = `§ 1 Grundbuchstand und Eigentumsverhältnisse
Der unterzeichnende Eigentumer, die „Urban Future Development GmbH",
geschaftsansassg mn Berlin, ist als Alleineigentumer des nachstehenden Grundstucks mm
Grundbuch von Berlin-Mitte, Blatt 12345, eingetragen Das Grundstück umfasst de Gemarkung
Berfin-Mitte, Flur 12, Flurstuck 456/78 mt einer Gesamtgroße von 2 450 m?
Der Eigentumer erklart hiermit gemäß $ 8 WEG die Aufteilung des Grundstucks mn
Mtegentumsanteile, de jeweils mut dem Sondereigentum an bestimmten Raumlchketten
verbunden smd Das gesamte Objekt wird unter dem Namen „Parkview Residences Berlin"
gefuhrt und tragt zur internen Identifikation die Objektnummer 10.557PRB
Die Verwaltung des Objekts erfolgt nach den Grundsatzen enner
Wohnungseigentumergemernschaft (Verwaltungstyp WEG`;

const MEA_WITH_UNIT_CONTEXT_TEXT = `Das Eigentum am Grundstuck wird mn 1 000 Miteigentumsanteile (MEA) zerlegt Nachstehend
werden die Einheiten, definiert durch ihre Einheitsnummer, ihren Nutzungstyp, ihre Lage und
thre Große, mm Detail beschrieben`;

const MEA_SHORT_TEXT = "Das Eigentum am Grundstuck wird mn 1 000 Miteigentumsanteile (MEA) zerlegt Nachstehend";
const UNIT_BLOCK_TEXT = `1. Einheit Nr. 01 (Apartment) Emn Miteigentumsanteil von 110,0/1.000, verbunden mt dem
Sondereigentum an der mm Aufteilungsplan mt der Nummer 01 bezeichneten Wohnung
• Nutzungstyp: Apartment
• Gebäudezugehörigkeit: Haus A
• Lage: Erdgeschoss, Eingang A (Haupteingang)
• Größe: ca 95,00 m? Wohnflache
• Zimmer: 3 Zimmer
• Baujahr der Einheit: 2023
• Beschreibung: Erdgeschosswohnung inks gelegen, Inklusive Terrasse`;

type RunJsonToolFn = <T>(args: {
    tool: JsonToolSchema;
    messages: LlmMessage[];
    model?: string;
    timeoutMs?: number;
}) => Promise<JsonToolResult<T>>;

function createSection(id: string, headingText: string, text: string): PdfSection {
    const lines = text.split("\n");
    const heading: PdfLine = {
        id: 1,
        page: 1,
        text: headingText,
        tokens: headingText.split(/\s+/),
        x: 10,
        y: 10,
        width: 500,
        height: 12,
        fontSize: 11,
        fontName: "Helvetica-Bold",
        bold: true,
    };

    return {
        id,
        heading,
        lines: lines.map((line, index) => ({
            id: index + 2,
            page: 1,
            text: line,
            tokens: line.split(/\s+/),
            x: 10,
            y: 30 + index * 14,
            width: 500,
            height: 12,
            fontSize: 10,
            fontName: "Helvetica",
            bold: false,
        })),
        rawText: text,
        textPosition: [{ page: 1, x: 10, y: 10, width: 500, height: Math.max(30, lines.length * 14) }],
    };
}

describe("manual selection classification", () => {
    test("classifies Grundbuchstand/Eigentumsverhältnisse snippet as core.property_overview", async () => {
        const runTool: RunJsonToolFn = async <T>(args: {
            tool: JsonToolSchema;
            messages: LlmMessage[];
            model?: string;
            timeoutMs?: number;
        }) => {
            const userPayload = args.messages.find((message) => message.role === "user")?.content ?? "";
            expect(userPayload).toContain("Grundbuchstand und Eigentumsverhältnisse");
            expect(userPayload).toContain("Parkview Residences Berlin");

            return {
                raw: "{\"sectionType\":\"core.property_overview\",\"confidence\":0.94}",
                parsed: {
                    sectionType: "core.property_overview",
                    confidence: 0.94,
                } as T,
                elapsedMs: 1,
            };
        };

        const result = await classifySectionWithLlm(
            MANUAL_SELECTION_TEXT,
            MANUAL_SELECTION_HEADING,
            runTool,
        );

        expect(result.sectionType).toBe("core.property_overview");
        expect(result.confidence).toBe(0.94);
    });

    test("manual selection keeps core.property_overview when LLM incorrectly returns MEA", async () => {
        const runTool: RunJsonToolFn = async <T>() => {
            return {
                raw: "{\"sectionType\":\"weg.mea_declaration\",\"confidence\":0.91}",
                parsed: {
                    sectionType: "weg.mea_declaration",
                    confidence: 0.91,
                } as T,
                elapsedMs: 1,
            };
        };

        const result = await classifySectionWithLlm(
            MANUAL_SELECTION_TEXT,
            MANUAL_SELECTION_HEADING,
            runTool,
        );

        expect(result.sectionType).toBe("core.property_overview");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
});

describe("snippet classification guardrails", () => {
    test("classifies MEA declaration snippet with trailing unit context as weg.mea_declaration", async () => {
        const section = createSection("mea-with-unit-context", "MEA Declaration", MEA_WITH_UNIT_CONTEXT_TEXT);
        const result = await classifySection(section, { managementType: "WEG" });

        expect(result.processor.sectionType).toBe("weg.mea_declaration");
        expect(result.processor.sectionType).not.toBe("units.unit_block");
    });

    test("classifies short MEA declaration snippet as weg.mea_declaration", async () => {
        const section = createSection("mea-short", "MEA Declaration", MEA_SHORT_TEXT);
        const result = await classifySection(section, { managementType: "WEG" });

        expect(result.processor.sectionType).toBe("weg.mea_declaration");
        expect(result.processor.sectionType).not.toBe("units.unit_block");
    });

    test("manual selection forces weg.mea_declaration when LLM returns units for explicit MEA declaration text", async () => {
        const runTool: RunJsonToolFn = async <T>() => {
            return {
                raw: "{\"sectionType\":\"units.unit_block\",\"confidence\":0.88}",
                parsed: {
                    sectionType: "units.unit_block",
                    confidence: 0.88,
                } as T,
                elapsedMs: 1,
            };
        };

        const result = await classifySectionWithLlm(
            MEA_WITH_UNIT_CONTEXT_TEXT,
            "Manual selection",
            runTool,
        );

        expect(result.sectionType).toBe("weg.mea_declaration");
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test("manual selection keeps units.unit_block when LLM returns MEA for a unit-entry snippet", async () => {
        const runTool: RunJsonToolFn = async <T>() => {
            return {
                raw: "{\"sectionType\":\"weg.mea_declaration\",\"confidence\":0.87}",
                parsed: {
                    sectionType: "weg.mea_declaration",
                    confidence: 0.87,
                } as T,
                elapsedMs: 1,
            };
        };

        const result = await classifySectionWithLlm(
            UNIT_BLOCK_TEXT,
            "Manual selection",
            runTool,
        );

        expect(result.sectionType).toBe("units.unit_block");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
});
