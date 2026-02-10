import { useMemo } from "react";
import { CheckCircle2, AlertCircle, XCircle, AlertTriangle } from "lucide-react";
import type { SectionData } from "./types";
import { Button } from "../ui/button";

type ChecklistProps = {
    sections: SectionData[];
    propertyType: "WEG" | "MV";
    onSectionClick?: (sectionId: string) => void;
    onNext?: () => void;
    onBack?: () => void;
};

type ItemStatus = "complete" | "warning" | "conflict";

type ChecklistItemProps = {
    label: string;
    status: ItemStatus;
    sectionId?: string;
    onClick?: () => void;
};

type ChecklistSectionProps = {
    title: string;
    subtitle?: string;
    items: ChecklistItemProps[];
};

function getStatusIcon(status: ItemStatus) {
    if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === "warning") return <AlertCircle className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
}

function ChecklistItem({ label, status, onClick }: ChecklistItemProps) {
    return (
        <div
            className={`flex items-center gap-2 py-1 ${onClick ? 'cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2 transition-colors' : ''}`}
            onClick={onClick}
        >
            {getStatusIcon(status)}
            <span className="text-sm text-gray-700">{label}</span>
        </div>
    );
}

function ChecklistSection({ title, subtitle, items }: ChecklistSectionProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
            </div>
            <div className="pl-1 space-y-0.5">
                {items.map((item, index) => (
                    <ChecklistItem
                        key={index}
                        label={item.label}
                        status={item.status}
                        onClick={item.onClick}
                    />
                ))}
            </div>
        </div>
    );
}

function Checklist({ sections, propertyType, onSectionClick, onNext, onBack }: ChecklistProps) {
    const unknownSections = useMemo(() => {
        return sections.filter((s) => s.sectionType === "unknown" && s.state !== "identifying");
    }, [sections]);

    const propertyOverview = useMemo(() => {
        const overview = sections.find((s) => s.sectionType === "core.property_overview");
        const address = sections.find((s) => s.sectionType === "core.address");

        const items: ChecklistItemProps[] = [];

        const nameStatus = overview?.fields?.propertyName && overview.state === "valid"
            ? "complete"
            : overview?.state === "conflict"
                ? "conflict"
                : "warning";
        items.push({
            label: "Name",
            status: nameStatus,
            sectionId: overview?.id,
            onClick: overview?.id ? () => onSectionClick?.(overview.id) : undefined
        });

        const addressStatus = address?.state === "valid"
            ? "complete"
            : address?.state === "conflict"
                ? "conflict"
                : "warning";
        items.push({
            label: "Address",
            status: addressStatus,
            sectionId: address?.id,
            onClick: address?.id ? () => onSectionClick?.(address.id) : undefined
        });

        return items;
    }, [sections, onSectionClick]);

    const buildings = useMemo(() => {
        const buildingSections = sections.filter((s) => s.sectionType === "core.building");
        const count = buildingSections.length;

        const items: ChecklistItemProps[] = buildingSections.map((building) => {
            const name = building.fields?.buildingName || building.fields?.label || "Unnamed";
            const status = building.state === "valid"
                ? "complete"
                : building.state === "conflict"
                    ? "conflict"
                    : "warning";
            return {
                label: String(name),
                status,
                sectionId: building.id,
                onClick: () => onSectionClick?.(building.id)
            };
        });

        return { count, items };
    }, [sections, onSectionClick]);

    const units = useMemo(() => {
        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const count = unitSections.length;
        const validUnits = unitSections.filter((u) => u.state === "valid");
        const conflictUnits = unitSections.filter((u) => u.state === "conflict");
        const needsReviewUnits = unitSections.filter((u) => !u.state || ["needs_review", "processing", "identifying", "unknown"].includes(u.state));

        const items: ChecklistItemProps[] = [];
        if (validUnits.length > 0) items.push({
            label: `${validUnits.length} confirmed`,
            status: "complete",
            onClick: validUnits[0] ? () => onSectionClick?.(validUnits[0].id) : undefined
        });

        if (conflictUnits.length > 0) items.push({
            label: `${conflictUnits.length} conflict${conflictUnits.length > 1 ? 's' : ''}`,
            status: "conflict",
            onClick: conflictUnits[0] ? () => onSectionClick?.(conflictUnits[0].id) : undefined
        });

        if (needsReviewUnits.length > 0) items.push({
            label: `${needsReviewUnits.length} need${needsReviewUnits.length > 1 ? '' : 's'} review`,
            status: "warning",
            onClick: needsReviewUnits[0] ? () => onSectionClick?.(needsReviewUnits[0].id) : undefined
        });


        return { count, items };
    }, [sections, onSectionClick]);

    const ownership = useMemo(() => {
        if (propertyType !== "WEG") return null;

        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const specialRights = sections.find((s) => s.sectionType === "weg.special_rights_block");

        const unitsWithMea = unitSections.filter((u) =>
            u.fields?.meaNumerator && u.fields?.meaDenominator
        );
        const unitsWithoutMea = unitSections.filter((u) =>
            !u.fields?.meaNumerator || !u.fields?.meaDenominator
        );

        const meaStatus: ItemStatus = unitsWithMea.length === unitSections.length && unitSections.length > 0
            ? "complete"
            : unitsWithMea.length > 0
                ? "warning"
                : "warning";

        const specialRightsStatus: ItemStatus = specialRights?.state === "valid"
            ? "complete"
            : specialRights
                ? "warning"
                : "warning";

        return [
            {
                label: "MEA values assigned",
                status: meaStatus,
                onClick: unitsWithoutMea[0] ? () => onSectionClick?.(unitsWithoutMea[0].id) : unitSections[0] ? () => onSectionClick?.(unitSections[0].id) : undefined
            },
            {
                label: "Special rights reviewed",
                status: specialRightsStatus,
                onClick: specialRights ? () => onSectionClick?.(specialRights.id) : undefined
            },
        ];
    }, [sections, propertyType, onSectionClick]);

    const mvOwnership = useMemo(() => {
        if (propertyType !== "MV") return null;

        const overview = sections.find((s) => s.sectionType === "core.property_overview");
        const ownerEntity = sections.find((s) => s.sectionType === "mv.owner_entity_block");

        const typeStatus: ItemStatus = overview?.fields?.managementTypeHint === "MV" && overview.state === "valid"
            ? "complete"
            : "warning";

        const ownerStatus: ItemStatus = ownerEntity?.state === "valid"
            ? "complete"
            : ownerEntity
                ? "warning"
                : "warning";

        return [
            {
                label: "Property type confirmed",
                status: typeStatus,
                onClick: overview ? () => onSectionClick?.(overview.id) : undefined
            },
            {
                label: "Owner entity detected",
                status: ownerStatus,
                onClick: ownerEntity ? () => onSectionClick?.(ownerEntity.id) : undefined
            },
        ];
    }, [sections, propertyType, onSectionClick]);

    return (
        <div className="space-y-4 bg-white rounded-lg border border-gray-200">
            <div className="p-4 space-y-4">
                <div className="border-b border-gray-200 pb-2">
                    <h2 className="text-base font-semibold text-gray-900">Structure Checklist</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        This checklist provides an overview of the detected sections and their status. Use it to identify areas that may require review or further attention.
                    </p>
                </div>

                {unknownSections.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-orange-900">
                                {unknownSections.length} unknown section{unknownSections.length > 1 ? 's' : ''} detected
                            </p>
                            <p className="text-xs text-orange-700 mt-0.5">
                                These sections could not be automatically classified. Please review and assign the correct type.
                            </p>
                        </div>
                    </div>
                )}

                <ChecklistSection
                    title="Property"
                    items={propertyOverview}
                />

                <ChecklistSection
                    title="Buildings"
                    subtitle={`(${buildings.count})`}
                    items={buildings.items.length > 0 ? buildings.items : [{ label: "No buildings detected", status: "warning" }]}
                />

                <ChecklistSection
                    title="Units"
                    subtitle={`(${units.count})`}
                    items={units.items.length > 0 ? units.items : [{ label: "No units detected", status: "warning" }]}
                />

                {propertyType === "WEG" && ownership && (
                    <ChecklistSection
                        title="Ownership Structure"
                        items={ownership}
                    />
                )}

                {propertyType === "MV" && mvOwnership && (
                    <ChecklistSection
                        title="Property Ownership"
                        items={mvOwnership}
                    />
                )}
            </div>

            <div className="px-4 py-5 bg-gray-50 text-xs text-gray-500 border-t border-gray-200 flex justify-end gap-2 rounded-b-lg">
                <Button
                    variant="outline"
                    className="text-lg h-10 px-6 cursor-pointer"
                    onClick={onBack}
                >
                    Back
                </Button>
                <Button
                    className="grow text-lg h-10 cursor-pointer"
                    onClick={onNext}
                    disabled={unknownSections.length > 0}
                >
                    Continue
                </Button>
            </div>
        </div>
    );
}

export { Checklist };
