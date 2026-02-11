import type { SectionData, SectionFieldValue } from "../pdfViewer.types";

type SectionEditorProps = {
    section: SectionData;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    propertyType?: "WEG" | "MV";
    availableBuildings?: Map<string, string>;
    missingFields?: Set<string>;
    totalMeaDenominator?: number | null;
};

function updateSectionField(
    section: SectionData,
    onSectionUpdate: SectionEditorProps["onSectionUpdate"],
    key: string,
    value: SectionFieldValue, ){
    if (!onSectionUpdate) return;
    const nextFields = { ...(section.fields ?? {}), [key]: value };
    onSectionUpdate(section.id, { fields: nextFields });
}

function getFieldValue(section: SectionData, key: string ){
    return section.fields?.[key] ?? "";
}

function toInputString(value: SectionFieldValue ){
    if (value === null || value === undefined) return "";
    return String(value);
}

function toOptionalNumber(value: string ){
    if (!value.trim()) return null;
    const next = Number(value);
    if (Number.isNaN(next)) return null;
    return next;
}

export {
    getFieldValue,
    type SectionEditorProps,
    toInputString,
    toOptionalNumber,
    updateSectionField,
};
