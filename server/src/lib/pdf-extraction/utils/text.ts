const normalizeWhitespace = (value: string) =>
    value.replace(/\s+/g, " ").trim();

const splitTokens = (value: string) =>
    normalizeWhitespace(value).split(" ").filter(Boolean);

const DIACRITIC_RE = /[\u0300-\u036f]/g;

/**
 * Convert German umlauts to their digraph equivalents before stripping diacritics.
 * This ensures both "Gebäude" and "gebaeude" normalize to the same form.
 */
const expandUmlauts = (value: string) =>
    value
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/Ä/g, "Ae")
        .replace(/Ö/g, "Oe")
        .replace(/Ü/g, "Ue");

const stripDiacritics = (value: string) =>
    expandUmlauts(value)
        .normalize("NFD")
        .replace(DIACRITIC_RE, "")
        .replace(/ß/g, "ss");

const normalizeForMatch = (value: string) =>
    stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const countLetters = (value: string) => {
    let count = 0;
    for (const ch of value) {
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        if (lower !== upper) count += 1;
    }
    return count;
};

const countUppercaseLetters = (value: string) => {
    let count = 0;
    for (const ch of value) {
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        if (lower !== upper && ch === upper) count += 1;
    }
    return count;
};

const uppercaseRatio = (value: string) => {
    const letters = countLetters(value);
    if (letters === 0) return 0;
    return countUppercaseLetters(value) / letters;
};

const titleCaseRatio = (tokens: string[]) => {
    if (!tokens.length) return 0;
    let hits = 0;
    for (const token of tokens) {
        if (!token) continue;
        const first = token[0];
        if (!first) continue;
        const isLetter = first.toLowerCase() !== first.toUpperCase();
        if (!isLetter) continue;
        if (first === first.toUpperCase()) hits += 1;
    }
    return hits / tokens.length;
};

const containsLetter = (value: string) => countLetters(value) > 0;

const isBoldFontName = (fontName: string) => {
    const name = fontName.toLowerCase();
    return (
        name.includes("bold") ||
        name.includes("black") ||
        name.includes("heavy") ||
        name.includes("semibold")
    );
};

export {
    normalizeWhitespace,
    splitTokens,
    normalizeForMatch,
    uppercaseRatio,
    titleCaseRatio,
    containsLetter,
    isBoldFontName,
};
