import { useMemo, useState } from "react";
import type { ReactNode, Ref } from "react";
import type { SectionData, SectionType } from "./pdfViewer.types";
import { REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType as SharedSectionType } from "@shared/section-types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "../ui/combobox";
import { Label } from "../ui/label";
import { Loader2 } from "lucide-react";
import {
    CoreAddressEditor,
    CoreBuildingEditor,
    CorePropertyOverviewEditor,
    MvOwnerEntityBlockEditor,
    UnitsUnitBlockEditor,
    UnknownSectionEditor,
    WegPropertyManagerEditor,
    WegAccountantEditor,
    WegMeaTotalCheckEditor,
    WegSpecialRightsBlockEditor,
} from "./pdfViewerToolBar";
import { cn } from "@/lib/utils";

type Option = { label: string; value: string };

type SectionTypeOption = { label: string; value: SectionType; scope?: "WEG" | "MV" };

const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
    { label: "Property Overview", value: "core.property_overview" },
    { label: "Address", value: "core.address" },
    { label: "Building", value: "core.building" },
    { label: "Unit Block", value: "units.unit_block" },
    { label: "Special Rights", value: "weg.special_rights", scope: "WEG" },
    { label: "MEA Declaration", value: "weg.mea_declaration", scope: "WEG" },
    { label: "Property Manager", value: "weg.property_manager", scope: "WEG" },
    { label: "Accountant", value: "weg.accountant", scope: "WEG" },
    { label: "Owner Entity", value: "mv.owner_entity", scope: "MV" },
    { label: "Unknown", value: "unknown" },
];

const STATE_BADGES: Record<string, { label: string; className: string }> = {
    valid: { label: "Valid", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    partial: { label: "Partially extracted", className: "bg-amber-100 text-amber-700 border-amber-200 animate-slow-pulse" },
    conflict: { label: "Conflict", className: "bg-red-100 text-red-700 border-red-200" },
    processing: { label: "Extracting…", className: "bg-sky-100 text-sky-700 border-sky-200 animate-slow-pulse" },
    identifying: { label: "Identifying…", className: "bg-indigo-100 text-indigo-700 border-indigo-200 animate-slow-pulse" },
    error: { label: "Extraction failed", className: "bg-red-100 text-red-700 border-red-200 animate-slow-pulse" },
    unknown: { label: "Unknown", className: "bg-red-100 text-red-700 border-red-200" },
};

/**
 * Returns the set of required field keys that are missing (null / undefined / "")
 * for a given section.  Returns an empty set when the section type has no
 * required field metadata or all required fields are filled.
 */
function getMissingRequiredFields(section: SectionData): Set<string> {
    const reqKeys = REQUIRED_FIELDS[section.sectionType as SharedSectionType] ?? [];
    if (!reqKeys.length) return new Set();
    const missing = new Set<string>();
    for (const key of reqKeys) {
        const val = section.fields?.[key];
        if (val === null || val === undefined || val === "") {
            missing.add(key);
        }
    }
    return missing;
}

/**
 * Compute the effective display state for a section.  Sections in
 * `needs_review` that have missing required fields are shown as `partial`.
 */
function getDisplayState(section: SectionData | null): string {
    if (!section) return "unknown";
    if (section.state !== "needs_review") return section.state ?? "unknown";
    const missing = getMissingRequiredFields(section);
    const reqKeys = REQUIRED_FIELDS[section.sectionType as SharedSectionType] ?? [];
    if (reqKeys.length > 0 && missing.size > 0) return "partial";
    return "needs_review";
}

type OptionComboboxProps = {
    options: Option[];
    value: string;
    disabled: boolean;
    placeholder: string;
    onChange: (nextValue: string) => void;
};

type SectionEditorConfig = {
    section: SectionData;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    propertyType: "WEG" | "MV";
    availableBuildings?: Map<string, string>;
    missingFields?: Set<string>;
    totalMeaDenominator?: number | null;
};

function OptionCombobox({ options, value, disabled, placeholder, onChange }: OptionComboboxProps) {
    const items = options.map((option) => option.value);
    const labelByValue = new Map(options.map((option) => [option.value, option.label]));

    return (
        <Combobox
            items={items}
            value={value}
            onValueChange={(nextValue) => {
                const resolved = nextValue ?? "";
                // base-ui fires onValueChange during render even when the value
                // hasn't changed.  Short-circuit to prevent an infinite
                // setState loop (OptionCombobox → onChange → setSections →
                // re-render → onValueChange → …).
                if (resolved === value) return;
                onChange(resolved);
            }}
            itemToStringLabel={(item) => labelByValue.get(String(item)) ?? String(item)}
            disabled={disabled}
        >
            <ComboboxInput placeholder={placeholder} className="w-full" />
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
}

function renderSectionEditor({ section, onSectionUpdate, propertyType, availableBuildings, missingFields, totalMeaDenominator }: SectionEditorConfig): ReactNode {
    switch (section.sectionType) {
        case "core.property_overview":
            return <CorePropertyOverviewEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "core.address":
            return <CoreAddressEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "core.building":
            return <CoreBuildingEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "units.unit_block":
            return (
                <UnitsUnitBlockEditor
                    section={section}
                    onSectionUpdate={onSectionUpdate}
                    propertyType={propertyType}
                    availableBuildings={availableBuildings}
                    missingFields={missingFields}
                    totalMeaDenominator={totalMeaDenominator}
                />
            );
        case "weg.special_rights":
            return <WegSpecialRightsBlockEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "weg.mea_declaration":
            return <WegMeaTotalCheckEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "weg.property_manager":
            return <WegPropertyManagerEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "weg.accountant":
            return <WegAccountantEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "mv.owner_entity":
            return <MvOwnerEntityBlockEditor section={section} onSectionUpdate={onSectionUpdate} missingFields={missingFields} />;
        case "unknown":
        default:
            return <UnknownSectionEditor />;
    }
}
type PdfViewerSplitToolbarProps = {
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

function PdfViewerSplitToolbar({
    closeSplit,
    splitToolbarRef,
    sections,
    activeSectionId,
    onActiveSectionChange,
    onSectionUpdate,
    onSectionDelete,
    propertyType = "WEG",
    pageNumber,
}: PdfViewerSplitToolbarProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const sectionsOnPage = useMemo(
        () => sections.filter((section) => section.textPosition.page.includes(pageNumber)),
        [sections, pageNumber],
    );

    const activeSection = useMemo(() => {
        if (activeSectionId) return sections.find((section) => section.id === activeSectionId) ?? null;
        return sectionsOnPage[0] ?? null;
    }, [activeSectionId, sections, sectionsOnPage]);

    const isIdentifying = useMemo(() => activeSection?.state === "identifying", [activeSection]);
    const isProcessing = useMemo(() => activeSection?.state === "processing", [activeSection]);
    const isBusy = isIdentifying || isProcessing;
    const isUnknown = useMemo(() => activeSection?.sectionType === "unknown", [activeSection]);

    const availableBuildings = useMemo(() => {
        const buildingMap = new Map<string, string>();

        sections
            .filter((section) => section.sectionType === "core.building")
            .forEach((section) => {
                const uuid = section.fields?.buildingUuid;
                const label = section.fields?.label;
                const name = section.fields?.buildingName;
                
                if (!uuid) return;
                
                const uuidStr = String(uuid);
                const namePart = name ? String(name).trim() : "";
                const labelPart = label ? String(label).trim() : "";
                const displayName = namePart && labelPart
                    ? `${namePart} — ${labelPart}`
                    : namePart || labelPart || `Building ${uuidStr.slice(-8)}`;
                buildingMap.set(uuidStr, displayName);
            });
        
        return buildingMap;
    }, [sections]);

    /** Derive the total MEA denominator from the weg.mea_declaration section. */
    const totalMeaDenominator = useMemo(() => {
        const meaSection = sections.find((s) => s.sectionType === "weg.mea_declaration");
        if (!meaSection) return null;
        const raw = meaSection.fields?.totalMea;
        if (raw === null || raw === undefined || raw === "") return null;
        const num = Number(raw);
        return Number.isNaN(num) ? null : num;
    }, [sections]);

    const displayState = useMemo(() => getDisplayState(activeSection), [activeSection]);
    const stateBadge = STATE_BADGES[displayState] ?? STATE_BADGES.unknown;
    const missingFields = useMemo(() => {
        if (!activeSection) return new Set<string>();
        const missing = getMissingRequiredFields(activeSection);
        // Dynamically flag buildingRef as missing for units when buildings
        // are available but the unit has no building assigned.
        if (
            activeSection.sectionType === "units.unit_block" &&
            availableBuildings.size > 0 &&
            !activeSection.fields?.buildingRef
        ) {
            missing.add("buildingRef");
        }
        return missing;
    }, [activeSection, availableBuildings]);
    const sectionTypeValue = activeSection?.sectionType ?? "unknown";
    const typeLabel = SECTION_TYPE_OPTIONS.find((option) => option.value === sectionTypeValue)?.label;

    // Filter section type options based on the property type.
    // Options with no scope are always shown; scoped options only appear for
    // the matching property type.
    const filteredTypeOptions = useMemo(() =>
        SECTION_TYPE_OPTIONS.filter((opt) => !opt.scope || opt.scope === propertyType),
        [propertyType],
    );

    const getActionButtonText = (): string => {
        if (!activeSection) return "Next";
        
        switch (sectionTypeValue) {
            case "core.building":
                return "Confirm building";
            case "units.unit_block":
                return "Confirm unit";
            case "core.property_overview":
                return "Confirm property";
            case "core.address":
                return "Confirm address";
            case "weg.property_manager":
            case "weg.accountant":
                return "Confirm administration";
            default:
                return "Save and continue";
        }
    };

    const updateSection = (updates: Partial<SectionData>) => {
        if (!activeSection || !onSectionUpdate) return;

        // Guard against no-op updates to prevent infinite re-render loops.
        // The Combobox fires onValueChange on every render with a controlled value,
        // so skip if the sectionType is the only key and it hasn't actually changed.
        if (
            updates.sectionType &&
            updates.sectionType === activeSection.sectionType &&
            Object.keys(updates).length === 1
        ) {
            return;
        }
        
        // If section type is being changed, mark as needs_review
        if (updates.sectionType && updates.sectionType !== activeSection.sectionType) {
            onSectionUpdate(activeSection.id, { ...updates, state: "needs_review" });
        } else {
            onSectionUpdate(activeSection.id, updates);
        }
    };


    const handleNext = () => {
        if (activeSection && onSectionUpdate) {
            updateSection({ state: "valid" });
        }
        
        // Search ALL sections for the next one that needs attention, not just
        // sections on the current page.  This lets the "Confirm" button walk
        // through the entire document.
        const candidates = sections;
        if (!candidates.length) {
            closeSplit();
            return;
        }
        const currentId = activeSection?.id ?? candidates[0]?.id;
        if (!currentId) {
            closeSplit();
            return;
        }
        const currentIndex = candidates.findIndex((section) => section.id === currentId);
        
        const needsReviewStates = ["needs_review", "conflict", "processing", "identifying", "unknown", "error"];
        
        // Look forward from the current position first
        let nextSection: SectionData | null = null;
        for (let i = currentIndex + 1; i < candidates.length; i++) {
            const section = candidates[i];
            if (section.id !== currentId && (!section.state || needsReviewStates.includes(section.state))) {
                nextSection = section;
                break;
            }
        }
        
        // Wrap around to the beginning if nothing found after
        if (!nextSection) {
            for (let i = 0; i < currentIndex; i++) {
                const section = candidates[i];
                if (section.id !== currentId && (!section.state || needsReviewStates.includes(section.state))) {
                    nextSection = section;
                    break;
                }
            }
        }
        
        if (!nextSection) {
            // Everything is reviewed — close the split toolbar
            closeSplit();
            return;
        }
        
        onActiveSectionChange?.(nextSection.id);
    };

    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        if (!activeSection || !onSectionDelete) return;
        onSectionDelete(activeSection.id);
        setShowDeleteDialog(false);
        closeSplit();
    };

    return (
        <div
            id="pdf-split-toolbar"
            ref={splitToolbarRef}
            className="pointer-events-auto mx-auto w-full bg-white border-y-2 border-gray-200 shadow-lg rounded-b"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <div className="flex flex- flex-wrap items-center gap-5">
                        <Badge
                            variant="outline"
                            className={cn(stateBadge?.className ?? STATE_BADGES.unknown.className, "text-md h-7 px-3")}
                        >
                            {stateBadge?.label ?? "Unknown"}
                        </Badge>
                        {isBusy && (
                            <Loader2 className={cn(
                                "h-5 w-5 animate-spin",
                                isIdentifying ? "text-indigo-600" : "text-sky-600",
                            )} />
                        )}
                        <div className="text-lg font-semibold uppercase tracking-wide">
                            {typeLabel ?? "Section editor"}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-600">Section type</Label>
                    <OptionCombobox
                        options={filteredTypeOptions}
                        value={sectionTypeValue}
                        disabled={!activeSection || !onSectionUpdate || isBusy}
                        placeholder="Select section type"
                        onChange={(nextValue) => updateSection({ sectionType: nextValue as SectionType })}
                    />
                </div>
            </div>

            <div className="w-full border-t border-gray-200" >
                <div className={cn("p-4", isBusy && "opacity-50 pointer-events-none")}>
                    <div>
  
                        {activeSection
                            ? renderSectionEditor({
                                section: activeSection,
                                onSectionUpdate,
                                propertyType,
                                availableBuildings,
                                missingFields,
                                totalMeaDenominator,
                            })
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
                        className="text-lg h-10 px-10 py-5 cursor-pointer"
                        onClick={closeSplit}
                        disabled={isBusy}
                    >
                        Close
                    </Button>
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <Button
                            variant="destructive"
                            className="text-lg h-10 px-10 py-5 cursor-pointer"
                            onClick={handleDelete}
                            disabled={!activeSection || !onSectionDelete || isBusy}
                        >
                            Delete
                        </Button>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-bold text-2xl">
                                    Are you sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete this section. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="p-5 text-2xl px-5">
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction 
                                    className="p-5 text-2xl px-5"
                                    variant={"destructive"}
                                    onClick={confirmDelete}>
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button
                        type="submit"
                        className="grow py-5 text-lg h-10 cursor-pointer"
                        onClick={handleNext}
                        disabled={!activeSection || isBusy || isUnknown}
                    >
                        {getActionButtonText()}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export { 
    PdfViewerSplitToolbar,
    SECTION_TYPE_OPTIONS
};
