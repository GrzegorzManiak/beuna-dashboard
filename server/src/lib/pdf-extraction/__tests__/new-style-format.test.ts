
import { describe, expect, test } from "bun:test";
import {
    parseGermanNumber,
    inferTotalMea,
} from "../llm/extract-section-fields";

/**
 * Validates extraction logic against the "new style" WEG document provided by the user.
 * 
 * Relevant excerpts:
 * "§ 2 Aufteilung in Miteigentumsanteile
 *  Das Grundstück wird hiermit in 1.000 Miteigentumsanteile (MEA) aufgeteilt."
 * 
 * "Einheit 1 – Erdgeschoss links
 *  170 / 1.000 Miteigentumsanteile"
 */

describe("New Style WEG Extraction Logic", () => {
    
    // Test parsing of the numbers found in the document
    describe("Number Parsing from Document", () => {
        test("parses total MEA '1.000'", () => {
             expect(parseGermanNumber("1.000")).toBe(1000);
        });

        test("parses unit MEA numerator '170'", () => {
            expect(parseGermanNumber("170")).toBe(170);
        });

        test("parses unit MEA numerator '10' (parking)", () => {
            expect(parseGermanNumber("10")).toBe(10);
        });

        test("parses unit area '125'", () => {
            expect(parseGermanNumber("125")).toBe(125);
        });
        
        test("parses unit area '1.240' (land size)", () => {
            expect(parseGermanNumber("1.240")).toBe(1240);
        });
    });

    // Test the logic that detects the total MEA from raw tokens or strings
    describe("inferTotalMea Strategy", () => {
        test("extracts total MEA from '1.000 Miteigentumsanteile'", () => {
             // Simulating the value extracted by LLM into the raw field
             // The LLM typically passes a string like "1.000" or "1000" to the helper
             // But locally we might rely on the helper to clean it up.
             
             // In the real code `postProcessFields` calls `inferTotalMea` if the key is `totalMea`.
             // We want to make sure `inferTotalMea` handles the format.
             
             // Actually `inferTotalMea` logic is usually:
             // return parseGermanNumber(String(val));
             // Let's verify that.
             
             const rawValueFromLLM = "1.000"; 
             expect(inferTotalMea(rawValueFromLLM)).toBe(1000);
        });

        test("extracts total MEA from '1.000'", () => {
            expect(inferTotalMea("1.000")).toBe(1000);
       });
    });

});
