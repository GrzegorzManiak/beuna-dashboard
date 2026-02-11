import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropertySection, PropertySectionItem } from "@/api/properties";
import { useUpdatePropertyMutation } from "@/hooks/useUpdatePropertyMutation";
import { useUpdateSectionMutation } from "@/hooks/useUpdateSectionMutation";
import { ReviewPanelAdministrationBlock } from "./reviewPanel/reviewPanelAdministrationBlock";
import { ReviewPanelAdministrationModal, type ReviewPanelAdministrationDraft } from "./reviewPanel/reviewPanelAdministrationModal";
import { ReviewPanelBuildingsTable } from "./reviewPanel/reviewPanelBuildingsTable";
import { ReviewPanelConfirmationBlock } from "./reviewPanel/reviewPanelConfirmationBlock";
import { ReviewPanelOwnershipCard } from "./reviewPanel/reviewPanelOwnershipCard";
import { ReviewPanelPropertyBlock } from "./reviewPanel/reviewPanelPropertyBlock";
import { ReviewPanelPropertyModal } from "./reviewPanel/reviewPanelPropertyModal";
import { ReviewPanelSection } from "./reviewPanel/reviewPanelSection";
import { ReviewPanelSpecialRightsList, type EditableSpecialRightField } from "./reviewPanel/reviewPanelSpecialRightsList";
import { ReviewPanelStatusBanner } from "./reviewPanel/reviewPanelStatusBanner";
import { ReviewPanelUnitsTable, type EditableUnitField } from "./reviewPanel/reviewPanelUnitsTable";
import type {
    ReviewPanelAdministrationPerson,
    ReviewPanelBuildingOption,
    ReviewPanelBuildingRow,
    ReviewPanelPropertyDraft,
    ReviewPanelSpecialRightRow,
    ReviewPanelUnitRow,
    ReviewPanelValidation,
} from "./reviewPanel/reviewPanelTypes";

type NewPropertyReviewPanelProps = {
    propertyId: string;
    propertyType: "WEG" | "MV";
    propertyName: string;
    street: string;
    postalCode: string;
    city: string;
    sections: PropertySection[];
    onBack: () => void;
    onSectionsChange: (sections: PropertySection[]) => void;
    onPropertyDetailsChange: (next: ReviewPanelPropertyDraft) => void;
    onCreated: () => void;
};

type SectionFields = Record<string, string | number | boolean | null>;

type ReviewPanelSectionEntry = {
    id: string;
    parentSectionId: string;
    itemId: string | null;
    itemIndex: number;
    fields: SectionFields;
};

function toFields(value: PropertySection["fields"] | PropertySectionItem["fields"] ){
    if (!value || typeof value !== "object") return {} as SectionFields;
    return value as SectionFields;
}

function toStringValue(value: string | number | boolean | null | undefined ){
    if (value === null || value === undefined) return "";
    return String(value);
}

function toNumberValue(value: string | number | boolean | null | undefined ){
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value ? 1 : 0;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
}

function collectEntries(sections: PropertySection[], sectionType: string ){
    const result: ReviewPanelSectionEntry[] = [];

    for (const section of sections) {
        const hasItems = Array.isArray(section.items) && section.items.length > 0;

        // Only add the parent section itself if it has NO items.
        // When items exist they represent the individual entries (e.g.
        // individual buildings inside a core.building container) and the
        // container section should not be counted as an extra entry.
        if (section.sectionType === sectionType && !hasItems) {
            result.push({
                id: section.id,
                parentSectionId: section.id,
                itemId: null,
                itemIndex: -1,
                fields: toFields(section.fields),
            });
        }

        if (!hasItems) continue;

        for (let itemIndex = 0; itemIndex < section.items!.length; itemIndex += 1) {
            const item = section.items[itemIndex];
            if (!item) continue;
            const resolvedType = item.sectionType ?? section.sectionType;
            if (resolvedType !== sectionType) continue;

            result.push({
                id: item.id ?? `${section.id}-${sectionType}-${itemIndex}`,
                parentSectionId: section.id,
                itemId: item.id ?? null,
                itemIndex,
                fields: toFields(item.fields),
            });
        }
    }

    return result;
}

function normalizeAddress(street: string, postalCode: string, city: string ){
    const streetLine = street.trim();
    const cityLine = [postalCode.trim(), city.trim()].filter(Boolean).join(" ").trim();
    return [streetLine, cityLine].filter((value) => value.length > 0).join(", ");
}

function NewPropertyReviewPanel({
    propertyId,
    propertyType,
    propertyName,
    street,
    postalCode,
    city,
    sections,
    onBack,
    onSectionsChange,
    onPropertyDetailsChange,
    onCreated,
}: NewPropertyReviewPanelProps){
    const updateSectionMutation = useUpdateSectionMutation();
    const { mutateAsync: updateProperty } = useUpdatePropertyMutation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [propertyModalOpen, setPropertyModalOpen] = useState<boolean>(false);
    const [administrationModalOpen, setAdministrationModalOpen] = useState<boolean>(false);
    const [savingRowId, setSavingRowId] = useState<string | null>(null);
    const [isSavingPropertyDetails, setIsSavingPropertyDetails] = useState<boolean>(false);
    const [isSavingAdministration, setIsSavingAdministration] = useState<boolean>(false);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [confirmed, setConfirmed] = useState<boolean>(false);

    const buildingEntries = useMemo(() => collectEntries(sections, "core.building"), [sections]);
    const unitEntries = useMemo(() => collectEntries(sections, "units.unit_block"), [sections]);
    const specialRightsEntries = useMemo(() => collectEntries(sections, "weg.special_rights"), [sections]);
    const managerEntries = useMemo(() => collectEntries(sections, "weg.property_manager"), [sections]);
    const accountantEntries = useMemo(() => collectEntries(sections, "weg.accountant"), [sections]);
    const meaEntries = useMemo(() => collectEntries(sections, "weg.mea_declaration"), [sections]);

    const unitEntryById = useMemo(() => {
        const map = new Map<string, ReviewPanelSectionEntry>();
        for (const entry of unitEntries) map.set(entry.id, entry);
        return map;
    }, [unitEntries]);

    const buildingEntryById = useMemo(() => {
        const map = new Map<string, ReviewPanelSectionEntry>();
        for (const entry of buildingEntries) map.set(entry.id, entry);
        return map;
    }, [buildingEntries]);

    const specialRightsEntryById = useMemo(() => {
        const map = new Map<string, ReviewPanelSectionEntry>();
        for (const entry of specialRightsEntries) map.set(entry.id, entry);
        return map;
    }, [specialRightsEntries]);

    const buildingRows = useMemo<ReviewPanelBuildingRow[]>(() => {
        const rows: ReviewPanelBuildingRow[] = [];

        for (const entry of buildingEntries) {
            const buildingUuid = toStringValue(entry.fields.buildingUuid).trim() || entry.id;
            const unitCount = unitEntries.filter((unitEntry) => toStringValue(unitEntry.fields.buildingRef).trim() === buildingUuid).length;

            rows.push({
                id: entry.id,
                parentSectionId: entry.parentSectionId,
                itemId: entry.itemId,
                buildingUuid,
                buildingName: toStringValue(entry.fields.buildingName),
                label: toStringValue(entry.fields.label),
                addressStreet: toStringValue(entry.fields.addressStreet),
                addressHouseNumber: toStringValue(entry.fields.addressHouseNumber),
                addressPostalCode: toStringValue(entry.fields.addressPostalCode),
                addressCity: toStringValue(entry.fields.addressCity),
                unitCount,
                buildYear: toStringValue(entry.fields.buildYear),
                floors: toStringValue(entry.fields.floors),
                notes: toStringValue(entry.fields.notes),
            });
        }

        return rows;
    }, [buildingEntries, unitEntries]);

    const buildingOptionByUuid = useMemo(() => {
        const map = new Map<string, string>();
        for (const row of buildingRows) {
            const name = row.buildingName.trim() || row.label.trim() || "Unnamed building";
            const suffix = row.label.trim() ? ` (${row.label.trim()})` : "";
            map.set(row.buildingUuid, `${name}${suffix}`);
        }
        return map;
    }, [buildingRows]);

    const specialRightsByUnitRef = useMemo(() => {
        const map = new Map<string, string[]>();

        for (const entry of specialRightsEntries) {
            const unitRef = toStringValue(entry.fields.unitRef).trim();
            if (!unitRef) continue;
            const description = toStringValue(entry.fields.description).trim();
            const rightType = toStringValue(entry.fields.rightType).trim();
            const label = description || rightType || "Special right";
            const existing = map.get(unitRef) ?? [];
            map.set(unitRef, [...existing, label]);
        }

        return map;
    }, [specialRightsEntries]);

    const unitRows = useMemo<ReviewPanelUnitRow[]>(() => {
        const rows: ReviewPanelUnitRow[] = [];

        for (const entry of unitEntries) {
            const buildingRef = toStringValue(entry.fields.buildingRef).trim();
            const unitNumber = toStringValue(entry.fields.unitNumber).trim();
            const unitKey = unitNumber || toStringValue(entry.fields.label).trim();
            const specialRights = unitKey ? specialRightsByUnitRef.get(unitKey) ?? [] : [];

            rows.push({
                id: entry.id,
                parentSectionId: entry.parentSectionId,
                itemId: entry.itemId,
                unitNumber,
                unitType: toStringValue(entry.fields.unitType).trim(),
                buildingRef,
                buildingLabel: buildingOptionByUuid.get(buildingRef) ?? "Unassigned",
                area: toStringValue(entry.fields.area).trim(),
                meaNumerator: toStringValue(entry.fields.meaNumerator).trim(),
                specialRightsLabel: specialRights.length > 0 ? specialRights.join(", ") : "",
                floor: toStringValue(entry.fields.floor).trim(),
                entrance: toStringValue(entry.fields.entrance).trim(),
                rooms: toStringValue(entry.fields.rooms).trim(),
                description: toStringValue(entry.fields.description).trim(),
            });
        }

        return rows;
    }, [buildingOptionByUuid, specialRightsByUnitRef, unitEntries]);

    const specialRightsRows = useMemo<ReviewPanelSpecialRightRow[]>(() => {
        const rows: ReviewPanelSpecialRightRow[] = [];

        for (const entry of specialRightsEntries) {
            rows.push({
                id: entry.id,
                parentSectionId: entry.parentSectionId,
                itemId: entry.itemId,
                unitRef: toStringValue(entry.fields.unitRef),
                rightType: toStringValue(entry.fields.rightType),
                description: toStringValue(entry.fields.description),
                area: toStringValue(entry.fields.area),
            });
        }

        return rows;
    }, [specialRightsEntries]);

    const managerPerson = useMemo<ReviewPanelAdministrationPerson | null>(() => {
        const entry = managerEntries[0];
        if (!entry) return null;

        return {
            id: entry.id,
            parentSectionId: entry.parentSectionId,
            itemId: entry.itemId,
            roleLabel: "Property Manager",
            name: toStringValue(entry.fields.managerName),
            street: toStringValue(entry.fields.addressStreet),
            houseNumber: toStringValue(entry.fields.addressHouseNumber),
            postalCode: toStringValue(entry.fields.addressPostalCode),
            city: toStringValue(entry.fields.addressCity),
            notes: toStringValue(entry.fields.notes),
        };
    }, [managerEntries]);

    const accountantPerson = useMemo<ReviewPanelAdministrationPerson | null>(() => {
        const entry = accountantEntries[0];
        if (!entry) return null;

        return {
            id: entry.id,
            parentSectionId: entry.parentSectionId,
            itemId: entry.itemId,
            roleLabel: "Accountant",
            name: toStringValue(entry.fields.accountantName),
            street: toStringValue(entry.fields.addressStreet),
            houseNumber: toStringValue(entry.fields.addressHouseNumber),
            postalCode: toStringValue(entry.fields.addressPostalCode),
            city: toStringValue(entry.fields.addressCity),
            notes: toStringValue(entry.fields.notes),
        };
    }, [accountantEntries]);

    const totalMea = useMemo(() => {
        if (propertyType !== "WEG") return null;
        const entry = meaEntries[0];
        if (!entry) return null;
        return toNumberValue(entry.fields.totalMea);
    }, [meaEntries, propertyType]);

    const allocatedMea = useMemo(() => {
        if (propertyType !== "WEG") return 0;
        return unitRows.reduce((sum, unit) => {
            const value = toNumberValue(unit.meaNumerator);
            return sum + (value ?? 0);
        }, 0);
    }, [propertyType, unitRows]);

    const buildingOptions = useMemo<ReviewPanelBuildingOption[]>(() => {
        return buildingRows.map((row) => ({
            value: row.buildingUuid,
            label: row.buildingName.trim() || row.label.trim() || "Unnamed building",
        }));
    }, [buildingRows]);

    const validation = useMemo<ReviewPanelValidation>(() => {
        const hardIssues: string[] = [];
        const softIssues: string[] = [];

        if (!propertyName.trim()) hardIssues.push("Property name is missing.");
        if (unitRows.length === 0) hardIssues.push("No units detected.");

        const unassignedUnitCount = unitRows.filter((unit) => unit.buildingRef.trim().length === 0).length;
        if (unassignedUnitCount > 0) hardIssues.push(`${unassignedUnitCount} unit(s) have no building assigned.`);

        if (propertyType === "WEG" && totalMea != null && allocatedMea !== totalMea) {
            hardIssues.push(`MEA allocation mismatch (${allocatedMea} / ${totalMea}).`);
        }

        if (propertyType === "WEG" && totalMea == null) {
            softIssues.push("Total MEA declaration is missing.");
        }

        const sectionsNeedingReview = sections.filter((section) => {
            if (!section.state) return false;
            return ["needs_review", "conflict", "error", "unknown"].includes(section.state);
        }).length;

        if (sectionsNeedingReview > 0) {
            softIssues.push(`${sectionsNeedingReview} section(s) still need review.`);
        }

        if (hardIssues.length > 0) {
            return {
                tone: "error",
                title: `${hardIssues.length} blocking issue(s) need attention`,
                subtitle: hardIssues[0] ?? "Resolve blocking issues before creating the property.",
                hardIssues,
                softIssues,
                canCreate: false,
            };
        }

        if (softIssues.length > 0) {
            return {
                tone: "warning",
                title: `${softIssues.length} issue(s) need attention`,
                subtitle: softIssues[0] ?? "Review warnings before creating the property.",
                hardIssues,
                softIssues,
                canCreate: true,
            };
        }

        return {
            tone: "success",
            title: "All sections verified",
            subtitle: "You can confirm and create this property.",
            hardIssues,
            softIssues,
            canCreate: true,
        };
    }, [allocatedMea, propertyName, propertyType, sections, totalMea, unitRows]);

    const bannerHighlights = useMemo(() => {
        const meaLabel = propertyType === "WEG"
            ? `${totalMea ?? "?"} MEA`
            : "No MEA required";

        return `${buildingRows.length} buildings | ${unitRows.length} units | ${meaLabel} | ${specialRightsRows.length} special rights`;
    }, [buildingRows.length, propertyType, specialRightsRows.length, totalMea, unitRows.length]);

    const propertyDraft = useMemo<ReviewPanelPropertyDraft>(() => ({
        name: propertyName,
        street,
        postalCode,
        city,
    }), [city, postalCode, propertyName, street]);

    const persistEntryUpdates = useCallback(async (
        entry: ReviewPanelSectionEntry,
        updates: SectionFields,
    ) => {
        const parentIndex = sections.findIndex((section) => section.id === entry.parentSectionId);
        if (parentIndex < 0) {
            setErrorMessage("Could not find section for this update.");
            return false;
        }

        const parentSection = sections[parentIndex]!;

        try {
            if (entry.itemIndex >= 0 && Array.isArray(parentSection.items)) {
                let hasMatch = false;
                const nextItems: PropertySectionItem[] = parentSection.items.map((item, index) => {
                    const matchesById = entry.itemId ? item.id === entry.itemId : false;
                    const matchesByIndex = !entry.itemId && index === entry.itemIndex;
                    if (!matchesById && !matchesByIndex) return item;
                    hasMatch = true;
                    const nextFields = { ...(item.fields ?? {}), ...updates };
                    return {
                        ...item,
                        fields: nextFields,
                        state: "needs_review" as const,
                    };
                });

                if (!hasMatch) {
                    setErrorMessage("Could not match review row to persisted section item.");
                    return false;
                }

                await updateSectionMutation.mutateAsync({
                    propertyId,
                    sectionId: parentSection.id,
                    items: nextItems,
                });

                const nextSections = sections.map((section, index) => {
                    if (index !== parentIndex) return section;
                    return {
                        ...section,
                        items: nextItems,
                    };
                });
                onSectionsChange(nextSections);
                setErrorMessage(null);
                return true;
            }

            const nextFields = { ...(parentSection.fields ?? {}), ...updates };

            await updateSectionMutation.mutateAsync({
                propertyId,
                sectionId: parentSection.id,
                fields: nextFields,
                state: "needs_review",
            });

            const nextSections = sections.map((section, index) => {
                if (index !== parentIndex) return section;
                return {
                    ...section,
                    fields: nextFields,
                    state: "needs_review",
                };
            });
            onSectionsChange(nextSections);
            setErrorMessage(null);
            return true;
        } catch (updateError) {
            const message = updateError instanceof Error ? updateError.message : "Failed to save changes.";
            setErrorMessage(message);
            return false;
        }
    }, [onSectionsChange, propertyId, sections, updateSectionMutation]);

    const handleSavePropertyDetails = useCallback(async (next: ReviewPanelPropertyDraft) => {
        setIsSavingPropertyDetails(true);
        try {
            await updateProperty({
                propertyId,
                updates: {
                    name: next.name,
                    addressStreet: next.street || null,
                    addressPostalCode: next.postalCode || null,
                    addressCity: next.city || null,
                },
            });
            onPropertyDetailsChange(next);
            setPropertyModalOpen(false);
            setErrorMessage(null);
        } catch (updateError) {
            const message = updateError instanceof Error ? updateError.message : "Failed to update property details.";
            setErrorMessage(message);
        } finally {
            setIsSavingPropertyDetails(false);
        }
    }, [onPropertyDetailsChange, propertyId, updateProperty]);

    const handleSaveBuildingRow = useCallback(async (
        rowId: string,
        updates: Record<string, string>,
    ) => {
        const entry = buildingEntryById.get(rowId);
        if (!entry) {
            setErrorMessage("Could not locate the selected building.");
            return false;
        }

        const numericKeys = new Set(["buildYear", "floors"]);
        const fieldUpdates: SectionFields = {};
        for (const [key, value] of Object.entries(updates)) {
            fieldUpdates[key] = numericKeys.has(key) ? toNumberValue(value) : value;
        }

        setSavingRowId(rowId);
        const wasSaved = await persistEntryUpdates(entry, fieldUpdates);
        setSavingRowId(null);
        return wasSaved;
    }, [buildingEntryById, persistEntryUpdates]);

    const handleCommitUnitCell = useCallback(async (rowId: string, field: EditableUnitField, value: string) => {
        const entry = unitEntryById.get(rowId);
        if (!entry) {
            setErrorMessage("Could not locate the selected unit.");
            return false;
        }

        const trimmed = value.trim();

        if (field === "area" || field === "meaNumerator") {
            const numericValue = toNumberValue(trimmed);
            return persistEntryUpdates(entry, { [field]: numericValue });
        }

        return persistEntryUpdates(entry, { [field]: trimmed });
    }, [persistEntryUpdates, unitEntryById]);

    const handleCommitSpecialRightField = useCallback(async (
        rowId: string,
        field: EditableSpecialRightField,
        value: string,
    ) => {
        const entry = specialRightsEntryById.get(rowId);
        if (!entry) {
            setErrorMessage("Could not locate the selected special right.");
            return false;
        }

        return persistEntryUpdates(entry, { [field]: value.trim() });
    }, [persistEntryUpdates, specialRightsEntryById]);

    const handleSaveUnitRow = useCallback(async (rowId: string, updates: Record<string, string>) => {
        const entry = unitEntryById.get(rowId);
        if (!entry) {
            setErrorMessage("Could not locate the selected unit.");
            return false;
        }

        const numericKeys = new Set(["area", "meaNumerator", "rooms"]);
        const fieldUpdates: SectionFields = {};
        for (const [key, value] of Object.entries(updates)) {
            fieldUpdates[key] = numericKeys.has(key) ? toNumberValue(value) : value;
        }

        return persistEntryUpdates(entry, fieldUpdates);
    }, [persistEntryUpdates, unitEntryById]);

    const handleSaveSpecialRightRow = useCallback(async (rowId: string, updates: Record<string, string>) => {
        const entry = specialRightsEntryById.get(rowId);
        if (!entry) {
            setErrorMessage("Could not locate the selected special right.");
            return false;
        }

        const fieldUpdates: SectionFields = {};
        for (const [key, value] of Object.entries(updates)) {
            fieldUpdates[key] = key === "area" ? toNumberValue(value) : value;
        }

        return persistEntryUpdates(entry, fieldUpdates);
    }, [persistEntryUpdates, specialRightsEntryById]);

    const handleSaveAdministration = useCallback(async (draft: ReviewPanelAdministrationDraft) => {
        setIsSavingAdministration(true);
        try {
            const updates: Promise<boolean>[] = [];

            if (managerPerson) {
                const managerUpdate = persistEntryUpdates(
                    {
                        id: managerPerson.id,
                        parentSectionId: managerPerson.parentSectionId,
                        itemId: managerPerson.itemId,
                        itemIndex: managerEntries.find((entry) => entry.id === managerPerson.id)?.itemIndex ?? -1,
                        fields: {},
                    },
                    {
                        managerName: draft.managerName,
                        addressStreet: draft.managerStreet,
                        addressHouseNumber: draft.managerHouseNumber,
                        addressPostalCode: draft.managerPostalCode,
                        addressCity: draft.managerCity,
                        notes: draft.managerNotes,
                    },
                );
                updates.push(managerUpdate);
            }

            if (accountantPerson) {
                const accountantUpdate = persistEntryUpdates(
                    {
                        id: accountantPerson.id,
                        parentSectionId: accountantPerson.parentSectionId,
                        itemId: accountantPerson.itemId,
                        itemIndex: accountantEntries.find((entry) => entry.id === accountantPerson.id)?.itemIndex ?? -1,
                        fields: {},
                    },
                    {
                        accountantName: draft.accountantName,
                        addressStreet: draft.accountantStreet,
                        addressHouseNumber: draft.accountantHouseNumber,
                        addressPostalCode: draft.accountantPostalCode,
                        addressCity: draft.accountantCity,
                        notes: draft.accountantNotes,
                    },
                );
                updates.push(accountantUpdate);
            }

            if (updates.length === 0) {
                setErrorMessage("No administration sections are available to update.");
                return;
            }

            const results = await Promise.all(updates);
            if (results.every(Boolean)) {
                setAdministrationModalOpen(false);
                setErrorMessage(null);
            }
        } finally {
            setIsSavingAdministration(false);
        }
    }, [accountantEntries, accountantPerson, managerEntries, managerPerson, persistEntryUpdates]);

    const handleDownloadSummary = useCallback(() => {
        const summary = {
            property: {
                name: propertyName,
                address: normalizeAddress(street, postalCode, city),
                propertyType,
            },
            buildings: buildingRows,
            units: unitRows,
            ownership: {
                totalMea,
                allocatedMea,
            },
            specialRights: specialRightsRows,
            administration: {
                manager: managerPerson,
                accountant: accountantPerson,
            },
            generatedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `property-review-${propertyId}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }, [accountantPerson, allocatedMea, buildingRows, city, managerPerson, postalCode, propertyId, propertyName, propertyType, specialRightsRows, street, totalMea, unitRows]);

    const handleCreate = useCallback(async () => {
        if (!validation.canCreate) {
            setErrorMessage("Resolve blocking issues before creating the property.");
            return;
        }
        if (!confirmed) {
            setErrorMessage("Please confirm the declaration before creating the property.");
            return;
        }

        setIsCreating(true);
        try {
            await updateProperty({
                propertyId,
                updates: {
                    status: "ACTIVE",
                },
            });
            setErrorMessage(null);
            onCreated();
        } catch (updateError) {
            const message = updateError instanceof Error ? updateError.message : "Failed to create property.";
            setErrorMessage(message);
        } finally {
            setIsCreating(false);
        }
    }, [confirmed, onCreated, propertyId, updateProperty, validation.canCreate]);

    return (
        <div className="w-full max-w-6xl">
            <Card className="w-full pb-0">
                <CardHeader className="border-b border-gray-200 pb-4">
                    <CardTitle className="text-2xl font-black">Review & Confirm</CardTitle>
                    <p className="text-sm text-gray-600">
                        Confirm the extracted structure, make quick inline fixes, and create the property when you are ready.
                    </p>
                </CardHeader>

                <CardContent className="space-y-4 py-5">
                    <ReviewPanelStatusBanner
                        tone={validation.tone}
                        title={validation.title}
                        subtitle={validation.subtitle}
                        highlights={bannerHighlights}
                        issues={[...validation.hardIssues, ...validation.softIssues]}
                    />

                    <ReviewPanelSection title="Property" defaultOpen>
                        <ReviewPanelPropertyBlock
                            name={propertyName}
                            street={street}
                            postalCode={postalCode}
                            city={city}
                            onEdit={() => setPropertyModalOpen(true)}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection title={`Buildings (${buildingRows.length})`} defaultOpen={buildingRows.length > 0}>
                        <ReviewPanelBuildingsTable
                            rows={buildingRows}
                            savingRowId={savingRowId}
                            onSaveRow={handleSaveBuildingRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection title={`Units (${unitRows.length})`} defaultOpen={unitRows.length > 0}>
                        <ReviewPanelUnitsTable
                            rows={unitRows}
                            buildingOptions={buildingOptions}
                            propertyType={propertyType}
                            onCommitCell={handleCommitUnitCell}
                            onSaveRow={handleSaveUnitRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection title="Ownership Structure" defaultOpen>
                        <ReviewPanelOwnershipCard
                            propertyType={propertyType}
                            totalMea={totalMea}
                            allocatedMea={allocatedMea}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection title={`Special Rights (${specialRightsRows.length})`} defaultOpen={specialRightsRows.length > 0}>
                        <ReviewPanelSpecialRightsList
                            rows={specialRightsRows}
                            onCommitField={handleCommitSpecialRightField}
                            onSaveRow={handleSaveSpecialRightRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection title="Administration" defaultOpen>
                        <ReviewPanelAdministrationBlock
                            manager={managerPerson}
                            accountant={accountantPerson}
                            onEdit={() => setAdministrationModalOpen(true)}
                        />
                    </ReviewPanelSection>
                </CardContent>

                <CardFooter className="flex-col gap-2 border-t border-gray-200 bg-gray-50 pb-6 pt-4">
                    <ReviewPanelConfirmationBlock
                        confirmed={confirmed}
                        isCreating={isCreating}
                        canCreate={validation.canCreate}
                        onConfirmedChange={setConfirmed}
                        onBack={onBack}
                        onCreate={() => void handleCreate()}
                        onDownload={handleDownloadSummary}
                    />
                    {errorMessage ? <p className="w-full text-left text-xs font-medium text-red-600">{errorMessage}</p> : null}
                </CardFooter>
            </Card>

            <ReviewPanelPropertyModal
                open={propertyModalOpen}
                initialData={propertyDraft}
                isSaving={isSavingPropertyDetails}
                onClose={() => setPropertyModalOpen(false)}
                onSave={handleSavePropertyDetails}
            />

            <ReviewPanelAdministrationModal
                open={administrationModalOpen}
                isSaving={isSavingAdministration}
                manager={managerPerson}
                accountant={accountantPerson}
                onClose={() => setAdministrationModalOpen(false)}
                onSave={handleSaveAdministration}
            />
        </div>
    );
}

export {
    NewPropertyReviewPanel,
};
