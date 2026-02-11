import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldOption = {
    label: string;
    value: string;
};

type FieldDefinition = {
    key: string;
    label: string;
    type: "text" | "number" | "select";
    placeholder?: string;
    options?: FieldOption[];
    span?: 1 | 2;
};

type ReviewPanelEditModalProps = {
    open: boolean;
    title: string;
    fields: FieldDefinition[];
    initialValues: Record<string, string>;
    isSaving: boolean;
    onClose: () => void;
    onSave: (values: Record<string, string>) => Promise<void>;
};

function ReviewPanelEditModal({
    open,
    title,
    fields,
    initialValues,
    isSaving,
    onClose,
    onSave,
}: ReviewPanelEditModalProps) {
    const [draft, setDraft] = useState<Record<string, string>>(initialValues);

    useEffect(() => {
        if (!open) return;
        setDraft(initialValues);
    }, [open, initialValues]);

    if (!open) return null;

    function handleChange(key: string, value: string) {
        setDraft((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        const trimmed: Record<string, string> = {};
        for (const [key, value] of Object.entries(draft)) trimmed[key] = value.trim();
        await onSave(trimmed);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>

                <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => (
                        <div key={field.key} className={field.span === 2 ? "sm:col-span-2" : ""}>
                            <Label className="mb-1 block text-xs text-gray-600">{field.label}</Label>
                            {field.type === "select" && field.options ? (
                                <select
                                    value={draft[field.key] ?? ""}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">—</option>
                                    {field.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    type={field.type === "number" ? "number" : "text"}
                                    value={draft[field.key] ?? ""}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export {
    type FieldDefinition,
    type FieldOption,
    ReviewPanelEditModal,
};
