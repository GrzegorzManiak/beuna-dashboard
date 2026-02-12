import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ReviewPanelEditModal, type FieldDefinition } from "./reviewPanelEditModal";
import type { ReviewPanelSpecialRightRow } from "./reviewPanelTypes";

type EditableSpecialRightField = "unitRef" | "rightType" | "description";

const RIGHT_TYPE_OPTIONS = [
    { label: "Terrace", value: "terrace" },
    { label: "Roof terrace", value: "roof_terrace" },
    { label: "Garden", value: "garden" },
    { label: "Parking access", value: "parking_access" },
    { label: "Mixed", value: "mixed" },
    { label: "Other", value: "other" },
];

const SPECIAL_RIGHT_FIELDS: FieldDefinition[] = [
    { key: "unitRef", label: "Unit reference", type: "text" },
    { key: "rightType", label: "Right type", type: "select", options: RIGHT_TYPE_OPTIONS },
    { key: "description", label: "Description", type: "text", span: 2 },
    { key: "area", label: "Area (m²)", type: "number" },
];

type ReviewPanelSpecialRightsListProps = {
    rows: ReviewPanelSpecialRightRow[];
    onCommitField: (rowId: string, field: EditableSpecialRightField, value: string) => Promise<boolean>;
    onSaveRow: (rowId: string, updates: Record<string, string>) => Promise<boolean>;
};

type EditingCell = {
    rowId: string;
    field: EditableSpecialRightField;
};

function toCellKey(rowId: string, field: EditableSpecialRightField) {
    return `${rowId}:${field}`;
}

function ReviewPanelSpecialRightsList({ rows, onCommitField, onSaveRow }: ReviewPanelSpecialRightsListProps) {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [draftValue, setDraftValue] = useState<string>("");
    const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
    const [modalRowId, setModalRowId] = useState<string | null>(null);
    const [isSavingModal, setIsSavingModal] = useState(false);

    const rightTypeLabelByValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const option of RIGHT_TYPE_OPTIONS) map.set(option.value, option.label);
        return map;
    }, []);

    const modalRow = modalRowId ? rows.find((r) => r.id === modalRowId) ?? null : null;

    const modalInitialValues = useMemo<Record<string, string>>(() => {
        if (!modalRow) return {};
        return {
            unitRef: modalRow.unitRef,
            rightType: modalRow.rightType,
            description: modalRow.description,
            area: modalRow.area,
        } as Record<string, string>;
    }, [modalRow]);

    function handleStartEdit(rowId: string, field: EditableSpecialRightField, value: string) {
        setEditingCell({ rowId, field });
        setDraftValue(value);
    }

    function handleCancelEdit() {
        setEditingCell(null);
        setDraftValue("");
    }

    async function handleCommitEdit() {
        if (!editingCell) return;
        const wasSaved = await onCommitField(editingCell.rowId, editingCell.field, draftValue);
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

    if (rows.length === 0) return <p className="text-sm text-gray-500">No special rights detected.</p>;

    return (
        <>
            <div className="space-y-2">
                {rows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-[140px_180px_minmax(0,1fr)_auto] sm:items-center">
                            <div className={changedCells[toCellKey(row.id, "unitRef")] ? "rounded bg-amber-50 px-2 py-1" : "px-2 py-1"}>
                                {editingCell?.rowId === row.id && editingCell.field === "unitRef" ? (
                                    <Input
                                        autoFocus
                                        value={draftValue}
                                        onChange={(e) => setDraftValue(e.target.value)}
                                        onBlur={() => void handleCommitEdit()}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
 e.preventDefault(); void handleCommitEdit(); return; 
}
                                            if (e.key === "Escape") {
 e.preventDefault(); handleCancelEdit(); 
}
                                        }}
                                        className="h-8 bg-white"
                                    />
                                ) : (
                                    <button type="button" className="w-full text-left text-sm font-semibold text-gray-900" onClick={() => handleStartEdit(row.id, "unitRef", row.unitRef)}>
                                        Unit {row.unitRef || "-"}
                                    </button>
                                )}
                            </div>

                            <div className={changedCells[toCellKey(row.id, "rightType")] ? "rounded bg-amber-50 px-2 py-1" : "px-2 py-1"}>
                                {editingCell?.rowId === row.id && editingCell.field === "rightType" ? (
                                    <select
                                        autoFocus
                                        value={draftValue}
                                        onBlur={() => void handleCommitEdit()}
                                        onChange={(e) => setDraftValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
 e.preventDefault(); void handleCommitEdit(); return; 
}
                                            if (e.key === "Escape") {
 e.preventDefault(); handleCancelEdit(); 
}
                                        }}
                                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                                    >
                                        <option value="">—</option>
                                        {RIGHT_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <button type="button" className="w-full text-left text-sm text-gray-700" onClick={() => handleStartEdit(row.id, "rightType", row.rightType)}>
                                        {rightTypeLabelByValue.get(row.rightType) || row.rightType || "-"}
                                    </button>
                                )}
                            </div>

                            <div className={changedCells[toCellKey(row.id, "description")] ? "rounded bg-amber-50 px-2 py-1" : "px-2 py-1"}>
                                {editingCell?.rowId === row.id && editingCell.field === "description" ? (
                                    <Input
                                        autoFocus
                                        value={draftValue}
                                        onChange={(e) => setDraftValue(e.target.value)}
                                        onBlur={() => void handleCommitEdit()}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
 e.preventDefault(); void handleCommitEdit(); return; 
}
                                            if (e.key === "Escape") {
 e.preventDefault(); handleCancelEdit(); 
}
                                        }}
                                        className="h-8 bg-white"
                                    />
                                ) : (
                                    <button type="button" className="w-full text-left text-sm text-gray-600" onClick={() => handleStartEdit(row.id, "description", row.description)}>
                                        {row.description || "No description"}
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setModalRowId(row.id)}
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <Settings className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <ReviewPanelEditModal
                open={modalRowId !== null}
                title={`Edit Special Right${modalRow ? ` — Unit ${modalRow.unitRef || "?"}` : ""}`}
                fields={SPECIAL_RIGHT_FIELDS}
                initialValues={modalInitialValues}
                isSaving={isSavingModal}
                onClose={() => setModalRowId(null)}
                onSave={handleModalSave}
            />
        </>
    );
}

export {
    type EditableSpecialRightField,
    ReviewPanelSpecialRightsList,
};
