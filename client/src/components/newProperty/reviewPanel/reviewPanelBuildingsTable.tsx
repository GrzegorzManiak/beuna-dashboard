import { useMemo, useState } from "react";
import { Trash } from "lucide-react";
import { Settings } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ReviewPanelEditModal, type FieldDefinition } from "./reviewPanelEditModal";
import type { ReviewPanelBuildingRow } from "./reviewPanelTypes";

type ReviewPanelBuildingsTableProps = {
    rows: ReviewPanelBuildingRow[];
    savingRowId: string | null;
    onSaveRow: (rowId: string, updates: Record<string, string>) => Promise<boolean>;
    onDeleteRow?: (rowId: string) => void;
};

const BUILDING_FIELDS: FieldDefinition[] = [
    { key: "buildingName", label: "Building name", type: "text" },
    { key: "label", label: "Label", type: "text" },
    { key: "addressStreet", label: "Street", type: "text" },
    { key: "addressHouseNumber", label: "House number", type: "text" },
    { key: "addressPostalCode", label: "Postal code", type: "text" },
    { key: "addressCity", label: "City", type: "text" },
    { key: "buildYear", label: "Build year", type: "number" },
    { key: "floors", label: "Floors", type: "number" },
    { key: "notes", label: "Notes", type: "text", span: 2 },
];

const EM_DASH = "—";

function toAddressSummary(row: ReviewPanelBuildingRow) {
    const streetLine = [row.addressStreet.trim(), row.addressHouseNumber.trim()].filter(Boolean).join(" ").trim();
    const cityLine = [row.addressPostalCode.trim(), row.addressCity.trim()].filter(Boolean).join(" ").trim();
    const parts = [streetLine, cityLine].filter((part) => part.length > 0);
    if (parts.length === 0) return EM_DASH;
    return parts.join(", ");
}

function toInitialValues(row: ReviewPanelBuildingRow): Record<string, string> {
    return {
        buildingName: row.buildingName,
        label: row.label,
        addressStreet: row.addressStreet,
        addressHouseNumber: row.addressHouseNumber,
        addressPostalCode: row.addressPostalCode,
        addressCity: row.addressCity,
        buildYear: row.buildYear,
        floors: row.floors,
        notes: row.notes,
    };
}

function formatNumber(value: number) {
    if (value === 0) return EM_DASH;
    return value % 1 === 0 ? String(value) : value.toFixed(2);
}

function ReviewPanelBuildingsTable({ rows, savingRowId, onSaveRow, onDeleteRow }: ReviewPanelBuildingsTableProps) {
    const [modalRowId, setModalRowId] = useState<string | null>(null);

    const modalRow = modalRowId ? rows.find((r) => r.id === modalRowId) ?? null : null;
    const modalInitialValues = useMemo(() => (modalRow ? toInitialValues(modalRow) : {}), [modalRow]);
    const isSaving = savingRowId === modalRowId;

    async function handleModalSave(values: Record<string, string>) {
        if (!modalRowId) return;
        const wasSaved = await onSaveRow(modalRowId, values);
        if (wasSaved) setModalRowId(null);
    }

    if (rows.length === 0) return <p className="text-sm text-gray-500">No buildings detected.</p>;

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2">Building</th>
                            <th className="px-3 py-2">Address</th>
                            <th className="px-3 py-2 text-right">House No.</th>
                            <th className="px-3 py-2 text-right">Floors</th>
                            <th className="px-3 py-2 text-right">Units</th>
                            <th className="px-3 py-2 text-right">Total Area</th>
                            <th className="px-3 py-2 text-right">Total MEA</th>
                            <th className="w-8 px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {rows.map((row) => (
                            <tr key={row.id} className="odd:bg-muted/10">
                                <td className="px-3 py-2 text-sm text-gray-900">
                                    <span className="font-semibold">{row.buildingName || "Unnamed building"}</span>
                                    {row.label ? <span className="ml-1 text-gray-500">({row.label})</span> : null}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">{toAddressSummary(row)}</td>
                                <td className="px-3 py-2 text-right text-sm text-gray-700">{row.addressHouseNumber.trim() || EM_DASH}</td>
                                <td className="px-3 py-2 text-right text-sm text-gray-700">{row.floors.trim() || EM_DASH}</td>
                                <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">{row.unitCount}</td>
                                <td className="px-3 py-2 text-right text-sm text-gray-700">{formatNumber(row.totalArea)}</td>
                                <td className="px-3 py-2 text-right text-sm text-gray-700">{formatNumber(row.totalMea)}</td>
                                <td className="px-2 py-2">
                                    <div className="flex items-center">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                    aria-label="Delete building"
                                                >
                                                    <Trash className="h-3.5 w-3.5" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Building?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete <span className="font-medium text-foreground">{row.buildingName || "this building"}</span>? This section will be removed.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => typeof onDeleteRow === "function" && onDeleteRow(row.id)}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <button
                                            type="button"
                                            onClick={() => setModalRowId(row.id)}
                                            className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                        >
                                            <Settings className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ReviewPanelEditModal
                open={modalRowId !== null}
                title={`Edit Building${modalRow ? ` — ${modalRow.buildingName || "Unnamed"}` : ""}`}
                fields={BUILDING_FIELDS}
                initialValues={modalInitialValues}
                isSaving={isSaving}
                onClose={() => setModalRowId(null)}
                onSave={handleModalSave}
            />
        </>
    );
}

export {
    ReviewPanelBuildingsTable,
};
