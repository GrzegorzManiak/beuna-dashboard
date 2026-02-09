import type { SectionData, SectionFieldValue } from "../types";

type SectionEditorProps = {
    section: SectionData;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    propertyType?: "WEG" | "MV";
    availableBuildings?: Map<string, string>;
};

function updateSectionField(
    section: SectionData,
    onSectionUpdate: SectionEditorProps["onSectionUpdate"],
    key: string,
    value: SectionFieldValue,
): void {
    if (!onSectionUpdate) return;
    const nextFields = { ...(section.fields ?? {}), [key]: value };
    onSectionUpdate(section.id, { fields: nextFields });
}

function getFieldValue(section: SectionData, key: string): SectionFieldValue {
    return section.fields?.[key] ?? "";
}

function toInputString(value: SectionFieldValue): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function toOptionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const next = Number(value);
    if (Number.isNaN(next)) return null;
    return next;
}

export {
    updateSectionField,
    getFieldValue,
    toInputString,
    toOptionalNumber,
    type SectionEditorProps,
};
