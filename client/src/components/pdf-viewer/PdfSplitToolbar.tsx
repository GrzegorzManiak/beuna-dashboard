import { useMemo, useState } from "react";
import type { ReactNode, Ref } from "react";
import type { SectionData, SectionType } from "./types";
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
import {
    CoreAddressEditor,
    CoreBuildingEditor,
    CoreBuildingSharedFeaturesEditor,
    CorePropertyOverviewEditor,
    MvOwnerEntityBlockEditor,
    UnitsUnitBlockEditor,
    UnknownSectionEditor,
    WegAdministrationBlockEditor,
    WegMeaTotalCheckEditor,
    WegSpecialRightsBlockEditor,
} from "./tools";
import { cn } from "@/lib/utils";

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

const STATE_BADGES: Record<string, { label: string; className: string }> = {
    valid: { label: "Valid", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    conflict: { label: "Conflict", className: "bg-red-100 text-red-700 border-red-200" },
    processing: { label: "Processing", className: "bg-amber-100 text-amber-700 border-amber-200" },
    identifying: { label: "Identifying", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    unknown: { label: "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

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
};

function OptionCombobox({ options, value, disabled, placeholder, onChange }: OptionComboboxProps) {
    const items = options.map((option) => option.value);
    const labelByValue = new Map(options.map((option) => [option.value, option.label]));

    return (
        <Combobox
            items={items}
            value={value}
            onValueChange={(nextValue) => onChange(nextValue ?? "")}
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

function renderSectionEditor({ section, onSectionUpdate, propertyType, availableBuildings }: SectionEditorConfig): ReactNode {
    switch (section.sectionType) {
        case "core.property_overview":
            return <CorePropertyOverviewEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "core.address":
            return <CoreAddressEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "core.building":
            return <CoreBuildingEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "core.building_shared_features":
            return <CoreBuildingSharedFeaturesEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "units.unit_block":
            return (
                <UnitsUnitBlockEditor
                    section={section}
                    onSectionUpdate={onSectionUpdate}
                    propertyType={propertyType}
                    availableBuildings={availableBuildings}
                />
            );
        case "weg.special_rights_block":
            return <WegSpecialRightsBlockEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "weg.mea_total_check":
            return <WegMeaTotalCheckEditor />;
        case "weg.administration_block":
            return <WegAdministrationBlockEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "mv.owner_entity_block":
            return <MvOwnerEntityBlockEditor section={section} onSectionUpdate={onSectionUpdate} />;
        case "unknown":
        default:
            return <UnknownSectionEditor />;
    }
}
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
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const sectionsOnPage = useMemo(
        () => sections.filter((section) => section.textPosition.page.includes(pageNumber)),
        [sections, pageNumber],
    );

    const activeSection = useMemo(() => {
        if (activeSectionId) return sections.find((section) => section.id === activeSectionId) ?? null;
        return sectionsOnPage[0] ?? null;
    }, [activeSectionId, sections, sectionsOnPage]);

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
                const displayName = label || name || `Building ${uuidStr.slice(-8)}`;
                if (displayName && typeof displayName === 'string' && displayName.trim() !== "") {
                    buildingMap.set(uuidStr, displayName);
                }
            });
        
        return buildingMap;
    }, [sections]);

    const stateBadge = activeSection?.state ? STATE_BADGES[activeSection.state] : STATE_BADGES.unknown;
    const sectionTypeValue = activeSection?.sectionType ?? "unknown";
    const typeLabel = SECTION_TYPE_OPTIONS.find((option) => option.value === sectionTypeValue)?.label;

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
            default:
                return "Save and continue";
        }
    };

    const updateSection = (updates: Partial<SectionData>) => {
        if (!activeSection || !onSectionUpdate) return;
        onSectionUpdate(activeSection.id, updates);
    };


    const handleNext = () => {
        if (activeSection && onSectionUpdate) {
            updateSection({ state: "valid" });
        }
        
        const candidates = sectionsOnPage.length ? sectionsOnPage : sections;
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
        
        const needsReviewStates = ["needs_review", "conflict", "processing", "identifying", "unknown"];
        
        let nextSection = null;
        for (let i = currentIndex + 1; i < candidates.length; i++) {
            const section = candidates[i];
            if (section.id !== currentId && (!section.state || needsReviewStates.includes(section.state))) {
                nextSection = section;
                break;
            }
        }
        
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
                        {/* <span className="text-lg font-semibold text-gray-900">
                            {activeSection?.id ?? `Page ${pageNumber}`}
                        </span> */}
                        <div className="text-lg font-semibold uppercase tracking-wide">
                            {typeLabel ?? "Section editor"}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-600">Section type</Label>
                    <OptionCombobox
                        options={SECTION_TYPE_OPTIONS}
                        value={sectionTypeValue}
                        disabled={!activeSection || !onSectionUpdate}
                        placeholder="Select section type"
                        onChange={(nextValue) => updateSection({ sectionType: nextValue as SectionType })}
                    />
                </div>
            </div>

            <div className="w-full border-t border-gray-200" >
                <div className="p-4">
                    <div>
  
                        {activeSection
                            ? renderSectionEditor({
                                section: activeSection,
                                onSectionUpdate,
                                propertyType,
                                availableBuildings,
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
                    >
                        Close
                    </Button>
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <Button
                            variant="destructive"
                            className="text-lg h-10 px-10 py-5 cursor-pointer"
                            onClick={handleDelete}
                            disabled={!activeSection || !onSectionDelete}
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
                        disabled={!activeSection}
                    >
                        {getActionButtonText()}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export { 
    PdfSplitToolbar,
    SECTION_TYPE_OPTIONS
};
