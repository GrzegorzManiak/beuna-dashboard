import { useMemo } from "react";
import { CheckCircle2, AlertCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { SectionData } from "./pdfViewer.types";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

type ChecklistProps = {
    sections: SectionData[];
    propertyType: "WEG" | "MV";
    onSectionClick?: (sectionId: string) => void;
    onNext?: () => void | Promise<void>;
    onBack?: () => void;
};

type ItemStatus = "complete" | "warning" | "conflict" | "processing" | "error";

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

function getStatusIcon(status: ItemStatus ){
    if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === "processing") return <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-red-600" />;
    if (status === "warning") return <AlertCircle className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
}

/** Map a SectionData state to a checklist ItemStatus */
function sectionStatus(section: SectionData | undefined ){
    if (!section) return "warning";
    switch (section.state) {
        case "valid": return "complete";
        case "conflict": return "conflict";
        case "error": return "error";
        case "processing":
        case "identifying": return "processing";
        default: return "warning";
    }
}

function ChecklistItem({ label, status, onClick }: ChecklistItemProps){
    return (
        <div
            className={`flex items-center gap-2 py-1 ${onClick ? 'cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2 transition-colors' : ''}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
 if (e.key === "Enter" || e.key === " ") onClick(); 
} : undefined}
        >
            {getStatusIcon(status)}
            <span className="text-sm text-gray-700">{label}</span>
        </div>
    );
}

function ChecklistSection({ title, subtitle, items }: ChecklistSectionProps){
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

function Checklist({ sections, propertyType, onSectionClick, onNext, onBack }: ChecklistProps){
    const unknownSections = useMemo(() => {
        return sections.filter((s) => s.sectionType === "unknown" && s.state !== "identifying");
    }, [sections]);

    const propertyOverview = useMemo(() => {
        const overview = sections.find((s) => s.sectionType === "core.property_overview");
        const address = sections.find((s) => s.sectionType === "core.address");

        const items: ChecklistItemProps[] = [];

        if (overview) {
            items.push({
                label: overview.fields?.propertyName ? `Name: ${String(overview.fields.propertyName)}` : "Name",
                status: sectionStatus(overview),
                sectionId: overview.id,
                onClick: () => onSectionClick?.(overview.id),
            });
        } else {
            items.push({ label: "Name — not detected", status: "warning" });
        }

        if (address) {
            const parts = [address.fields?.street, address.fields?.houseNumber, address.fields?.city].filter(Boolean);
            items.push({
                label: parts.length ? `Address: ${parts.join(" ")}` : "Address",
                status: sectionStatus(address),
                sectionId: address.id,
                onClick: () => onSectionClick?.(address.id),
            });
        } else {
            items.push({ label: "Address — not detected", status: "warning" });
        }

        return items;
    }, [sections, onSectionClick]);

    const buildings = useMemo(() => {
        const buildingSections = sections.filter((s) => s.sectionType === "core.building");
        const count = buildingSections.length;

        const items: ChecklistItemProps[] = buildingSections.map((building) => {
            const name = building.fields?.buildingName || building.fields?.label || "Unnamed building";
            return {
                label: String(name),
                status: sectionStatus(building),
                sectionId: building.id,
                onClick: () => onSectionClick?.(building.id),
            };
        });

        if (items.length === 0) {
            items.push({ label: "No buildings detected", status: "warning" });
        }

        return { count, items };
    }, [sections, onSectionClick]);

    const units = useMemo(() => {
        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const count = unitSections.length;

        const items: ChecklistItemProps[] = unitSections.map((unit) => {
            const num = unit.fields?.unitNumber || "?";
            const type = unit.fields?.unitType || "";
            const label = type ? `Unit ${num} (${type})` : `Unit ${num}`;
            return {
                label: String(label),
                status: sectionStatus(unit),
                sectionId: unit.id,
                onClick: () => onSectionClick?.(unit.id),
            };
        });

        if (items.length === 0) {
            items.push({ label: "No units detected", status: "warning" });
        }

        return { count, items };
    }, [sections, onSectionClick]);

    const ownership = useMemo(() => {
        if (propertyType !== "WEG") return null;

        const unitSections = sections.filter((s) => s.sectionType === "units.unit_block");
        const meaDecl = sections.find((s) => s.sectionType === "weg.mea_declaration");
        const specialRightsSections = sections.filter((s) => s.sectionType === "weg.special_rights");

        const items: ChecklistItemProps[] = [];

        // MEA Declaration
        if (meaDecl) {
            const total = meaDecl.fields?.totalMea;
            items.push({
                label: total ? `MEA Declaration: ${total}` : "MEA Declaration",
                status: sectionStatus(meaDecl),
                sectionId: meaDecl.id,
                onClick: () => onSectionClick?.(meaDecl.id),
            });
        } else {
            items.push({ label: "MEA Declaration — not detected", status: "warning" });
        }

        // MEA assignments on units (summary)
        const unitsWithMea = unitSections.filter((u) => u.fields?.meaNumerator);
        if (unitSections.length > 0) {
            const allAssigned = unitsWithMea.length === unitSections.length;
            const firstMissing = unitSections.find((u) => !u.fields?.meaNumerator);
            items.push({
                label: allAssigned
                    ? `MEA assigned to all ${unitSections.length} units`
                    : `MEA assigned to ${unitsWithMea.length}/${unitSections.length} units`,
                status: allAssigned ? "complete" : "warning",
                onClick: firstMissing
                    ? () => onSectionClick?.(firstMissing.id)
                    : unitSections[0] ? () => onSectionClick?.(unitSections[0].id) : undefined,
            });
        }

        // Individual special rights
        if (specialRightsSections.length > 0) {
            for (const sr of specialRightsSections) {
                const unitRef = sr.fields?.unitRef || "?";
                const rightType = sr.fields?.rightType || "";
                const label = rightType ? `Special right: Unit ${unitRef} (${rightType})` : `Special right: Unit ${unitRef}`;
                items.push({
                    label: String(label),
                    status: sectionStatus(sr),
                    sectionId: sr.id,
                    onClick: () => onSectionClick?.(sr.id),
                });
            }
        } else {
            items.push({ label: "No special rights detected", status: "complete" });
        }

        return items;
    }, [sections, propertyType, onSectionClick]);

    const administration = useMemo(() => {
        if (propertyType !== "WEG") return null;

        const manager = sections.find((s) => s.sectionType === "weg.property_manager");
        const accountant = sections.find((s) => s.sectionType === "weg.accountant");

        const items: ChecklistItemProps[] = [];

        if (manager) {
            const name = manager.fields?.managerName;
            items.push({
                label: name ? `Property Manager: ${String(name)}` : "Property Manager",
                status: sectionStatus(manager),
                sectionId: manager.id,
                onClick: () => onSectionClick?.(manager.id),
            });
        } else {
            items.push({ label: "Property Manager — not detected", status: "warning" });
        }

        if (accountant) {
            const name = accountant.fields?.accountantName;
            items.push({
                label: name ? `Accountant: ${String(name)}` : "Accountant",
                status: sectionStatus(accountant),
                sectionId: accountant.id,
                onClick: () => onSectionClick?.(accountant.id),
            });
        } else {
            items.push({ label: "Accountant — not detected", status: "warning" });
        }

        return items;
    }, [sections, propertyType, onSectionClick]);

    const mvOwnership = useMemo(() => {
        if (propertyType !== "MV") return null;

        const overview = sections.find((s) => s.sectionType === "core.property_overview");
        const ownerEntities = sections.filter((s) => s.sectionType === "mv.owner_entity");

        const items: ChecklistItemProps[] = [];

        if (overview) {
            const confirmed = overview.fields?.managementTypeHint === "MV" && overview.state === "valid";
            items.push({
                label: "Property type confirmed",
                status: confirmed ? "complete" : "warning",
                sectionId: overview.id,
                onClick: () => onSectionClick?.(overview.id),
            });
        }

        if (ownerEntities.length > 0) {
            for (const entity of ownerEntities) {
                const name = entity.fields?.ownerName || "Unknown";
                items.push({
                    label: `Owner: ${String(name)}`,
                    status: sectionStatus(entity),
                    sectionId: entity.id,
                    onClick: () => onSectionClick?.(entity.id),
                });
            }
        } else {
            items.push({ label: "Owner entity — not detected", status: "warning" });
        }

        return items;
    }, [sections, propertyType, onSectionClick]);

    // Count how many sections still need attention
    const pendingCount = useMemo(() => {
        const attentionStates = ["needs_review", "conflict", "error", "unknown"];
        return sections.filter((s) => !s.state || attentionStates.includes(s.state)).length;
    }, [sections]);

    return (
        <div className="flex flex-col bg-white rounded-lg border border-gray-200 max-h-full overflow-hidden">
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="border-b border-gray-200 pb-2">
                    <h2 className="text-base font-semibold text-gray-900">Structure Checklist</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Review each item below. Click any row to jump to that section in the document.
                    </p>
                </div>

                {unknownSections.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-1.5">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-orange-900">
                                    {unknownSections.length} unknown section{unknownSections.length > 1 ? 's' : ''} detected
                                </p>
                                <p className="text-xs text-orange-700 mt-0.5">
                                    Click below to review and assign the correct type.
                                </p>
                            </div>
                        </div>
                        <div className="pl-1 space-y-0.5">
                            {unknownSections.map((s, i) => (
                                <ChecklistItem
                                    key={s.id}
                                    label={`Unknown section ${i + 1}`}
                                    status="conflict"
                                    onClick={() => onSectionClick?.(s.id)}
                                />
                            ))}
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
                    items={buildings.items}
                />

                <ChecklistSection
                    title="Units"
                    subtitle={`(${units.count})`}
                    items={units.items}
                />

                {propertyType === "WEG" && ownership && (
                    <ChecklistSection
                        title="Ownership Structure"
                        items={ownership}
                    />
                )}

                {propertyType === "WEG" && administration && (
                    <ChecklistSection
                        title="Administration"
                        items={administration}
                    />
                )}

                {propertyType === "MV" && mvOwnership && (
                    <ChecklistSection
                        title="Property Ownership"
                        items={mvOwnership}
                    />
                )}
            </div>

            <div className="px-4 py-5 bg-gray-50 text-xs text-gray-500 border-t border-gray-200 flex justify-end gap-2 rounded-b-lg shrink-0">
                <Button
                    variant="outline"
                    className="text-lg h-10 px-6 cursor-pointer"
                    onClick={onBack}
                >
                    Back
                </Button>
                <Button
                    className={cn(
                        "grow  h-10 cursor-pointer",
                        pendingCount > 0 ? "text-md" : "text-lg",
                    )}
                    onClick={onNext}
                    disabled={unknownSections.length > 0}
                >
                    {pendingCount > 0 ? `Continue (${pendingCount} pending)` : "Continue"}
                </Button>
            </div>
        </div>
    );
}

export { Checklist };
