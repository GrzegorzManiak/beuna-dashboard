import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReviewPanelPropertyDraft } from "./reviewPanelTypes";

type ReviewPanelPropertyModalProps = {
    open: boolean;
    initialData: ReviewPanelPropertyDraft;
    isSaving: boolean;
    onClose: () => void;
    onSave: (next: ReviewPanelPropertyDraft) => Promise<void>;
};

function ReviewPanelPropertyModal({
    open,
    initialData,
    isSaving,
    onClose,
    onSave,
}: ReviewPanelPropertyModalProps){
    const [name, setName] = useState<string>(initialData.name);
    const [street, setStreet] = useState<string>(initialData.street);
    const [postalCode, setPostalCode] = useState<string>(initialData.postalCode);
    const [city, setCity] = useState<string>(initialData.city);

    useEffect(() => {
        if (!open) return;
        setName(initialData.name);
        setStreet(initialData.street);
        setPostalCode(initialData.postalCode);
        setCity(initialData.city);
    }, [initialData.city, initialData.name, initialData.postalCode, initialData.street, open]);

    if (!open) return null;

    async function handleSave( ){
        await onSave({
            name: name.trim(),
            street: street.trim(),
            postalCode: postalCode.trim(),
            city: city.trim(),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Edit property details</h3>
                    <p className="text-sm text-gray-500">Update the core property information before creation.</p>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="review-property-name">Property name</Label>
                        <Input
                            id="review-property-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Property name"
                            className="bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="review-property-street">Street</Label>
                        <Input
                            id="review-property-street"
                            value={street}
                            onChange={(event) => setStreet(event.target.value)}
                            placeholder="Street"
                            className="bg-white"
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="review-property-postal">Postal code</Label>
                            <Input
                                id="review-property-postal"
                                value={postalCode}
                                onChange={(event) => setPostalCode(event.target.value)}
                                placeholder="Postal code"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="review-property-city">City</Label>
                            <Input
                                id="review-property-city"
                                value={city}
                                onChange={(event) => setCity(event.target.value)}
                                placeholder="City"
                                className="bg-white"
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving || name.trim().length === 0}>
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export {
    ReviewPanelPropertyModal,
};
