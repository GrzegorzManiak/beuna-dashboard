import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { SectionType } from "@shared/section-types";

/**
 * Field value extracted by the LLM.
 */
type ExtractedField = {
    key: string;
    value: string | number | boolean | null;
};

type ExtractionResult = {
    fields: ExtractedField[];
    elapsedMs: number;
};

// ─── Per-section-type field schemas ──────────────────────────────────

/**
 * Each entry defines:
 *   - `fields`: the JSON Schema properties the LLM should populate
 *   - `required`: which keys are always emitted (value can still be null)
 *   - `prompt`: additional instructions for the system message
 */
type FieldSchemaEntry = {
    fields: Record<string, Record<string, unknown>>;
    required: string[];
    prompt: string;
};

const SECTION_FIELD_SCHEMAS: Partial<Record<SectionType, FieldSchemaEntry>> = {
    "core.property_overview": {
        fields: {
            propertyName: { type: ["string", "null"], description: "Name of the property / Wohnanlage." },
            propertyId: { type: ["string", "null"], description: "Internal reference / Aktenzeichen." },
            managementTypeHint: {
                type: ["string", "null"],
                enum: ["WEG", "MV", null],
                description: "Management type hint: WEG (Wohnungseigentümergemeinschaft) or MV (Mietverwaltung).",
            },
        },
        required: ["propertyName", "propertyId", "managementTypeHint"],
        prompt: "Extract the property overview fields. managementTypeHint should be WEG if the text references Wohnungseigentum, Teilungserklärung, Gemeinschaftsordnung, etc. Use MV if it references Mietverwaltung.",
    },

    "core.address": {
        fields: {
            street: { type: ["string", "null"], description: "Street name (without house number)." },
            houseNumber: { type: ["string", "null"], description: "House number." },
            postalCode: { type: ["string", "null"], description: "Postal code / PLZ." },
            city: { type: ["string", "null"], description: "City name." },
            country: { type: ["string", "null"], description: "Country (default Deutschland)." },
        },
        required: ["street", "houseNumber", "postalCode", "city", "country"],
        prompt: [
            "Extract the address components from the text.",
            "German addresses follow this pattern: Straßenname Hausnummer, PLZ Stadt",
            "Examples: 'Musterstraße 12, 10557 Berlin' or 'Am Platz 3a, 80331 München'.",
            "street = street name only (e.g. 'Musterstraße'), houseNumber = number + optional letter (e.g. '12a').",
            "postalCode = 5-digit PLZ, city = city name.",
            "If country is not mentioned, default to 'Deutschland'.",
        ].join("\n"),
    },

    "core.building": {
        fields: {
            buildingName: { type: ["string", "null"], description: "Building name, e.g. 'Haus A', 'Gebäude 1'." },
            label: { type: ["string", "null"], description: "Label or subtitle, e.g. 'Parkside', 'Cityside'." },
            addressStreet: { type: ["string", "null"], description: "Street name for this building." },
            addressHouseNumber: { type: ["string", "null"], description: "House number for this building." },
            addressPostalCode: { type: ["string", "null"], description: "Postal code." },
            addressCity: { type: ["string", "null"], description: "City." },
            addressCountry: { type: ["string", "null"], description: "Country." },
            buildYear: { type: ["string", "null"], description: "Year of construction." },
            floors: { type: ["integer", "null"], description: "Number of floors / Stockwerke." },
            notes: { type: ["string", "null"], description: "Any other notable information." },
        },
        required: ["buildingName", "label", "addressStreet", "addressHouseNumber", "addressPostalCode", "addressCity"],
        prompt: "Extract building details. The text describes a single building within a property.",
    },

    "units.unit_block": {
        fields: {
            unitNumber: { type: ["string", "null"], description: "Unit number (Einheit Nr.)." },
            unitType: {
                type: ["string", "null"],
                enum: ["apartment", "office", "parking", "garden", "storage", "other", null],
                description: "Type of unit.",
            },
            floor: { type: ["string", "null"], description: "Floor / Stockwerk / Geschoss." },
            entrance: { type: ["string", "null"], description: "Entrance / Aufgang." },
            area: { type: ["number", "null"], description: "Area in square meters." },
            rooms: { type: ["string", "null"], description: "Number of rooms." },
            description: { type: ["string", "null"], description: "Description of the unit (Wohnung, Tiefgaragenstellplatz, etc.)." },
            meaNumerator: { type: ["number", "null"], description: "MEA share numerator." },
        },
        required: ["unitNumber", "unitType", "description", "meaNumerator"],
        prompt: [
            "Extract unit / Einheit details from the text.",
            "unitType mapping from German terms:",
            "  - Wohnung, Apartment, Eigentumswohnung, Maisonette → apartment",
            "  - Büro, Gewerbe, Laden, Praxis → office",
            "  - Stellplatz, Tiefgaragenstellplatz, Garage, TG-Stellplatz, Parkplatz → parking",
            "  - Garten, Gartenanteil → garden",
            "  - Keller, Kellerraum, Abstellraum, Lager → storage",
            "  - Everything else → other",
            "IMPORTANT: If the text contains a parenthesized type like '(Apartment)' or '(Wohnung)', use that to determine unitType.",
            "For MEA: look for fractions like 78,59/1.000 or 120,0/1.000. meaNumerator is the left side (e.g. 120.0).",
        ].join("\n"),
    },

    "weg.special_rights": {
        fields: {
            unitRef: { type: ["string", "null"], description: "Reference to the unit this right belongs to." },
            rightType: {
                type: ["string", "null"],
                enum: ["terrace", "roof_terrace", "garden", "parking_access", "mixed", "other", null],
                description: "Type of special usage right / Sondernutzungsrecht.",
            },
            description: { type: ["string", "null"], description: "Description of the special right." },
            area: { type: ["number", "null"], description: "Area in square meters (if specified)." },
        },
        required: ["unitRef", "rightType", "description"],
        prompt: "Extract special usage rights (Sondernutzungsrechte). Identify which unit they belong to and what type of right it is.",
    },

    "weg.mea_declaration": {
        fields: {
            totalMea: { type: ["number", "null"], description: "Total MEA shares (denominator, e.g. 1000)." },
            notes: { type: ["string", "null"], description: "Any relevant notes about the MEA declaration." },
        },
        required: ["totalMea"],
        prompt: "Extract MEA declaration totals. Look for the total denominator (e.g. 1.000 or 10.000).",
    },

    "weg.property_manager": {
        fields: {
            managerName: { type: ["string", "null"], description: "Name of the property manager / Verwalter (company or person)." },
            addressStreet: { type: ["string", "null"], description: "Street name of the manager's address." },
            addressHouseNumber: { type: ["string", "null"], description: "House number." },
            addressPostalCode: { type: ["string", "null"], description: "Postal code / PLZ." },
            addressCity: { type: ["string", "null"], description: "City." },
            addressCountry: { type: ["string", "null"], description: "Country (default Deutschland)." },
            notes: { type: ["string", "null"], description: "Any additional notes (appointment period, etc.)." },
        },
        required: ["managerName", "addressStreet", "addressHouseNumber", "addressPostalCode", "addressCity"],
        prompt: "Extract property manager (Verwalter) information. Look for company names (GmbH, AG, etc.) and break the address into street, house number, postal code, and city.",
    },

    "weg.accountant": {
        fields: {
            accountantName: { type: ["string", "null"], description: "Name of the accountant / Buchhalter (company or person)." },
            addressStreet: { type: ["string", "null"], description: "Street name of the accountant's address." },
            addressHouseNumber: { type: ["string", "null"], description: "House number." },
            addressPostalCode: { type: ["string", "null"], description: "Postal code / PLZ." },
            addressCity: { type: ["string", "null"], description: "City." },
            addressCountry: { type: ["string", "null"], description: "Country (default Deutschland)." },
            notes: { type: ["string", "null"], description: "Any additional notes." },
        },
        required: ["accountantName", "addressStreet", "addressHouseNumber", "addressPostalCode", "addressCity"],
        prompt: "Extract accountant (Buchhalter / Abrechnung) information. Look for company names (GmbH, AG, etc.) and break the address into street, house number, postal code, and city.",
    },

    "mv.owner_entity": {
        fields: {
            ownerName: { type: ["string", "null"], description: "Name of the owner entity." },
            ownerType: {
                type: ["string", "null"],
                description: "Type of owner: 'Company' or 'Individual'.",
            },
            registrationId: { type: ["string", "null"], description: "Company registration ID / Handelsregisternummer." },
        },
        required: ["ownerName", "ownerType"],
        prompt: "Extract owner entity details. Determine if the owner is a company (GmbH, AG, etc.) or an individual.",
    },
};

function parseGermanNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    let cleaned = trimmed.replace(/[.,]{2,}/g, ".");
    const hasComma = cleaned.includes(",");

    let normalized: string;
    if (hasComma) {
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
        normalized = cleaned.replace(/\.(\d+)/g, (_m, digits: string) => {
            return digits.length === 3 ? digits : "." + digits;
        });
    }

    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
}

/**
 * German unit-type keywords → enum value.
 */
const UNIT_TYPE_KEYWORDS: [RegExp, string][] = [
    [/\b(?:wohnung|eigentumswohnung|apartment|maisonette)\b/i, "apartment"],
    [/\b(?:büro|buero|gewerbe|laden|praxis)\b/i, "office"],
    [/\b(?:stellplatz|tiefgaragen?stellplatz|garage|tg[- ]?stellplatz|parkplatz|carport)\b/i, "parking"],
    [/\b(?:garten|gartenanteil|gartenfläche)\b/i, "garden"],
    [/\b(?:keller|kellerraum|abstellraum|lager|lagerraum|speicher)\b/i, "storage"],
];

/** Valid unitType enum values. */
const VALID_UNIT_TYPES = new Set(["apartment", "office", "parking", "garden", "storage", "other"]);

/**
 * Normalise a unitType value that the LLM returned.
 * Handles: correct enum value, wrong-case enum value, German term, or garbage.
 * Returns the normalised enum string or null if it cannot be resolved.
 */
function normalizeUnitType(value: unknown): string | null {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;

    // Exact match (case-insensitive) against valid enum values
    const lower = str.toLowerCase();
    if (VALID_UNIT_TYPES.has(lower)) return lower;

    // Try keyword matching against the raw string
    for (const [re, type] of UNIT_TYPE_KEYWORDS) {
        if (re.test(str)) return type;
    }
    return null;
}

/**
 * Attempt to determine unit type from raw text via keyword matching.
 */
function inferUnitType(rawText: string): string | null {
    // First check for a parenthesized type hint — e.g. "(Wohnung)"
    const parenMatch = rawText.match(/\(([^)]+)\)/);
    if (parenMatch) {
        const inner = parenMatch[1]!;
        for (const [re, type] of UNIT_TYPE_KEYWORDS) {
            if (re.test(inner)) return type;
        }
    }
    // Then scan the full text
    for (const [re, type] of UNIT_TYPE_KEYWORDS) {
        if (re.test(rawText)) return type;
    }
    return null;
}

/**
 * Attempt to parse MEA numerator from raw text.
 * Looks for fraction patterns like  78,59/1.000  or  120,0 / 10.000
 * Handles OCR artifacts like  08,0/1.,000  or  08,0/1,.000
 */
function inferMeaNumerator(rawText: string): number | null {
    // Clean OCR artifacts in the text: sequences like ".," or ",." → "."
    const cleaned = rawText.replace(/[.,]{2,}/g, ".");
    // Match patterns: digits with optional German decimals, slash, digits with optional thousands sep
    const meaRegex = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g;
    let match: RegExpExecArray | null;
    while ((match = meaRegex.exec(cleaned)) !== null) {
        const numerator = parseGermanNumber(match[1]!);
        const denominator = parseGermanNumber(match[2]!);
        // Sanity check: denominator should be a round number ≥ 100
        if (numerator !== null && denominator !== null && denominator >= 100) {
            return numerator;
        }
    }
    return null;
}

/**
 * Attempt to parse total MEA (denominator) from raw text.
 */
function inferTotalMea(rawText: string): number | null {
    // If exact match of a formatted number (e.g. "1.000") is passed directly from LLM
    const exact = parseGermanNumber(rawText);
    if (exact !== null && exact >= 100) return exact;

    // Clean OCR artifacts
    const cleaned = rawText.replace(/[.,]{2,}/g, ".");
    // Look for explicit total MEA patterns
    const totalRegex = /(?:gesamt|total|insgesamt|summe)[^0-9]*(\d+(?:[.,]\d+)?)/gi;
    let match: RegExpExecArray | null;
    while ((match = totalRegex.exec(cleaned)) !== null) {
        const val = parseGermanNumber(match[1]!);
        if (val !== null && val >= 100) return val;
    }
    // Fallback: look for standalone large round numbers like 1.000 or 10.000
    const fractionRegex = /\/\s*(\d+(?:\.\d+)*(?:,\d+)?)/g;
    while ((match = fractionRegex.exec(cleaned)) !== null) {
        const val = parseGermanNumber(match[1]!);
        if (val !== null && val >= 100) return val;
    }
    return null;
}

/**
 * German address regex: "Musterstraße 12, 10557 Berlin" or "Musterstr. 12\n10557 Berlin"
 */
function inferAddressFields(rawText: string): Record<string, string> | null {
    const fields: Record<string, string> = {};
    // Street + house number: "Somestraße 12a" or "Some Str. 12"
    const streetMatch = rawText.match(
        /([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\s.-]*(?:straße|strasse|str\.|weg|allee|platz|ring|damm|gasse|ufer|chaussee))\s+(\d+\s*[a-zA-Z]?)/i,
    );
    if (streetMatch) {
        fields.street = streetMatch[1]!.trim();
        fields.houseNumber = streetMatch[2]!.trim();
    }
    // Postal code + city: "10557 Berlin"
    const plzMatch = rawText.match(/\b(\d{5})\s+([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\s-]+)/);
    if (plzMatch) {
        fields.postalCode = plzMatch[1]!;
        fields.city = plzMatch[2]!.trim();
    }
    return Object.keys(fields).length > 0 ? fields : null;
}

type BuildingRef = { uuid: string; name: string };

function extractBuildingIdentifiers(text: string): Set<string> {
    const identifiers = new Set<string>();
    const regex = /\b(?:haus|building|geb(?:ä|ae)?ude)\s*([a-z]|\d{1,3})\b/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const value = match[1]?.trim().toLowerCase();
        if (value) identifiers.add(value);
    }
    return identifiers;
}

/**
 * Try to match a building from the raw text by looking for building names.
 * Uses a two-pass approach:
 *   1. Try matching full name segments (e.g. "Haus A", "Haus B") as phrases
 *   2. Fall back to unique token scoring, excluding tokens shared by all buildings
 * Returns the UUID of the best-matching building, or null.
 */
function inferBuildingRef(rawText: string, buildings: BuildingRef[]): string | null {
    const textLower = rawText.toLowerCase();
    const textIdentifiers = extractBuildingIdentifiers(rawText);

    if (textIdentifiers.size > 0) {
        const matches = buildings.filter((building) => {
            const buildingIdentifiers = extractBuildingIdentifiers(building.name);
            for (const identifier of textIdentifiers) {
                if (buildingIdentifiers.has(identifier)) return true;
            }
            return false;
        });
        if (matches.length === 1) return matches[0]!.uuid;
    }

    // Split each building name into segments on em-dashes / dashes
    // e.g. "Haus A — Parkside" → ["Haus A", "Parkside"]
    // e.g. "Haus B - Cityside — Haus B" → ["Haus B", "Cityside", "Haus B"]
    const buildingSegments = buildings.map((b) =>
        [...new Set(
            b.name
                .split(/[\u2014—]+|(?<!\w)-(?!\w)/)
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s.length >= 2),
        )],
    );

    // Pass 1: match full segments as phrases (most reliable)
    let bestUuid: string | null = null;
    let bestScore = 0;

    for (let i = 0; i < buildings.length; i++) {
        let score = 0;
        for (const seg of buildingSegments[i]!) {
            if (textLower.includes(seg)) score += seg.length; // Weight by length
        }
        if (score > bestScore) {
            bestScore = score;
            bestUuid = buildings[i]!.uuid;
        }
    }

    if (bestUuid) return bestUuid;

    // Pass 2: individual unique tokens, excluding shared tokens
    const allTokenSets = buildingSegments.map((segs) =>
        new Set(segs.flatMap((s) => s.split(/\s+/).filter((t) => t.length >= 2))),
    );

    // Find tokens that appear in ALL buildings (non-discriminating)
    const sharedTokens = new Set<string>();
    if (allTokenSets.length > 1) {
        for (const token of allTokenSets[0]!) {
            if (allTokenSets.every((s) => s.has(token))) {
                sharedTokens.add(token);
            }
        }
    }

    for (let i = 0; i < buildings.length; i++) {
        let score = 0;
        for (const token of allTokenSets[i]!) {
            if (sharedTokens.has(token)) continue; // Skip non-discriminating tokens
            if (textLower.includes(token)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestUuid = buildings[i]!.uuid;
        }
    }

    return bestScore > 0 ? bestUuid : null;
}

type FieldMap = Record<string, string | number | boolean | null>;

/**
 * Apply regex-based fallback parsing when the LLM left fields null/empty.
 */
function postProcessFields(
    rawText: string,
    sectionType: SectionType,
    fields: ExtractedField[],
    buildings?: BuildingRef[],
): ExtractedField[] {
    const map: FieldMap = {};
    for (const f of fields) map[f.key] = f.value;

    if (sectionType === "units.unit_block") {
        // Step 1: Normalise the LLM-returned unitType.
        // The LLM might return "Wohnung", "Apartment" (capitalised), etc.
        // instead of the expected lowercase enum value.
        const normalizedType = normalizeUnitType(map.unitType);
        if (normalizedType) {
            map.unitType = normalizedType;
        } else {
            // LLM returned garbage or null — clear it so the fallback runs.
            map.unitType = null;
        }

        // Step 2: If unitType is still null, try to infer from the description field.
        if (!map.unitType && map.description && typeof map.description === "string") {
            const fromDesc = normalizeUnitType(map.description);
            if (fromDesc) map.unitType = fromDesc;
        }

        // Step 3: Regex fallback — scan the raw text for German unit keywords.
        if (!map.unitType) {
            const inferred = inferUnitType(rawText);
            if (inferred) map.unitType = inferred;
        }

        // Normalise meaNumerator: the LLM sometimes returns a string like
        // "90.0/1.000" or a whole sentence instead of a plain number.
        if (map.meaNumerator != null && typeof map.meaNumerator !== "number") {
            const str = String(map.meaNumerator);
            // Try extracting from a fraction pattern first (handles "90.0/1.000")
            const fromFraction = inferMeaNumerator(str);
            if (fromFraction !== null) {
                map.meaNumerator = fromFraction;
            } else {
                // No fraction found — try plain German number parse (e.g. "78,59")
                const asNum = parseGermanNumber(str);
                if (asNum !== null && asNum > 0 && asNum < 10000) {
                    map.meaNumerator = asNum;
                } else {
                    // Completely unparseable — null it out so rawText fallback runs
                    map.meaNumerator = null;
                }
            }
        }

        // Fallback: meaNumerator still missing — scan the raw text
        if (map.meaNumerator == null) {
            const inferred = inferMeaNumerator(rawText);
            if (inferred !== null) map.meaNumerator = inferred;
        }

        // buildingRef: map LLM label (building_1, building_2, ...) → real UUID
        if (buildings && buildings.length > 0) {
            if (map.buildingRef) {
                const labelMatch = String(map.buildingRef).match(/^building_(\d+)$/);
                if (labelMatch) {
                    const idx = parseInt(labelMatch[1]!, 10) - 1;
                    if (idx >= 0 && idx < buildings.length) {
                        map.buildingRef = buildings[idx]!.uuid;
                    } else {
                        map.buildingRef = null; // out of range
                    }
                } else {
                    // Check if LLM returned an actual UUID (shouldn't, but handle it)
                    const validUuids = new Set(buildings.map((b) => b.uuid));
                    if (!validUuids.has(String(map.buildingRef))) {
                        map.buildingRef = null;
                    }
                }
            }
            // Auto-assign when there's exactly 1 building and LLM didn't pick
            if (!map.buildingRef && buildings.length === 1) {
                map.buildingRef = buildings[0]!.uuid;
            }

            // Regex fallback: scan raw text for building name keywords
            if (!map.buildingRef && buildings.length > 1) {
                const inferred = inferBuildingRef(rawText, buildings);
                if (inferred) map.buildingRef = inferred;
            }
        }
    }

    if (sectionType === "weg.mea_declaration") {
        // Normalise totalMea if LLM returned a string
        if (map.totalMea != null && typeof map.totalMea !== "number") {
            const str = String(map.totalMea);
            const fromFraction = inferTotalMea(str);
            if (fromFraction !== null) {
                map.totalMea = fromFraction;
            } else {
                const asNum = parseGermanNumber(str);
                if (asNum !== null && asNum > 0) {
                    map.totalMea = asNum;
                } else {
                    map.totalMea = null;
                }
            }
        }

        if (map.totalMea == null) {
            const inferred = inferTotalMea(rawText);
            if (inferred !== null) map.totalMea = inferred;
        }
    }

    // Address fallback for any section with address fields
    if (
        sectionType === "core.address" ||
        sectionType === "core.building" ||
        sectionType === "weg.property_manager" ||
        sectionType === "weg.accountant"
    ) {
        const prefix = sectionType === "core.address" ? "" : "address";
        const streetKey = prefix ? `${prefix}Street` : "street";
        const houseKey = prefix ? `${prefix}HouseNumber` : "houseNumber";
        const plzKey = prefix ? `${prefix}PostalCode` : "postalCode";
        const cityKey = prefix ? `${prefix}City` : "city";

        const missingAddress = !map[streetKey] || !map[plzKey] || !map[cityKey];
        if (missingAddress) {
            const inferred = inferAddressFields(rawText);
            if (inferred) {
                if (!map[streetKey] && inferred.street) map[streetKey] = inferred.street;
                if (!map[houseKey] && inferred.houseNumber) map[houseKey] = inferred.houseNumber;
                if (!map[plzKey] && inferred.postalCode) map[plzKey] = inferred.postalCode;
                if (!map[cityKey] && inferred.city) map[cityKey] = inferred.city;
            }
        }
    }

    // Rebuild fields array
    return Object.entries(map).map(([key, value]) => ({ key, value }));
}

// ─── LLM extraction ──────────────────────────────────────────────────

function buildTool(schema: FieldSchemaEntry): JsonToolSchema {
    return {
        name: "extract_section_fields",
        description: "Extract structured field values from a PDF section.",
        outputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                fields: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            key: { type: "string", enum: Object.keys(schema.fields) },
                            value: { type: ["string", "number", "boolean", "null"] },
                        },
                        required: ["key", "value"],
                    },
                },
            },
            required: ["fields"],
        },
    };
}

function buildMessages(
    rawText: string,
    sectionType: SectionType,
    schema: FieldSchemaEntry,
    buildings?: BuildingRef[],
): LlmMessage[] {
    const fieldDescriptions = Object.entries(schema.fields)
        .map(([key, def]) => `  - ${key}: ${(def as { description?: string }).description ?? key}`)
        .join("\n");

    const parts: string[] = [
        `You are extracting structured data from a "${sectionType}" section of a German property document (Teilungserklärung / Gemeinschaftsordnung).`,
        "",
        schema.prompt,
        "",
        "Fields to extract:",
        fieldDescriptions,
    ];

    // Inject building context for units — use simple labels the LLM can output
    if (buildings && buildings.length > 0) {
        parts.push("");
        parts.push("AVAILABLE BUILDINGS (for the buildingRef field, return the label exactly):");
        for (let i = 0; i < buildings.length; i++) {
            parts.push(`  - "building_${i + 1}" = ${buildings[i]!.name}`);
        }
        parts.push("Determine which building this unit belongs to based on entrance, address, building name, or any reference in the text.");
        parts.push("If you cannot determine the building, return null for buildingRef.");
    }

    parts.push("");
    parts.push("Return each field with its key and value.");
    parts.push("If a value cannot be determined, return null.");
    parts.push("Values should be in their original language (German).");
    parts.push("Numbers should be returned as numbers, not strings.");

    return [
        {
            role: "system",
            content: parts.join("\n"),
        },
        {
            role: "user",
            content: rawText,
        },
    ];
}

/**
 * Extract structured field values from a section's raw text using LLM.
 *
 * Returns `null` when the section type has no defined field schema (e.g.
 * "unknown").
 */
async function extractSectionFields(
    rawText: string,
    sectionType: SectionType,
    buildings?: BuildingRef[],
): Promise<ExtractionResult | null> {
    let schema = SECTION_FIELD_SCHEMAS[sectionType];
    if (!schema) return null;

    // For unit sections, dynamically inject buildingRef when buildings are available.
    // We use simple labels (building_1, building_2, ...) that the LLM can reliably
    // output, then map back to real UUIDs in postProcessFields.
    if (sectionType === "units.unit_block" && buildings && buildings.length > 0) {
        const labels = buildings.map((_, i) => `building_${i + 1}`);
        schema = {
            ...schema,
            fields: {
                ...schema.fields,
                buildingRef: {
                    type: ["string", "null"],
                    enum: [...labels, null],
                    description: "Which building this unit belongs to. Pick one of the building labels.",
                },
            },
            required: [...schema.required, "buildingRef"],
        };
    }

    const tool = buildTool(schema);
    const messages = buildMessages(rawText, sectionType, schema, buildings);

    const result = await runJsonTool<{ fields: ExtractedField[] }>({
        tool,
        messages,
        timeoutMs: 30_000,
    });

    if (!result.parsed?.fields) {
        return { fields: [], elapsedMs: result.elapsedMs };
    }

    // Normalise: strip unknown keys, coerce types
    const validKeys = new Set(Object.keys(schema.fields));
    const llmFields = result.parsed.fields
        .filter((f) => validKeys.has(f.key))
        .map((f) => ({
            key: f.key,
            value: f.value ?? null,
        }));

    // Apply regex fallback for any fields the LLM left empty
    const fields = postProcessFields(rawText, sectionType, llmFields, buildings);

    return { fields, elapsedMs: result.elapsedMs };
}

export {
    extractSectionFields,
    SECTION_FIELD_SCHEMAS,
    type ExtractedField,
    type ExtractionResult,
    type FieldSchemaEntry,
    // Exported for unit tests
    parseGermanNumber,
    normalizeUnitType,
    inferUnitType,
    inferMeaNumerator,
    inferTotalMea,
    inferAddressFields,
    inferBuildingRef,
    postProcessFields,
};
