import { useMemo } from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { SectionData } from "./types";

type ChecklistProps = {
    sections: SectionData[];
    propertyType: "WEG" | "MV";
};

type ItemStatus = "complete" | "warning" | "conflict";

type ChecklistItemProps = {
    label: string;
    status: ItemStatus;
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

function ChecklistItem({ label, status }: ChecklistItemProps) {
    return (
        <div className="flex items-center gap-2 py-1">
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
                    <ChecklistItem key={index} label={item.label} status={item.status} />
                ))}
            </div>
        </div>
    );
}

function Checklist({ sections, propertyType }: ChecklistProps) {
    const propertyOverview = useMemo(() => {
        const overview = sections.find((s) => s.sectionType === "core.property_overview");
        const address = sections.find((s) => s.sectionType === "core.address");
        
        const items: ChecklistItemProps[] = [];
        
        const nameStatus = overview?.fields?.propertyName && overview.state === "valid" 
            ? "complete" 
            : overview?.state === "conflict" 
            ? "conflict" 
            : "warning";
        items.push({ label: "Name", status: nameStatus });
        
        const addressStatus = address?.state === "valid" 
            ? "complete" 
            : address?.state === "conflict" 
            ? "conflict" 
            : "warning";
        items.push({ label: "Address", status: addressStatus });
        
        return items;
    }, [sections]);

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
            return { label: String(name), status };
        });
        
        return { count, items };
    }, [sections]);

    const units = useMemo(() => {
        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const count = unitSections.length;
        const validCount = unitSections.filter((u) => u.state === "valid").length;
        const conflictCount = unitSections.filter((u) => u.state === "conflict").length;
        const needsReviewCount = count - validCount - conflictCount;
        
        const items: ChecklistItemProps[] = [];
        if (validCount > 0) {
            items.push({ 
                label: `${validCount} confirmed`, 
                status: "complete" 
            });
        }
        if (conflictCount > 0) {
            items.push({ 
                label: `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`, 
                status: "conflict" 
            });
        }
        if (needsReviewCount > 0) {
            items.push({ 
                label: `${needsReviewCount} need${needsReviewCount > 1 ? '' : 's'} review`, 
                status: "warning" 
            });
        }
        
        return { count, items };
    }, [sections]);

    const ownership = useMemo(() => {
        if (propertyType !== "WEG") return null;
        
        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const specialRights = sections.find((s) => s.sectionType === "weg.special_rights_block");
        
        const unitsWithMea = unitSections.filter((u) => 
            u.fields?.meaNumerator && u.fields?.meaDenominator
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
            { label: "MEA values assigned", status: meaStatus },
            { label: "Special rights reviewed", status: specialRightsStatus },
        ];
    }, [sections, propertyType]);

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
            { label: "Property type confirmed", status: typeStatus },
            { label: "Owner entity detected", status: ownerStatus },
        ];
    }, [sections, propertyType]);

    return (
        <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 pb-2">
                <h2 className="text-base font-semibold text-gray-900">Structure Verification</h2>
                <p className="text-xs text-gray-500 mt-1">
                    Confirm the property structure is mapped correctly
                </p>
            </div>

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
    );
}

export { Checklist };
