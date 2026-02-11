import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReviewPanelAdministrationPerson } from "./reviewPanelTypes";

type ReviewPanelAdministrationDraft = {
    managerName: string;
    managerStreet: string;
    managerHouseNumber: string;
    managerPostalCode: string;
    managerCity: string;
    managerNotes: string;
    accountantName: string;
    accountantStreet: string;
    accountantHouseNumber: string;
    accountantPostalCode: string;
    accountantCity: string;
    accountantNotes: string;
};

type ReviewPanelAdministrationModalProps = {
    open: boolean;
    mode?: "manager" | "accountant";
    isSaving: boolean;
    manager: ReviewPanelAdministrationPerson | null;
    accountant: ReviewPanelAdministrationPerson | null;
    onClose: () => void;
    onSave: (draft: ReviewPanelAdministrationDraft) => Promise<void>;
};

function toInitialDraft(
    manager: ReviewPanelAdministrationPerson | null,
    accountant: ReviewPanelAdministrationPerson | null,
): ReviewPanelAdministrationDraft{
    return {
        managerName: manager?.name ?? "",
        managerStreet: manager?.street ?? "",
        managerHouseNumber: manager?.houseNumber ?? "",
        managerPostalCode: manager?.postalCode ?? "",
        managerCity: manager?.city ?? "",
        managerNotes: manager?.notes ?? "",
        accountantName: accountant?.name ?? "",
        accountantStreet: accountant?.street ?? "",
        accountantHouseNumber: accountant?.houseNumber ?? "",
        accountantPostalCode: accountant?.postalCode ?? "",
        accountantCity: accountant?.city ?? "",
        accountantNotes: accountant?.notes ?? "",
    };
}

function ReviewPanelAdministrationModal({
    open,
    mode,
    isSaving,
    manager,
    accountant,
    onClose,
    onSave,
}: ReviewPanelAdministrationModalProps){
    const [draft, setDraft] = useState<ReviewPanelAdministrationDraft>(() => toInitialDraft(manager, accountant));

    useEffect(() => {
        if (!open) return;
        setDraft(toInitialDraft(manager, accountant));
    }, [accountant, manager, open]);

    if (!open) return null;

    async function handleSave() {
        await onSave({
            managerName: draft.managerName.trim(),
            managerStreet: draft.managerStreet.trim(),
            managerHouseNumber: draft.managerHouseNumber.trim(),
            managerPostalCode: draft.managerPostalCode.trim(),
            managerCity: draft.managerCity.trim(),
            managerNotes: draft.managerNotes.trim(),
            accountantName: draft.accountantName.trim(),
            accountantStreet: draft.accountantStreet.trim(),
            accountantHouseNumber: draft.accountantHouseNumber.trim(),
            accountantPostalCode: draft.accountantPostalCode.trim(),
            accountantCity: draft.accountantCity.trim(),
            accountantNotes: draft.accountantNotes.trim(),
        });
    }

    function handleChange(key: keyof ReviewPanelAdministrationDraft, value: string ){
        setDraft((current) => ({ ...current, [key]: value }));
    }

    const showManager = !mode || mode === "manager";
    const showAccountant = !mode || mode === "accountant";
    const gridCols = showManager && showAccountant ? "md:grid-cols-2" : "md:grid-cols-1 max-w-lg mx-auto";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className={`w-full ${showManager && showAccountant ? "max-w-2xl" : "max-w-lg"} rounded-xl border border-gray-200 bg-white p-5`}>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {mode === "manager" ? "Edit Property Manager" : mode === "accountant" ? "Edit Accountant" : "Edit administration"}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {mode 
                           ? "Update these details before creating the property." 
                           : "Keep manager and accountant details accurate before creating the property."
                        }
                    </p>
                </div>

                <div className={`grid gap-5 ${gridCols}`}>
                    {showManager && (
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-900">Property Manager</p>
                        <div className="space-y-1">
                            <Label htmlFor="review-manager-name">Name</Label>
                            <Input
                                id="review-manager-name"
                                value={draft.managerName}
                                onChange={(event) => handleChange("managerName", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-manager-street">Street</Label>
                            <Input
                                id="review-manager-street"
                                value={draft.managerStreet}
                                onChange={(event) => handleChange("managerStreet", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="review-manager-house">House no.</Label>
                                <Input
                                    id="review-manager-house"
                                    value={draft.managerHouseNumber}
                                    onChange={(event) => handleChange("managerHouseNumber", event.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="review-manager-postal">Postal code</Label>
                                <Input
                                    id="review-manager-postal"
                                    value={draft.managerPostalCode}
                                    onChange={(event) => handleChange("managerPostalCode", event.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-manager-city">City</Label>
                            <Input
                                id="review-manager-city"
                                value={draft.managerCity}
                                onChange={(event) => handleChange("managerCity", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-manager-notes">Notes</Label>
                            <Input
                                id="review-manager-notes"
                                value={draft.managerNotes}
                                onChange={(event) => handleChange("managerNotes", event.target.value)}
                                placeholder="Optional"
                                className="bg-white"
                            />
                        </div>
                    </div>
                    )}

                    {showAccountant && (
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-900">Accountant</p>
                        <div className="space-y-1">
                            <Label htmlFor="review-accountant-name">Name</Label>
                            <Input
                                id="review-accountant-name"
                                value={draft.accountantName}
                                onChange={(event) => handleChange("accountantName", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-accountant-street">Street</Label>
                            <Input
                                id="review-accountant-street"
                                value={draft.accountantStreet}
                                onChange={(event) => handleChange("accountantStreet", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="review-accountant-house">House no.</Label>
                                <Input
                                    id="review-accountant-house"
                                    value={draft.accountantHouseNumber}
                                    onChange={(event) => handleChange("accountantHouseNumber", event.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="review-accountant-postal">Postal code</Label>
                                <Input
                                    id="review-accountant-postal"
                                    value={draft.accountantPostalCode}
                                    onChange={(event) => handleChange("accountantPostalCode", event.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-accountant-city">City</Label>
                            <Input
                                id="review-accountant-city"
                                value={draft.accountantCity}
                                onChange={(event) => handleChange("accountantCity", event.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-accountant-notes">Notes</Label>
                            <Input
                                id="review-accountant-notes"
                                value={draft.accountantNotes}
                                onChange={(event) => handleChange("accountantNotes", event.target.value)}
                                placeholder="Optional"
                                className="bg-white"
                            />
                        </div>
                    </div>
                    )}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export {
    type ReviewPanelAdministrationDraft,
    ReviewPanelAdministrationModal,
};
