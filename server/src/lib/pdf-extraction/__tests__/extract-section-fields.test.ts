/**
 * Tests for post-LLM field extraction helpers.
 * Run: bun test server/src/lib/pdf-extraction/__tests__/extract-section-fields.test.ts
 */
import { describe, expect, test } from "bun:test";
import {
    parseGermanNumber,
    normalizeUnitType,
    inferUnitType,
    inferMeaNumerator,
    inferTotalMea,
    inferAddressFields,
    inferBuildingRef,
    postProcessFields,
} from "../llm/extract-section-fields";

// ─── parseGermanNumber ───────────────────────────────────────────────

describe("parseGermanNumber", () => {
    test("plain integer", () => {
        expect(parseGermanNumber("42")).toBe(42);
    });

    test("German decimal: comma as decimal separator", () => {
        expect(parseGermanNumber("78,59")).toBe(78.59);
    });

    test("German thousands separator: 1.000 → 1000", () => {
        expect(parseGermanNumber("1.000")).toBe(1000);
    });

    test("German thousands + decimal: 1.234,56 → 1234.56", () => {
        expect(parseGermanNumber("1.234,56")).toBe(1234.56);
    });

    test("large denominator: 10.000 → 10000", () => {
        expect(parseGermanNumber("10.000")).toBe(10000);
    });

    test("leading zero: 08,0 → 8", () => {
        expect(parseGermanNumber("08,0")).toBe(8);
    });

    test("OCR artifact: 1.,000 → 1000", () => {
        expect(parseGermanNumber("1.,000")).toBe(1000);
    });

    test("OCR artifact: 1,.000 → 1000", () => {
        expect(parseGermanNumber("1,.000")).toBe(1000);
    });

    test("OCR artifact: 10.,000 → 10000", () => {
        expect(parseGermanNumber("10.,000")).toBe(10000);
    });

    test("empty string returns null", () => {
        expect(parseGermanNumber("")).toBeNull();
    });

    test("whitespace returns null", () => {
        expect(parseGermanNumber("   ")).toBeNull();
    });

    test("English decimal: 90.0 → 90", () => {
        expect(parseGermanNumber("90.0")).toBe(90);
    });

    test("English decimal: 78.59 → 78.59", () => {
        expect(parseGermanNumber("78.59")).toBe(78.59);
    });

    test("English decimal: 160.0 → 160", () => {
        expect(parseGermanNumber("160.0")).toBe(160);
    });

    test("multiple thousands seps: 1.000.000 → 1000000", () => {
        expect(parseGermanNumber("1.000.000")).toBe(1000000);
    });
});

// ─── normalizeUnitType ───────────────────────────────────────────────

describe("normalizeUnitType", () => {
    test("lowercase enum value passes through", () => {
        expect(normalizeUnitType("apartment")).toBe("apartment");
    });

    test("capitalised enum value is lowered", () => {
        expect(normalizeUnitType("Apartment")).toBe("apartment");
    });

    test("uppercase enum value is lowered", () => {
        expect(normalizeUnitType("PARKING")).toBe("parking");
    });

    test("German word: Wohnung → apartment", () => {
        expect(normalizeUnitType("Wohnung")).toBe("apartment");
    });

    test("German word: Eigentumswohnung → apartment", () => {
        expect(normalizeUnitType("Eigentumswohnung")).toBe("apartment");
    });

    test("German word: Stellplatz → parking", () => {
        expect(normalizeUnitType("Stellplatz")).toBe("parking");
    });

    test("German word: Tiefgaragenstellplatz → parking", () => {
        expect(normalizeUnitType("Tiefgaragenstellplatz")).toBe("parking");
    });

    test("German word: Keller → storage", () => {
        expect(normalizeUnitType("Keller")).toBe("storage");
    });

    test("German word: Kellerraum → storage", () => {
        expect(normalizeUnitType("Kellerraum")).toBe("storage");
    });

    test("German word: Büro → office", () => {
        expect(normalizeUnitType("Büro")).toBe("office");
    });

    test("German word: Garten → garden", () => {
        expect(normalizeUnitType("Garten")).toBe("garden");
    });

    test("null returns null", () => {
        expect(normalizeUnitType(null)).toBeNull();
    });

    test("empty string returns null", () => {
        expect(normalizeUnitType("")).toBeNull();
    });

    test("unknown string returns null", () => {
        expect(normalizeUnitType("Schwimmbad")).toBeNull();
    });

    test("'other' passes through", () => {
        expect(normalizeUnitType("other")).toBe("other");
    });
});

// ─── inferUnitType ───────────────────────────────────────────────────

describe("inferUnitType", () => {
    test("detects parenthesized hint: (Wohnung)", () => {
        expect(inferUnitType("Einheit Nr. 1 (Wohnung) im Erdgeschoss")).toBe("apartment");
    });

    test("detects Stellplatz in text", () => {
        expect(inferUnitType("Einheit Nr. 5 Tiefgaragenstellplatz B12")).toBe("parking");
    });

    test("detects Keller in text", () => {
        expect(inferUnitType("Kellerraum Nr. 3")).toBe("storage");
    });

    test("returns null for no match", () => {
        expect(inferUnitType("Einheit Nr. 7 Sonstiges")).toBeNull();
    });
});

// ─── inferMeaNumerator ──────────────────────────────────────────────

describe("inferMeaNumerator", () => {
    test("standard fraction: 78,59/1.000", () => {
        expect(inferMeaNumerator("MEA 78,59/1.000")).toBe(78.59);
    });

    test("spaced fraction: 120,0 / 1.000", () => {
        expect(inferMeaNumerator("Anteil 120,0 / 1.000")).toBe(120);
    });

    test("large denominator: 234,50/10.000", () => {
        expect(inferMeaNumerator("234,50/10.000 Miteigentumsanteil")).toBe(234.5);
    });

    test("OCR artifact: 08,0/1.,000 → 8", () => {
        expect(inferMeaNumerator("Anteil 08,0/1.,000")).toBe(8);
    });

    test("OCR artifact: 08,0/1,.000 → 8", () => {
        expect(inferMeaNumerator("Anteil 08,0/1,.000")).toBe(8);
    });

    test("skips small denominators", () => {
        expect(inferMeaNumerator("Seite 2/3")).toBeNull();
    });

    test("no fraction returns null", () => {
        expect(inferMeaNumerator("keine MEA Angabe")).toBeNull();
    });
});

// ─── inferTotalMea ──────────────────────────────────────────────────

describe("inferTotalMea", () => {
    test("extracts total from explicit label", () => {
        expect(inferTotalMea("Gesamt 1.000 Anteile")).toBe(1000);
    });

    test("extracts from fraction denominator", () => {
        expect(inferTotalMea("78,59/10.000")).toBe(10000);
    });

    test("returns null when no total found", () => {
        expect(inferTotalMea("no numbers here")).toBeNull();
    });
});

// ─── inferAddressFields ─────────────────────────────────────────────

describe("inferAddressFields", () => {
    test("extracts full German address", () => {
        const result = inferAddressFields("Musterstraße 12, 10557 Berlin");
        expect(result).not.toBeNull();
        expect(result!.street).toBe("Musterstraße");
        expect(result!.houseNumber).toBe("12");
        expect(result!.postalCode).toBe("10557");
        expect(result!.city).toBe("Berlin");
    });

    test("extracts address with Str. abbreviation", () => {
        const result = inferAddressFields("Haupt Str. 5a 80331 München");
        expect(result).not.toBeNull();
        expect(result!.street).toBe("Haupt Str.");
        expect(result!.houseNumber).toBe("5a");
        expect(result!.postalCode).toBe("80331");
        expect(result!.city).toBe("München");
    });

    test("returns null when no address found", () => {
        expect(inferAddressFields("no address here")).toBeNull();
    });
});

// ─── postProcessFields (integration) ────────────────────────────────

describe("postProcessFields for units.unit_block", () => {
    test("normalises LLM-returned Wohnung to apartment", () => {
        const fields = postProcessFields(
            "Einheit Nr. 1",
            "units.unit_block",
            [
                { key: "unitNumber", value: "1" },
                { key: "unitType", value: "Wohnung" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("apartment");
    });

    test("normalises capitalised Apartment to apartment", () => {
        const fields = postProcessFields(
            "Einheit Nr. 2",
            "units.unit_block",
            [
                { key: "unitNumber", value: "2" },
                { key: "unitType", value: "Apartment" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("apartment");
    });

    test("falls back to description field when unitType is null", () => {
        const fields = postProcessFields(
            "Einheit Nr. 3",
            "units.unit_block",
            [
                { key: "unitNumber", value: "3" },
                { key: "unitType", value: null },
                { key: "description", value: "Tiefgaragenstellplatz" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("parking");
    });

    test("falls back to rawText when both unitType and description fail", () => {
        const fields = postProcessFields(
            "Einheit Nr. 4 (Wohnung) im 2. OG",
            "units.unit_block",
            [
                { key: "unitNumber", value: "4" },
                { key: "unitType", value: null },
                { key: "description", value: null },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("apartment");
    });

    test("OCR artifact 08,0/1.,000 extracts meaNumerator = 8", () => {
        const fields = postProcessFields(
            "Einheit Nr. 2 (Wohnung) 08,0/1.,000",
            "units.unit_block",
            [
                { key: "unitNumber", value: "2" },
                { key: "unitType", value: null },
                { key: "meaNumerator", value: null },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("apartment");
        expect(map.meaNumerator).toBe(8);
    });

    test("preserves correct LLM meaNumerator when present", () => {
        const fields = postProcessFields(
            "Einheit Nr. 5 78,59/1.000",
            "units.unit_block",
            [
                { key: "unitNumber", value: "5" },
                { key: "meaNumerator", value: 78.59 },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.meaNumerator).toBe(78.59);
    });

    test("normalises string meaNumerator '90.0/1.000' → 90", () => {
        const fields = postProcessFields(
            "Einheit Nr. 7",
            "units.unit_block",
            [
                { key: "unitNumber", value: "7" },
                { key: "meaNumerator", value: "90.0/1.000" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.meaNumerator).toBe(90);
    });

    test("normalises sentence meaNumerator 'Ein Miteigentumsanteil von 160,0/1.000...' → 160", () => {
        const fields = postProcessFields(
            "Einheit Nr. 8",
            "units.unit_block",
            [
                { key: "unitNumber", value: "8" },
                { key: "meaNumerator", value: "Ein Miteigentumsanteil von 160,0/1.000, verbunden mit dem Sondereigentum" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.meaNumerator).toBe(160);
    });

    test("normalises simple German decimal string meaNumerator '78,59' → 78.59", () => {
        const fields = postProcessFields(
            "Einheit Nr. 9",
            "units.unit_block",
            [
                { key: "unitNumber", value: "9" },
                { key: "meaNumerator", value: "78,59" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.meaNumerator).toBe(78.59);
    });

    test("replaces LLM garbage unitType with inferred value", () => {
        const fields = postProcessFields(
            "Einheit Nr. 6 (Wohnung) 3. OG",
            "units.unit_block",
            [
                { key: "unitNumber", value: "6" },
                { key: "unitType", value: "residential unit" },
            ],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.unitType).toBe("apartment");
    });
});

// ─── postProcessFields for weg.mea_declaration ──────────────────────

describe("postProcessFields for weg.mea_declaration", () => {
    test("normalises string totalMea '1.000' → 1000", () => {
        const fields = postProcessFields(
            "Gesamtanteil 1.000",
            "weg.mea_declaration",
            [{ key: "totalMea", value: "1.000" }],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.totalMea).toBe(1000);
    });

    test("normalises string totalMea '10.000' → 10000", () => {
        const fields = postProcessFields(
            "Gesamtanteil 10.000",
            "weg.mea_declaration",
            [{ key: "totalMea", value: "10.000" }],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.totalMea).toBe(10000);
    });

    test("preserves numeric totalMea", () => {
        const fields = postProcessFields(
            "Gesamtanteil 1000",
            "weg.mea_declaration",
            [{ key: "totalMea", value: 1000 }],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.totalMea).toBe(1000);
    });
});

// ─── postProcessFields buildingRef handling ─────────────────────────

describe("postProcessFields buildingRef", () => {
    const BUILDINGS_2 = [
        { uuid: "bld-aaa", name: "Haus A" },
        { uuid: "bld-bbb", name: "Haus B" },
    ];
    const BUILDINGS_1 = [{ uuid: "bld-aaa", name: "Haus A" }];

    test("maps building_1 label to first building UUID", () => {
        const fields = postProcessFields(
            "Einheit Nr. 1 Haus A",
            "units.unit_block",
            [
                { key: "unitNumber", value: "1" },
                { key: "buildingRef", value: "building_1" },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-aaa");
    });

    test("maps building_2 label to second building UUID", () => {
        const fields = postProcessFields(
            "Einheit Nr. 2 Haus B",
            "units.unit_block",
            [
                { key: "unitNumber", value: "2" },
                { key: "buildingRef", value: "building_2" },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-bbb");
    });

    test("clears out-of-range building label", () => {
        const fields = postProcessFields(
            "Einheit Nr. 2",
            "units.unit_block",
            [
                { key: "unitNumber", value: "2" },
                { key: "buildingRef", value: "building_99" },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBeNull();
    });

    test("clears non-label garbage string", () => {
        const fields = postProcessFields(
            "Einheit Nr. 2",
            "units.unit_block",
            [
                { key: "unitNumber", value: "2" },
                { key: "buildingRef", value: "some_garbage" },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBeNull();
    });

    test("preserves if LLM accidentally returns a valid UUID", () => {
        const fields = postProcessFields(
            "Einheit Nr. 1 Haus A",
            "units.unit_block",
            [
                { key: "unitNumber", value: "1" },
                { key: "buildingRef", value: "bld-aaa" },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-aaa");
    });

    test("auto-assigns single building when LLM returns null", () => {
        const fields = postProcessFields(
            "Einheit Nr. 3",
            "units.unit_block",
            [
                { key: "unitNumber", value: "3" },
                { key: "buildingRef", value: null },
            ],
            BUILDINGS_1,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-aaa");
    });

    test("auto-assigns single building when buildingRef absent", () => {
        const fields = postProcessFields(
            "Einheit Nr. 4",
            "units.unit_block",
            [{ key: "unitNumber", value: "4" }],
            BUILDINGS_1,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-aaa");
    });

    test("falls back to regex when LLM returns null with multiple buildings", () => {
        const fields = postProcessFields(
            "Einheit Nr. 5 Gebäudezugehörigkeit: Haus B",
            "units.unit_block",
            [
                { key: "unitNumber", value: "5" },
                { key: "buildingRef", value: null },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-bbb");
    });

    test("falls back to regex for English alias 'Building A' vs stored 'Haus A'", () => {
        const fields = postProcessFields(
            "Unit 05 Building A",
            "units.unit_block",
            [
                { key: "unitNumber", value: "5" },
                { key: "buildingRef", value: null },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("bld-aaa");
    });

    test("returns null when text matches no building name", () => {
        const fields = postProcessFields(
            "Einheit Nr. 5 im Erdgeschoss",
            "units.unit_block",
            [
                { key: "unitNumber", value: "5" },
                { key: "buildingRef", value: null },
            ],
            BUILDINGS_2,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBeNull();
    });

    test("no buildings array → no buildingRef field added", () => {
        const fields = postProcessFields(
            "Einheit Nr. 6",
            "units.unit_block",
            [{ key: "unitNumber", value: "6" }],
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBeUndefined();
    });
});

// ─── inferBuildingRef ────────────────────────────────────────────────────────

describe("inferBuildingRef", () => {
    const BUILDINGS = [
        { uuid: "bld-aaa", name: "Haus A — Parkside" },
        { uuid: "bld-bbb", name: "Haus B - Cityside — Haus B" },
    ];

    test("matches 'Haus A' in text to first building", () => {
        expect(inferBuildingRef("Gebäudezugehörigkeit: Haus A", BUILDINGS)).toBe("bld-aaa");
    });

    test("matches 'Haus B' in text to second building", () => {
        expect(inferBuildingRef("Gebäude: Haus B, 2. OG", BUILDINGS)).toBe("bld-bbb");
    });

    test("matches 'Building A' in text to stored 'Haus A'", () => {
        expect(inferBuildingRef("Unit 05 in Building A", BUILDINGS)).toBe("bld-aaa");
    });

    test("matches 'Parkside' keyword", () => {
        expect(inferBuildingRef("Balkon zur Parkside", BUILDINGS)).toBe("bld-aaa");
    });

    test("matches 'Cityside' keyword", () => {
        expect(inferBuildingRef("Wohnung Cityside", BUILDINGS)).toBe("bld-bbb");
    });

    test("prefers building with more token matches", () => {
        // "Haus B" appears once for both, but "Cityside" tips the scale for bld-bbb
        expect(inferBuildingRef("Haus B Cityside Einheit 5", BUILDINGS)).toBe("bld-bbb");
    });

    test("returns null when no tokens match", () => {
        expect(inferBuildingRef("Einheit Nr. 7 im Erdgeschoss", BUILDINGS)).toBeNull();
    });
});

// ─── Real-world extraction test case ─────────────────────────────────────

describe("real-world: unit-3 with Haus A / Haus B buildings", () => {
    const RAW_TEXT = [
        "3. Einheit Nr, 03 (Apartment) Ein Miteigentumsanteil von 120,0/1.000, verbunden mt dem",
        "Sondereigentum an der mm Aufteilungsplan mit der Nummer 03 bezeichneten Wohnung",
        "• Nutzungstyp: Apartment",
        "• Gebäudezugehörigkeit: Haus A",
        "• Lage: 1 Obergeschoss, Eingang A",
        "• Größe: ca 105,00 m? Wohnflache",
        "• Zimmer: 4 Zimmer",
        "• Baujahr der Einheit: 2023",
        "• Beschreibung: Familienwohnung mt Balkon zur Parkseite",
    ].join("\n");

    const BUILDINGS = [
        { uuid: "building-1770782876774-0osi3wz", name: "Haus A — Parkside" },
        { uuid: "building-1770782876161-a4dnul0", name: "Haus B - Cityside — Haus B" },
    ];

    test("inferBuildingRef picks Haus A from raw text", () => {
        const result = inferBuildingRef(RAW_TEXT, BUILDINGS);
        expect(result).toBe("building-1770782876774-0osi3wz");
    });

    test("postProcessFields assigns Haus A when LLM returns building_1", () => {
        const fields = postProcessFields(
            RAW_TEXT,
            "units.unit_block",
            [
                { key: "unitNumber", value: "03" },
                { key: "unitType", value: "apartment" },
                { key: "floor", value: 1 },
                { key: "entrance", value: "A" },
                { key: "area", value: 105 },
                { key: "rooms", value: 4 },
                { key: "description", value: "Familienwohnung mt Balkon zur Parkseite" },
                { key: "meaNumerator", value: 120 },
                { key: "buildingRef", value: "building_1" },
            ],
            BUILDINGS,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("building-1770782876774-0osi3wz");
        expect(map.unitType).toBe("apartment");
        expect(map.meaNumerator).toBe(120);
    });

    test("postProcessFields falls back to regex when LLM returns null buildingRef", () => {
        const fields = postProcessFields(
            RAW_TEXT,
            "units.unit_block",
            [
                { key: "unitNumber", value: "03" },
                { key: "unitType", value: "apartment" },
                { key: "meaNumerator", value: 120 },
                { key: "buildingRef", value: null },
            ],
            BUILDINGS,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("building-1770782876774-0osi3wz");
    });

    test("postProcessFields falls back to regex when buildingRef absent", () => {
        const fields = postProcessFields(
            RAW_TEXT,
            "units.unit_block",
            [
                { key: "unitNumber", value: "03" },
                { key: "unitType", value: "apartment" },
                { key: "meaNumerator", value: 120 },
            ],
            BUILDINGS,
        );
        const map = Object.fromEntries(fields.map((f) => [f.key, f.value]));
        expect(map.buildingRef).toBe("building-1770782876774-0osi3wz");
    });
});
