import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropertySection, PropertySectionItem } from "@/api/properties";
import { useUpdatePropertyMutation } from "@/hooks/useUpdatePropertyMutation";
import { useUpdateSectionMutation } from "@/hooks/useUpdateSectionMutation";
import { useDeleteSectionMutation } from "@/hooks/useDeleteSectionMutation";
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
    ReviewPanelIssue,
} from "./reviewPanel/reviewPanelTypes";
import { ReviewPanelEditModal } from "./reviewPanel/reviewPanelEditModal";
import { Button } from "../ui/button";

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

function toFields(value: PropertySection["fields"] | PropertySectionItem["fields"]) {
    if (!value || typeof value !== "object") return {} as SectionFields;
    return value as SectionFields;
}

function toStringValue(value: string | number | boolean | null | undefined) {
    if (value === null || value === undefined) return "";
    return String(value);
}

function toNumberValue(value: string | number | boolean | null | undefined) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value ? 1 : 0;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
}

function collectEntries(sections: PropertySection[], sectionType: string) {
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

        const items = section.items!;
        for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
            const item = items[itemIndex];
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

function normalizeAddress(street: string, postalCode: string, city: string) {
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
}: NewPropertyReviewPanelProps) {
    const updateSectionMutation = useUpdateSectionMutation();
    const { mutateAsync: updateProperty } = useUpdatePropertyMutation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [propertyModalOpen, setPropertyModalOpen] = useState<boolean>(false);
    const [administrationModalMode, setAdministrationModalMode] = useState<"manager" | "accountant" | null>(null);
    const [savingRowId, setSavingRowId] = useState<string | null>(null);
    const [isSavingPropertyDetails, setIsSavingPropertyDetails] = useState<boolean>(false);
    const [isSavingAdministration, setIsSavingAdministration] = useState<boolean>(false);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [confirmed, setConfirmed] = useState<boolean>(false);
    const [isSavingOwnership, setIsSavingOwnership] = useState<boolean>(false);
    const [ownershipModalOpen, setOwnershipModalOpen] = useState<boolean>(false);

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
            const matchingUnits = unitEntries.filter((unitEntry) => toStringValue(unitEntry.fields.buildingRef).trim() === buildingUuid);
            const unitCount = matchingUnits.length;

            let totalArea = 0;
            let totalMea = 0;
            for (const unitEntry of matchingUnits) {
                const area = parseFloat(toStringValue(unitEntry.fields.area));
                const mea = parseFloat(toStringValue(unitEntry.fields.meaNumerator));
                if (Number.isFinite(area)) totalArea += area;
                if (Number.isFinite(mea)) totalMea += mea;
            }

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
                totalArea,
                totalMea,
                buildYear: toStringValue(entry.fields.buildYear),
                floors: toStringValue(entry.fields.floors),
                notes: toStringValue(entry.fields.notes),
            });
        }

        return rows;
    }, [buildingEntries, unitEntries]);

    const deleteSectionMutation = useDeleteSectionMutation();

    async function handleAddToSection(sectionType: string) {
        const parent = sections.find((s) => s.sectionType === sectionType);
        if (!parent) {
            setErrorMessage("No section available to add to.");
            return;
        }

        const newItem = {
            id: `new-${Date.now()}`,
            rawText: "",
            fields: {},
            textPosition: [],
            state: "needs_review",
        } as PropertySectionItem;

        const nextItems = Array.isArray(parent.items) ? [...parent.items, newItem] : [newItem];

        try {
            await updateSectionMutation.mutateAsync({ propertyId, sectionId: parent.id, items: nextItems });
            const nextSections = sections.map((section) => {
                if (section.id !== parent.id) return section;
                return { ...section, items: nextItems };
            });
            onSectionsChange(nextSections);
            setErrorMessage(null);
        } catch (err) {
            setErrorMessage("Failed to add item to section.");
        }
    }

    async function handleDeleteRow(rowId: string) {
        const entry = buildingEntryById.get(rowId) ?? unitEntryById.get(rowId) ?? specialRightsEntryById.get(rowId) ?? null;
        if (!entry) {
            setErrorMessage("Could not locate the selected row.");
            return;
        }

        const parentIndex = sections.findIndex((s) => s.id === entry.parentSectionId);
        if (parentIndex < 0) {
            setErrorMessage("Could not find section for this delete.");
            return;
        }

        const parentSection = sections[parentIndex]!;

        // If this is an item inside a parent section
        if (entry.itemIndex >= 0 && Array.isArray(parentSection.items)) {
            const nextItems: PropertySectionItem[] = parentSection.items.filter((it, idx) => {
                if (entry.itemId) return it.id !== entry.itemId;
                return idx !== entry.itemIndex;
            });

            try {
                await updateSectionMutation.mutateAsync({ propertyId, sectionId: parentSection.id, items: nextItems });
                const nextSections = sections.map((section, index) => {
                    if (index !== parentIndex) return section;
                    return { ...section, items: nextItems } as PropertySection;
                });
                onSectionsChange(nextSections);
                setErrorMessage(null);
            } catch (err) {
                setErrorMessage("Failed to delete item from section.");
            }

            return;
        }

        // Otherwise this was the parent section itself - delete the whole section
        try {
            await deleteSectionMutation.mutateAsync({ propertyId, sectionId: parentSection.id });
            const nextSections = sections.filter((s) => s.id !== parentSection.id);
            onSectionsChange(nextSections);
            setErrorMessage(null);
        } catch (err) {
            setErrorMessage("Failed to delete section.");
        }
    }

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
        const hardIssues: ReviewPanelIssue[] = [];
        const softIssues: ReviewPanelIssue[] = [];

        if (!propertyName.trim()) {
            hardIssues.push({ message: "Property name is missing.", scrollToId: "review-section-property" });
        }
        if (unitRows.length === 0) {
            hardIssues.push({ message: "No units detected.", scrollToId: "review-section-units" });
        }

        const unassignedUnitCount = unitRows.filter((unit) => unit.buildingRef.trim().length === 0).length;
        if (unassignedUnitCount > 0) {
            hardIssues.push({ message: `${unassignedUnitCount} unit(s) are not assigned to a building`, scrollToId: "review-section-units" });
        }

        if (propertyType === "WEG" && totalMea != null && allocatedMea !== totalMea) {
            hardIssues.push({ message: `MEA allocation mismatch (${allocatedMea} / ${totalMea}).`, scrollToId: "review-section-ownership" });
        }

        if (propertyType === "WEG" && totalMea == null) {
            softIssues.push({ message: "Total MEA declaration is missing.", scrollToId: "review-section-ownership" });
        }

        const sectionsNeedingReview = sections.filter((section) => {
            if (!section.state) return false;
            return ["needs_review", "conflict", "error", "unknown"].includes(section.state);
        }).length;

        if (sectionsNeedingReview > 0) {
            softIssues.push({ message: `${sectionsNeedingReview} section(s) still need review.` });
        }

        if (hardIssues.length > 0) {
            return {
                tone: "error",
                title: "Blocking Issues",
                subtitle: "Please resolve the following issues:",
                hardIssues,
                softIssues,
                canCreate: false,
            };
        }

        if (softIssues.length > 0) {
            return {
                tone: "warning",
                title: `${softIssues.length} issue(s) need attention`,
                subtitle: softIssues[0]?.message ?? "Review warnings before creating the property.",
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
                setAdministrationModalMode(null);
                setErrorMessage(null);
            }
        } finally {
            setIsSavingAdministration(false);
        }
    }, [accountantEntries, accountantPerson, managerEntries, managerPerson, persistEntryUpdates]);


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

    const handleSaveOwnership = useCallback(async (updates: Record<string, string>) => {
        setIsSavingOwnership(true);
        try {
            // Find existing MEA declaration section
            let section = meaEntries[0];

            // If none exists, we need to find or create the parent section for MEA declarations
            if (!section) {
                const parentSection = sections.find((s) => s.sectionType === "weg.mea_declaration");

                if (parentSection) {
                    // Update the parent section directly since MEA declarations usually don't have items
                    await updateSectionMutation.mutateAsync({
                        propertyId,
                        sectionId: parentSection.id,
                        fields: { ...parentSection.fields, totalMea: toNumberValue(updates.totalMea) },
                        state: "needs_review",
                    });

                    const nextSections = sections.map((s) => {
                        if (s.id !== parentSection.id) return s;
                        return {
                            ...s,
                            fields: { ...s.fields, totalMea: toNumberValue(updates.totalMea) },
                            state: "needs_review",
                        } as PropertySection;
                    });
                    onSectionsChange(nextSections);
                } else {
                    // This is tricky: we'd need to create a new section. 
                    // For now, let's assume one exists or we just show error if completely missing.
                    setErrorMessage("No MEA declaration section found to update.");
                    return;
                }
            } else {
                // We have an entry (which might be the section itself or an item)
                await persistEntryUpdates(section, { totalMea: toNumberValue(updates.totalMea) });
            }

            setOwnershipModalOpen(false);
            setErrorMessage(null);
        } catch (updateError) {
            const message = updateError instanceof Error ? updateError.message : "Failed to update ownership details.";
            setErrorMessage(message);
        } finally {
            setIsSavingOwnership(false);
        }
    }, [meaEntries, onSectionsChange, persistEntryUpdates, propertyId, sections, updateSectionMutation]);

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
                        issues={[...validation.hardIssues, ...validation.softIssues]}
                    />

                    <ReviewPanelSection id="review-section-property" title="Property" defaultOpen>
                        <ReviewPanelPropertyBlock
                            name={propertyName}
                            street={street}
                            postalCode={postalCode}
                            city={city}
                            onEdit={() => setPropertyModalOpen(true)}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection
                        id="review-section-buildings"
                        title={`Buildings (${buildingRows.length})`}
                        defaultOpen={buildingRows.length > 0}
                        action={(
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    className="px-5 py-1 text-sm font-medium border border-muted"
                                    onClick={() => void handleAddToSection("core.building")} >
                                    Add
                                </Button>
                            </div>
                        )}
                    >
                        <ReviewPanelBuildingsTable
                            rows={buildingRows}
                            savingRowId={savingRowId}
                            onSaveRow={handleSaveBuildingRow}
                            onDeleteRow={handleDeleteRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection
                        id="review-section-units"
                        title={`Units (${unitRows.length})`}
                        defaultOpen={unitRows.length > 0}
                        action={(
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={() => void handleAddToSection("units.unit_block")}
                                    className="px-5 py-1 text-sm font-medium border border-muted" >
                                    Add
                                </Button>
                            </div>
                        )}
                    >
                        <ReviewPanelUnitsTable
                            rows={unitRows}
                            buildingOptions={buildingOptions}
                            propertyType={propertyType}
                            onCommitCell={handleCommitUnitCell}
                            onSaveRow={handleSaveUnitRow}
                            onDeleteRow={handleDeleteRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection id="review-section-ownership" title="Ownership Structure" defaultOpen>
                        <ReviewPanelOwnershipCard
                            propertyType={propertyType}
                            totalMea={totalMea}
                            allocatedMea={allocatedMea}
                            onEdit={() => setOwnershipModalOpen(true)}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection id="review-section-special-rights" title={`Special Rights (${specialRightsRows.length})`} defaultOpen={specialRightsRows.length > 0}>
                        <ReviewPanelSpecialRightsList
                            rows={specialRightsRows}
                            onCommitField={handleCommitSpecialRightField}
                            onSaveRow={handleSaveSpecialRightRow}
                        />
                    </ReviewPanelSection>

                    <ReviewPanelSection id="review-section-administration" title="Administration" defaultOpen>
                        <ReviewPanelAdministrationBlock
                            manager={managerPerson}
                            accountant={accountantPerson}
                            onEditManager={() => setAdministrationModalMode("manager")}
                            onEditAccountant={() => setAdministrationModalMode("accountant")}
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
                open={administrationModalMode !== null}
                mode={administrationModalMode ?? undefined}
                isSaving={isSavingAdministration}
                manager={managerPerson}
                accountant={accountantPerson}
                onClose={() => setAdministrationModalMode(null)}
                onSave={handleSaveAdministration}
            />

            <ReviewPanelEditModal
                open={ownershipModalOpen}
                title="Edit Ownership Details"
                fields={[{ key: "totalMea", label: "Total MEA", type: "number" }]}
                initialValues={{ totalMea: String(totalMea ?? "") }}
                isSaving={isSavingOwnership}
                onClose={() => setOwnershipModalOpen(false)}
                onSave={handleSaveOwnership}
            />
        </div>
    );
}

export {
    NewPropertyReviewPanel,
};
