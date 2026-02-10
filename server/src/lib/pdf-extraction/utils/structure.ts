import { splitTokens } from "./text";

const stripTrailingPunctuation = (value: string) => {
    let end = value.length;
    while (end > 0) {
        const ch = value[end - 1];
        if (ch === "." || ch === ")" || ch === ":" || ch === ";" || ch === ",") end -= 1;
        else break;
    }
    return value.slice(0, end);
};

const ROMAN_CHARS = new Set(["I", "V", "X", "L", "C", "D", "M"]);

const isRomanNumeral = (token: string) => {
    if (!token) return false;
    let hasRoman = false;
    for (const ch of token.toUpperCase()) {
        if (!ROMAN_CHARS.has(ch)) return false;
        hasRoman = true;
    }
    return hasRoman;
};

const parseLeadingNumber = (token: string) => {
    const cleaned = stripTrailingPunctuation(token);
    if (!cleaned) return null;
    let hasDigits = false;
    for (const ch of cleaned) {
        if (ch < "0" || ch > "9") return null;
        hasDigits = true;
    }
    if (!hasDigits) return null;
    return Number.parseInt(cleaned, 10);
};

const leadingEnumerationScore = (text: string) => {
    const tokens = splitTokens(text);
    const token = tokens[0] ?? "";
    if (!token) return 0;

    const sectionSymbol = token.includes("\u00A7");
    if (sectionSymbol) return 1;

    const numeric = parseLeadingNumber(token);
    if (numeric !== null) return 0.85;

    const trimmed = stripTrailingPunctuation(token);
    if (trimmed.length === 1 && /[A-Za-z]/.test(trimmed)) return 0.6;
    if (isRomanNumeral(trimmed)) return 0.7;
    return 0;
};

export {
    leadingEnumerationScore,
};
