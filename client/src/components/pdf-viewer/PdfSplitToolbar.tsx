import { useMemo } from "react";
import type { Ref } from "react";
import type { SectionData, SectionFieldValue, SectionType } from "./types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "../ui/combobox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Option = { label: string; value: string };

const SECTION_TYPE_OPTIONS: Array<{ label: string; value: SectionType }> = [
    { label: "Property Overview", value: "core.property_overview" },
    { label: "Address", value: "core.address" },
    { label: "Building", value: "core.building" },
    { label: "Shared Building Features", value: "core.building_shared_features" },
    { label: "Unit Block", value: "units.unit_block" },
    { label: "Special Rights Block", value: "weg.special_rights_block" },
    { label: "MEA Total Check", value: "weg.mea_total_check" },
    { label: "Administration Block", value: "weg.administration_block" },
    { label: "Owner Entity Block", value: "mv.owner_entity_block" },
    { label: "Unknown", value: "unknown" },
];

const MANAGEMENT_HINT_OPTIONS = [
    { label: "Unknown", value: "unknown" },
    { label: "WEG", value: "WEG" },
    { label: "MV", value: "MV" },
];

const UNIT_TYPE_OPTIONS = [
    { label: "Apartment", value: "apartment" },
    { label: "Office", value: "office" },
    { label: "Parking", value: "parking" },
    { label: "Garden", value: "garden" },
    { label: "Storage", value: "storage" },
    { label: "Other", value: "other" },
];

const RIGHT_TYPE_OPTIONS = [
    { label: "Terrace", value: "terrace" },
    { label: "Roof terrace", value: "roof_terrace" },
    { label: "Garden", value: "garden" },
    { label: "Parking access", value: "parking_access" },
    { label: "Other", value: "other" },
];

type FieldDef = {
    key: string;
    label: string;
    type: "text" | "number" | "select" | "bool";
    options?: Option[];
    placeholder?: string;
    hint?: string;
    scope?: "WEG" | "MV" | "ANY";
};

const SECTION_FIELDS: Record<SectionType, FieldDef[]> = {
    "core.property_overview": [
        { key: "propertyName", label: "Property name", type: "text" },
        { key: "propertyId", label: "Internal reference", type: "text", placeholder: "Optional" },
        {
            key: "managementTypeHint",
            label: "Management type hint",
            type: "select",
            options: MANAGEMENT_HINT_OPTIONS,
            hint: "Optional",
        },
    ],
    "core.address": [
        { key: "street", label: "Street", type: "text" },
        { key: "houseNumber", label: "House number", type: "text" },
        { key: "postalCode", label: "Postal code", type: "text" },
        { key: "city", label: "City", type: "text" },
        { key: "country", label: "Country", type: "text", placeholder: "Optional" },
    ],
    "core.building": [
        { key: "buildingName", label: "Building name", type: "text" },
        { key: "label", label: "Label", type: "text", placeholder: "Parkside / Cityside" },
        { key: "addressStreet", label: "Street", type: "text" },
        { key: "addressHouseNumber", label: "House number", type: "text" },
        { key: "addressPostalCode", label: "Postal code", type: "text" },
        { key: "addressCity", label: "City", type: "text" },
        { key: "addressCountry", label: "Country", type: "text", placeholder: "Optional" },
        { key: "buildYear", label: "Build year", type: "number", placeholder: "Optional" },
        { key: "floors", label: "Floors", type: "number", placeholder: "Optional" },
        { key: "notes", label: "Notes", type: "text", placeholder: "Optional" },
    ],
    "core.building_shared_features": [
        { key: "hasGarage", label: "Has garage", type: "bool" },
        { key: "heatingType", label: "Heating type", type: "text" },
        { key: "energyStandard", label: "Energy standard", type: "text" },
        { key: "notes", label: "Notes", type: "text", placeholder: "Optional" },
    ],
    "units.unit_block": [
        { key: "unitNumber", label: "Unit number", type: "text" },
        { key: "unitType", label: "Unit type", type: "select", options: UNIT_TYPE_OPTIONS },
        { key: "buildingRef", label: "Building", type: "text" },
        { key: "floor", label: "Floor", type: "text", placeholder: "Optional" },
        { key: "entrance", label: "Entrance", type: "text", placeholder: "Optional" },
        { key: "area", label: "Area", type: "number", placeholder: "Optional" },
        { key: "rooms", label: "Rooms", type: "text", placeholder: "Optional" },
        { key: "description", label: "Description", type: "text", placeholder: "Optional" },
        { key: "meaNumerator", label: "MEA numerator", type: "number", scope: "WEG" },
        { key: "meaDenominator", label: "MEA denominator", type: "number", scope: "WEG" },
        { key: "meaRawText", label: "MEA raw text", type: "text", scope: "WEG" },
    ],
    "weg.special_rights_block": [
        { key: "unitRef", label: "Unit reference", type: "text" },
        { key: "rightType", label: "Right type", type: "select", options: RIGHT_TYPE_OPTIONS },
        { key: "description", label: "Description", type: "text" },
        { key: "area", label: "Area", type: "number", placeholder: "Optional" },
    ],
    "weg.mea_total_check": [],
    "weg.administration_block": [
        { key: "managerName", label: "Manager name", type: "text" },
        { key: "managerAddress", label: "Manager address", type: "text" },
        { key: "accountantName", label: "Accountant name", type: "text", placeholder: "Optional" },
        { key: "notes", label: "Notes", type: "text", placeholder: "Optional" },
    ],
    "mv.owner_entity_block": [
        { key: "ownerName", label: "Owner name", type: "text" },
        { key: "ownerType", label: "Owner type", type: "text", placeholder: "Company / Individual" },
        { key: "registrationId", label: "Registration ID", type: "text", placeholder: "Optional" },
    ],
    unknown: [],
};

const STATE_BADGES: Record<string, { label: string; className: string }> = {
    valid: { label: "Valid", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    conflict: { label: "Conflict", className: "bg-red-100 text-red-700 border-red-200" },
    processing: { label: "Processing", className: "bg-amber-100 text-amber-700 border-amber-200" },
    identifying: { label: "Identifying", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    unknown: { label: "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const DEFAULT_FIELD_VALUE = "";

type PdfSplitToolbarProps = {
    closeSplit: () => void;
    splitToolbarRef: Ref<HTMLDivElement>;
    sections: SectionData[];
    activeSectionId: string | null;
    onActiveSectionChange?: (sectionId: string | null) => void;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    onSectionDelete?: (sectionId: string) => void;
    propertyType?: "WEG" | "MV";
    pageNumber: number;
};

function PdfSplitToolbar({
    closeSplit,
    splitToolbarRef,
    sections,
    activeSectionId,
    onActiveSectionChange,
    onSectionUpdate,
    onSectionDelete,
    propertyType = "WEG",
    pageNumber,
}: PdfSplitToolbarProps) {
    const sectionsOnPage = useMemo(
        () => sections.filter((section) => section.textPosition.page.includes(pageNumber)),
        [sections, pageNumber],
    );

    const activeSection = useMemo(() => {
        if (activeSectionId) return sections.find((section) => section.id === activeSectionId) ?? null;
        return sectionsOnPage[0] ?? null;
    }, [activeSectionId, sections, sectionsOnPage]);

    const unitSections = useMemo(
        () => sections.filter((section) => section.sectionType === "units.unit_block"),
        [sections],
    );

    const stateBadge = activeSection?.state ? STATE_BADGES[activeSection.state] : STATE_BADGES.unknown;
    const sectionTypeValue = activeSection?.sectionType ?? "unknown";
    const typeLabel = SECTION_TYPE_OPTIONS.find((option) => option.value === sectionTypeValue)?.label;

    const updateSection = (updates: Partial<SectionData>) => {
        if (!activeSection || !onSectionUpdate) return;
        onSectionUpdate(activeSection.id, updates);
    };

    const updateField = (key: string, value: SectionFieldValue) => {
        if (!activeSection || !onSectionUpdate) return;
        const nextFields = { ...(activeSection.fields ?? {}), [key]: value };
        onSectionUpdate(activeSection.id, { fields: nextFields });
    };

    const renderCombobox = (
        field: FieldDef,
        value: string | undefined,
        disabled: boolean,
        onChange: (nextValue: string) => void,
    ) => {
        const items = field.options?.map((option) => option.value) ?? [];
        const labelByValue = new Map(
            (field.options ?? []).map((option) => [option.value, option.label]),
        );

        return (
            <Combobox
                items={items}
                value={value}
                onValueChange={(nextValue) => onChange(nextValue ?? "")}
                itemToStringLabel={(item) => labelByValue.get(String(item)) ?? String(item)}
                disabled={disabled}
            >
                <ComboboxInput
                    placeholder={field.placeholder ?? "Select…"}
                    className="w-full"
                />
                <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                        {(item) => (
                            <ComboboxItem key={item} value={item}>
                                {labelByValue.get(item) ?? item}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        );
    };

    const renderField = (field: FieldDef) => {
        const rawValue = activeSection?.fields?.[field.key];
        const value = rawValue ?? DEFAULT_FIELD_VALUE;
        const disabled = !activeSection || !onSectionUpdate;

        if (field.type === "bool") {
            const checked = Boolean(rawValue);
            return (
                <div key={field.key} className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-gray-600">{field.label}</Label>
                    <Button
                        type="button"
                        size="xs"
                        variant={checked ? "default" : "outline"}
                        disabled={disabled}
                        onClick={() => updateField(field.key, !checked)}
                        className="text-[11px]"
                    >
                        {checked ? "Yes" : "No"}
                    </Button>
                </div>
            );
        }

        if (field.type === "select") {
            const selectValue =
                value === null || value === undefined || value === "" ? undefined : String(value);
            return (
                <div key={field.key} className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-600">{field.label}</Label>
                    {renderCombobox(field, selectValue, disabled, (nextValue) =>
                        updateField(field.key, nextValue),
                    )}
                </div>
            );
        }

        const inputValue = value === null || value === undefined ? "" : String(value);

        return (
            <div key={field.key} className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">{field.label}</Label>
                <Input
                    type={field.type === "number" ? "number" : "text"}
                    value={inputValue}
                    disabled={disabled}
                    onChange={(event) => {
                        if (field.type === "number") {
                            const next = event.target.value === "" ? null : Number(event.target.value);
                            updateField(field.key, Number.isNaN(next) ? null : next);
                            return;
                        }
                        updateField(field.key, event.target.value);
                    }}
                    placeholder={field.placeholder}
                />
            </div>
        );
    };

    const renderFieldsForType = (sectionType: SectionType) => {
        const fields = SECTION_FIELDS[sectionType] ?? [];
        const filtered = fields.filter((field) =>
            field.scope === undefined || field.scope === "ANY" || field.scope === propertyType,
        );

        if (!filtered.length) {
            return (
                <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                    No editable fields for this section type yet.
                </div>
            );
        }

        return <div className="grid gap-3 sm:grid-cols-2">{filtered.map(renderField)}</div>;
    };

    const renderUnitTable = () => {
        if (!unitSections.length) {
            return (
                <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                    No unit blocks yet. Drag select a unit block to create one.
                </div>
            );
        }

        return (
            <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                    {unitSections.length} Unit {unitSections.length > 1 ? "Blocks" : "Block"}
                </div>
                <div className="overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white text-[10px] uppercase tracking-wide text-gray-400">
                            <tr>
                                <th className="px-3 py-2 text-left">Unit</th>
                                <th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Building</th>
                                <th className="px-3 py-2 text-left">Floor</th>
                                <th className="px-3 py-2 text-right">Area</th>
                                {propertyType === "WEG" ? (
                                    <th className="px-3 py-2 text-right">MEA</th>
                                ) : null}
                                <th className="px-3 py-2 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unitSections.map((section) => {
                                const isActive = section.id === activeSection?.id;
                                const fields = section.fields ?? {};
                                const status = section.state ? STATE_BADGES[section.state] : STATE_BADGES.unknown;
                                const meaValue =
                                    fields.meaNumerator && fields.meaDenominator
                                        ? `${fields.meaNumerator}/${fields.meaDenominator}`
                                        : fields.meaRawText || "–";

                                return (
                                    <tr
                                        key={section.id}
                                        className={`cursor-pointer border-t border-gray-100 transition-colors ${isActive ? "bg-emerald-50" : "hover:bg-gray-50"
                                            }`}
                                        onClick={() => onActiveSectionChange?.(section.id)}
                                    >
                                        <td className="px-3 py-2 font-medium text-gray-900">
                                            {fields.unitNumber || section.id}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {fields.unitType || "–"}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {fields.buildingRef || "–"}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {fields.floor || "–"}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">
                                            {fields.area || "–"}
                                        </td>
                                        {propertyType === "WEG" ? (
                                            <td className="px-3 py-2 text-right text-gray-600">{meaValue}</td>
                                        ) : null}
                                        <td className="px-3 py-2 text-gray-600">
                                            <Badge
                                                variant="outline"
                                                className={status?.className ?? "bg-slate-100 text-slate-600"}
                                            >
                                                {status?.label ?? "Unknown"}
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const handleNext = () => {
        const candidates = sectionsOnPage.length ? sectionsOnPage : sections;
        if (!candidates.length) return;
        const currentId = activeSection?.id ?? candidates[0]?.id;
        if (!currentId) return;
        const currentIndex = candidates.findIndex((section) => section.id === currentId);
        const nextSection = currentIndex >= 0 ? candidates[currentIndex + 1] : candidates[0];
        if (!nextSection) return;
        onActiveSectionChange?.(nextSection.id);
    };

    const handleDelete = () => {
        if (!activeSection || !onSectionDelete) return;
        onSectionDelete(activeSection.id);
    };

    return (
        <div
            id="pdf-split-toolbar"
            ref={splitToolbarRef}
            className="pointer-events-auto mx-auto w-full bg-white border-y border-gray-300"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant="outline"
                            className={stateBadge?.className ?? STATE_BADGES.unknown.className}
                        >
                            {stateBadge?.label ?? "Unknown"}
                        </Badge>
                        <span className="text-sm font-semibold text-gray-900">
                            {activeSection?.id ?? `Page ${pageNumber}`}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-600">Section type</Label>
                    {renderCombobox(
                        {
                            key: "sectionType",
                            label: "Section type",
                            type: "select",
                            options: SECTION_TYPE_OPTIONS.map((option) => ({
                                label: option.label,
                                value: option.value,
                            })),
                            placeholder: "Select section type",
                        },
                        sectionTypeValue,
                        !activeSection || !onSectionUpdate,
                        (nextValue) => updateSection({ sectionType: nextValue as SectionType }),
                    )}
                </div>
            </div>

            <div className="w-full border-t border-gray-200" >
                <div className="p-4">
                    {sectionTypeValue === "units.unit_block" ? renderUnitTable() : null}
                    <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {typeLabel ?? "Section editor"}
                        </div>
                        {activeSection
                            ? renderFieldsForType(sectionTypeValue)
                            : (
                                <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                                    No section selected.
                                </div>
                            )}
                    </div>
                </div>
            </div>

            <div className="w-full border-t border-gray-200 bg-muted" >
                <div className="flex gap-4 bg-muted p-4 pb-6 mt-2">
                    <Button
                        variant="outline"
                        className="text-lg h-10 px-10 cursor-pointer"
                        onClick={closeSplit}
                    >
                        Close
                    </Button>
                    <Button
                        variant="destructive"
                        className="text-lg h-10 px-10 cursor-pointer"
                        onClick={handleDelete}
                        disabled={!activeSection || !onSectionDelete}
                    >
                        Delete
                    </Button>
                    <Button
                        type="submit"
                        className="grow text-lg h-10 cursor-pointer"
                        onClick={handleNext}
                        disabled={!activeSection}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}

export { PdfSplitToolbar };
