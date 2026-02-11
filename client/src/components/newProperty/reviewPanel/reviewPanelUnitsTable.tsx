import { Fragment, useMemo, useState } from "react";
import { Settings, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ReviewPanelEditModal, type FieldDefinition } from "./reviewPanelEditModal";
import type { ReviewPanelBuildingOption, ReviewPanelUnitRow } from "./reviewPanelTypes";
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

type EditableUnitField = "unitNumber" | "unitType" | "buildingRef" | "area" | "meaNumerator";

const EM_DASH = "—";

const UNIT_TYPE_OPTIONS = [
    { label: "Apartment", value: "apartment" },
    { label: "Office", value: "office" },
    { label: "Parking", value: "parking" },
    { label: "Garden", value: "garden" },
    { label: "Storage", value: "storage" },
    { label: "Other", value: "other" },
];

type ReviewPanelUnitsTableProps = {
    rows: ReviewPanelUnitRow[];
    buildingOptions: ReviewPanelBuildingOption[];
    propertyType: "WEG" | "MV";
    onCommitCell: (rowId: string, field: EditableUnitField, value: string) => Promise<boolean>;
    onSaveRow: (rowId: string, updates: Record<string, string>) => Promise<boolean>;
    onDeleteRow?: (rowId: string) => void;
};

type EditingCell = {
    rowId: string;
    field: EditableUnitField;
};

function toCellKey(rowId: string, field: EditableUnitField) {
    return `${rowId}:${field}`;
}

function buildUnitFieldDefinitions(
    buildingOptions: ReviewPanelBuildingOption[],
    propertyType: "WEG" | "MV",
): FieldDefinition[] {
    const fields: FieldDefinition[] = [
        { key: "unitNumber", label: "Unit number", type: "text" },
        { key: "unitType", label: "Type", type: "select", options: UNIT_TYPE_OPTIONS },
        { key: "buildingRef", label: "Building", type: "select", options: buildingOptions.map((o) => ({ label: o.label, value: o.value })) },
        { key: "area", label: "Area (m²)", type: "number" },
    ];

    if (propertyType === "WEG") {
        fields.push({ key: "meaNumerator", label: "MEA", type: "number" });
    }

    fields.push(
        { key: "floor", label: "Floor", type: "text" },
        { key: "entrance", label: "Entrance", type: "text" },
        { key: "rooms", label: "Rooms", type: "number" },
        { key: "description", label: "Description", type: "text", span: 2 },
    );

    return fields;
}

function ReviewPanelUnitsTable({ rows, buildingOptions, propertyType, onCommitCell, onSaveRow, onDeleteRow }: ReviewPanelUnitsTableProps) {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [draftValue, setDraftValue] = useState<string>("");
    const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
    const [modalRowId, setModalRowId] = useState<string | null>(null);
    const [isSavingModal, setIsSavingModal] = useState(false);

    const unitFieldDefs = useMemo(
        () => buildUnitFieldDefinitions(buildingOptions, propertyType),
        [buildingOptions, propertyType],
    );

    const buildingLabelByValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const option of buildingOptions) map.set(option.value, option.label);
        return map;
    }, [buildingOptions]);

    const unitTypeLabelByValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const option of UNIT_TYPE_OPTIONS) map.set(option.value, option.label);
        return map;
    }, []);

    const modalRow = modalRowId ? rows.find((r) => r.id === modalRowId) ?? null : null;

    const modalInitialValues = useMemo<Record<string, string>>(() => {
        if (!modalRow) return {};
        return {
            unitNumber: modalRow.unitNumber,
            unitType: modalRow.unitType,
            buildingRef: modalRow.buildingRef,
            area: modalRow.area,
            meaNumerator: modalRow.meaNumerator,
            floor: modalRow.floor,
            entrance: modalRow.entrance,
            rooms: modalRow.rooms,
            description: modalRow.description,
        } as Record<string, string>;
    }, [modalRow]);

    function handleBeginEdit(rowId: string, field: EditableUnitField, value: string) {
        setEditingCell({ rowId, field });
        setDraftValue(value);
    }

    function handleCancelEdit() {
        setEditingCell(null);
        setDraftValue("");
    }

    async function handleCommitEdit() {
        if (!editingCell) return;
        const wasSaved = await onCommitCell(editingCell.rowId, editingCell.field, draftValue);
        if (wasSaved) {
            setChangedCells((current) => ({ ...current, [toCellKey(editingCell.rowId, editingCell.field)]: true }));
        }
        setEditingCell(null);
        setDraftValue("");
    }

    async function handleModalSave(values: Record<string, string>) {
        if (!modalRowId) return;
        setIsSavingModal(true);
        const wasSaved = await onSaveRow(modalRowId, values);
        setIsSavingModal(false);
        if (wasSaved) setModalRowId(null);
    }

    function isEditing(rowId: string, field: EditableUnitField) {
        return editingCell?.rowId === rowId && editingCell.field === field;
    }

    function getCellClassName(rowId: string, field: EditableUnitField) {
        return changedCells[toCellKey(rowId, field)] ? "bg-amber-50" : "";
    }

    if (rows.length === 0) return <p className="text-sm text-gray-500">No units detected.</p>;

    const totalArea = rows.reduce((sum, row) => {
        const parsed = parseFloat(row.area);
        return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);

    const totalMea = rows.reduce((sum, row) => {
        const parsed = parseFloat(row.meaNumerator);
        return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);

    const groupedRows = useMemo(() => {
        const groups = new Map<string, ReviewPanelUnitRow[]>();
        const unassigned: ReviewPanelUnitRow[] = [];

        for (const row of rows) {
            if (!row.buildingRef) {
                unassigned.push(row);
            } else {
                const list = groups.get(row.buildingRef) ?? [];
                list.push(row);
                groups.set(row.buildingRef, list);
            }
        }

        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
            const labelA = buildingLabelByValue.get(a[0]) ?? "";
            const labelB = buildingLabelByValue.get(b[0]) ?? "";
            return labelA.localeCompare(labelB);
        });

        return { sortedGroups, unassigned };
    }, [rows, buildingLabelByValue]);

    const renderRow = (row: ReviewPanelUnitRow) => (
        <tr key={row.id} className="odd:bg-muted/10">
            {renderTextCell(row, "unitNumber", row.unitNumber)}
            {renderTypeCell(row)}
            {renderBuildingCell(row)}
            {renderTextCell(row, "area", row.area)}
            {renderTextCell(row, "meaNumerator", row.meaNumerator)}
            <td className="px-3 py-2 text-sm text-gray-600">{row.specialRightsLabel || EM_DASH}</td>
            <td className="px-2 py-2">
                <div className="flex items-center">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                type="button"
                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete unit"
                            >
                                <Trash className="h-3.5 w-3.5" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Unit?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete <span className="font-medium text-foreground">{row.unitNumber ? `Unit ${row.unitNumber}` : "this unit"}</span>? This section will be removed.
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
    );

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2">Unit</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Building</th>
                            <th className="px-3 py-2">Area</th>
                            <th className="px-3 py-2">MEA</th>
                            <th className="px-3 py-2">Special Rights</th>
                            <th className="w-8 px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {groupedRows.unassigned.length > 0 && (
                            <>
                                <tr className="bg-amber-50">
                                    <td colSpan={7} className="px-3 py-1.5 text-xs font-bold text-amber-700 uppercase tracking-wide">
                                        Unassigned Units
                                    </td>
                                </tr>
                                {groupedRows.unassigned.map(renderRow)}
                            </>
                        )}
                        {groupedRows.sortedGroups.map(([buildingRef, units]) => (
                            <Fragment key={buildingRef}>
                                <tr className="bg-gray-50/80">
                                    <td colSpan={7} className="px-3 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                                        {buildingLabelByValue.get(buildingRef) ?? "Unknown Building"}
                                    </td>
                                </tr>
                                {units.map(renderRow)}
                            </Fragment>
                        ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                        <tr className="text-sm font-semibold text-gray-700">
                            <td className="px-3 py-2" colSpan={3}>Total</td>
                            <td className="px-3 py-2">{totalArea > 0 ? (totalArea % 1 === 0 ? String(totalArea) : totalArea.toFixed(2)) : EM_DASH}</td>
                            <td className="px-3 py-2">{totalMea > 0 ? (totalMea % 1 === 0 ? String(totalMea) : totalMea.toFixed(2)) : EM_DASH}</td>
                            <td className="px-3 py-2" colSpan={2} />
                        </tr>
                    </tfoot>
                </table>
            </div>

            <ReviewPanelEditModal
                open={modalRowId !== null}
                title={`Edit Unit ${modalRow?.unitNumber || ""}`}
                fields={unitFieldDefs}
                initialValues={modalInitialValues}
                isSaving={isSavingModal}
                onClose={() => setModalRowId(null)}
                onSave={handleModalSave}
            />
        </>
    );

    function renderTextCell(row: ReviewPanelUnitRow, field: EditableUnitField, value: string) {
        return (
            <td className={`px-3 py-2 text-sm ${getCellClassName(row.id, field)}`}>
                {isEditing(row.id, field) ? (
                    <Input
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => void handleCommitEdit()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void handleCommitEdit(); return; }
                            if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
                        }}
                        className="h-8 bg-white"
                    />
                ) : (
                    <button type="button" className="w-full text-left" onClick={() => handleBeginEdit(row.id, field, value)}>
                        {value || EM_DASH}
                    </button>
                )}
            </td>
        );
    }

    function renderTypeCell(row: ReviewPanelUnitRow) {
        return (
            <td className={`px-3 py-2 text-sm ${getCellClassName(row.id, "unitType")}`}>
                {isEditing(row.id, "unitType") ? (
                    <select
                        autoFocus
                        value={draftValue}
                        onBlur={() => void handleCommitEdit()}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void handleCommitEdit(); return; }
                            if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
                        }}
                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                    >
                        <option value="">—</option>
                        {UNIT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : (
                    <button type="button" className="w-full text-left" onClick={() => handleBeginEdit(row.id, "unitType", row.unitType)}>
                        {unitTypeLabelByValue.get(row.unitType) || row.unitType || EM_DASH}
                    </button>
                )}
            </td>
        );
    }

    function renderBuildingCell(row: ReviewPanelUnitRow) {
        const hasWarning = !row.buildingRef;
        return (
            <td className={`px-3 py-2 text-sm ${getCellClassName(row.id, "buildingRef")} ${hasWarning ? "bg-amber-100" : ""}`}>
                {isEditing(row.id, "buildingRef") ? (
                    <select
                        autoFocus
                        value={draftValue}
                        onBlur={() => void handleCommitEdit()}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void handleCommitEdit(); return; }
                            if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
                        }}
                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                    >
                        <option value="">Unassigned</option>
                        {buildingOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                ) : (
                    <button type="button" className="w-full text-left" onClick={() => handleBeginEdit(row.id, "buildingRef", row.buildingRef)}>
                        {(buildingLabelByValue.get(row.buildingRef) ?? row.buildingLabel) || "Unassigned"}
                    </button>
                )}
            </td>
        );
    }
}

export {
    type EditableUnitField,
    ReviewPanelUnitsTable,
};
