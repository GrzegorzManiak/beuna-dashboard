import { Badge } from "../../ui/badge";
import type { SectionData } from "../types";

const STATE_BADGES: Record<string, { label: string; className: string }> = {
    valid: { label: "Valid", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    conflict: { label: "Conflict", className: "bg-red-100 text-red-700 border-red-200" },
    processing: { label: "Processing", className: "bg-amber-100 text-amber-700 border-amber-200" },
    identifying: { label: "Identifying", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    unknown: { label: "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

type UnitBlockTableProps = {
    sections: SectionData[];
    activeSectionId: string | null;
    propertyType: "WEG" | "MV";
    onSectionSelect?: (sectionId: string) => void;
    availableBuildings?: Map<string, string>;
};

function UnitBlockTable({ sections, activeSectionId, propertyType, onSectionSelect, availableBuildings }: UnitBlockTableProps) {
    if (!sections.length) {
        return (
            <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                No unit blocks yet. Drag select a unit block to create one.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                {sections.length} Unit {sections.length > 1 ? "Blocks" : "Block"}
            </div>
            <div className="max-h-45 overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-gray-400">
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
                        {sections.map((section, index) => {
                            const isActive = section.id === activeSectionId;
                            const fields = section.fields ?? {};
                            const status = section.state ? STATE_BADGES[section.state] : STATE_BADGES.unknown;
                            const meaValue =
                                fields.meaNumerator && fields.meaDenominator
                                    ? `${fields.meaNumerator}/${fields.meaDenominator}`
                                    : fields.meaRawText || "–";
                            
                            const buildingUuid = fields.buildingRef;
                            const buildingDisplay = buildingUuid && availableBuildings 
                                ? availableBuildings.get(String(buildingUuid)) || String(buildingUuid)
                                : buildingUuid || "–";

                            return (
                                <tr
                                    key={section.id}
                                    className={`cursor-pointer border-t border-gray-100 transition-colors ${
                                        isActive ? "bg-emerald-50" : index % 2 === 1 ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-gray-50"
                                    }`}
                                    onClick={() => onSectionSelect?.(section.id)}
                                >
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                        {fields.unitNumber || section.id}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">
                                        {fields.unitType || "–"}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">
                                        {buildingDisplay}
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
}

export { UnitBlockTable };
