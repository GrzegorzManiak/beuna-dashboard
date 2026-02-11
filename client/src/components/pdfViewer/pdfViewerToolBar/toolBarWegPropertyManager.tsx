import { useState } from "react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Edit2 } from "lucide-react";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";
import { cn } from "@/lib/utils";

function WegPropertyManagerEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps) {
    const [showAddressEdit, setShowAddressEdit] = useState(false);

    const disabled = !onSectionUpdate;
    const managerName = toInputString(getFieldValue(section, "managerName"));
    const addressStreet = toInputString(getFieldValue(section, "addressStreet"));
    const addressHouseNumber = toInputString(getFieldValue(section, "addressHouseNumber"));
    const addressPostalCode = toInputString(getFieldValue(section, "addressPostalCode"));
    const addressCity = toInputString(getFieldValue(section, "addressCity"));
    const addressCountry = toInputString(getFieldValue(section, "addressCountry"));
    const notes = toInputString(getFieldValue(section, "notes"));

    const addressSummary = [
        addressStreet,
        addressHouseNumber,
        addressPostalCode,
        addressCity,
        addressCountry,
    ].filter(Boolean).join(", ") || "No address specified";

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="flex flex-col gap-4">
            {/* Manager name */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Property Manager</h3>
                <div className={cn("flex flex-col gap-1", isMissing("managerName") && "ring-2 ring-amber-400 rounded-md p-1")}>
                    <Label className="text-xs text-gray-600">Manager name</Label>
                    <Input
                        value={managerName}
                        disabled={disabled}
                        onChange={(event) => updateSectionField(section, onSectionUpdate, "managerName", event.target.value)}
                        placeholder="Company or person name"
                    />
                </div>
            </div>

            {/* Address - Collapsed by Default */}
            <div className="space-y-3">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs text-gray-600">Address</Label>
                    {!showAddressEdit ? (
                        <div className="space-y-2">
                            <div className={cn(
                                "rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700",
                                (isMissing("addressStreet") || isMissing("addressHouseNumber") || isMissing("addressPostalCode") || isMissing("addressCity"))
                                    && "ring-2 ring-amber-400",
                            )}>
                                {addressSummary}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddressEdit(true)}
                                    className="text-xs"
                                    disabled={disabled}
                                >
                                    <Edit2 className="h-3 w-3 mr-1" />
                                    Edit address
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 rounded-md border border-gray-200 bg-white p-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-600">Edit Address Details</span>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => setShowAddressEdit(false)}
                                    className="px-10 py-5"
                                >
                                    Done
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className={cn("sm:col-span-2 flex flex-col gap-1", isMissing("addressStreet") && "ring-2 ring-amber-400 rounded-md p-1")}>
                                    <Label className="text-xs text-gray-600">Street</Label>
                                    <Input
                                        value={addressStreet}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressStreet", event.target.value)}
                                        placeholder="e.g., Am Fiktivpark"
                                    />
                                </div>
                                <div className={cn("flex flex-col gap-1", isMissing("addressHouseNumber") && "ring-2 ring-amber-400 rounded-md p-1")}>
                                    <Label className="text-xs text-gray-600">House number</Label>
                                    <Input
                                        value={addressHouseNumber}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressHouseNumber", event.target.value)}
                                        placeholder="e.g., 12"
                                    />
                                </div>
                                <div className={cn("flex flex-col gap-1", isMissing("addressPostalCode") && "ring-2 ring-amber-400 rounded-md p-1")}>
                                    <Label className="text-xs text-gray-600">Postal code</Label>
                                    <Input
                                        value={addressPostalCode}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressPostalCode", event.target.value)}
                                        placeholder="e.g., 10557"
                                    />
                                </div>
                                <div className={cn("flex flex-col gap-1", isMissing("addressCity") && "ring-2 ring-amber-400 rounded-md p-1")}>
                                    <Label className="text-xs text-gray-600">City</Label>
                                    <Input
                                        value={addressCity}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressCity", event.target.value)}
                                        placeholder="e.g., Berlin"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs text-gray-600">Country</Label>
                                    <Input
                                        value={addressCountry}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressCountry", event.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Notes</Label>
                <Input
                    value={notes}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "notes", event.target.value)}
                    placeholder="Optional"
                />
            </div>
        </div>
    );
}

export { WegPropertyManagerEditor };
