import { useEffect, useState } from "react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { getFieldValue, toInputString, toOptionalNumber, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";
import { cn } from "@/lib/utils";

function generateBuildingUuid( ){
    return `building-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function CoreBuildingEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps){
    const [showAddressEdit, setShowAddressEdit] = useState(false);
    const [showAdditional, setShowAdditional] = useState(false);
    
    const disabled = !onSectionUpdate;
    const buildingUuid = toInputString(getFieldValue(section, "buildingUuid"));
    const buildingName = toInputString(getFieldValue(section, "buildingName"));
    const label = toInputString(getFieldValue(section, "label"));
    const addressStreet = toInputString(getFieldValue(section, "addressStreet"));
    const addressHouseNumber = toInputString(getFieldValue(section, "addressHouseNumber"));
    const addressPostalCode = toInputString(getFieldValue(section, "addressPostalCode"));
    const addressCity = toInputString(getFieldValue(section, "addressCity"));
    const addressCountry = toInputString(getFieldValue(section, "addressCountry"));
    const buildYear = toInputString(getFieldValue(section, "buildYear"));
    const floors = toInputString(getFieldValue(section, "floors"));
    const notes = toInputString(getFieldValue(section, "notes"));

    const isMissing = (key: string) => missingFields?.has(key);

    useEffect(() => {
        if (!buildingUuid && onSectionUpdate) {
            updateSectionField(section, onSectionUpdate, "buildingUuid", generateBuildingUuid());
        }
    }, [buildingUuid, section, onSectionUpdate]);

    const addressSummary = [
        addressStreet,
        addressHouseNumber,
        addressPostalCode,
        addressCity,
        addressCountry
    ].filter(Boolean).join(", ") || "No address specified";

    return (
        <div className="flex flex-col gap-4">
            {/* Building Identity - Always Visible */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Building Identity</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className={cn("flex flex-col gap-1", isMissing("buildingName") && "ring-2 ring-amber-400 rounded-md p-1")}>
                        <Label className="text-xs text-gray-600">Building name</Label>
                        <Input
                            value={buildingName}
                            disabled={disabled}
                            onChange={(event) => updateSectionField(section, onSectionUpdate, "buildingName", event.target.value)}
                            placeholder="e.g., Haus A"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-600">Label</Label>
                        <Input
                            value={label}
                            disabled={disabled}
                            onChange={(event) => updateSectionField(section, onSectionUpdate, "label", event.target.value)}
                            placeholder="e.g., Parkside, Cityside"
                        />
                    </div>
                </div>
            </div>

            {/* Address - Collapsed by Default */}
            <div className="space-y-3">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs text-gray-600">Address</Label>
                    {!showAddressEdit ? (
                        <div className="space-y-2">
                            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
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
                                <div className="sm:col-span-2 flex flex-col gap-1">
                                    <Label className="text-xs text-gray-600">Street</Label>
                                    <Input
                                        value={addressStreet}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressStreet", event.target.value)}
                                        placeholder="e.g., Am Fiktivpark"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs text-gray-600">House number</Label>
                                    <Input
                                        value={addressHouseNumber}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressHouseNumber", event.target.value)}
                                        placeholder="e.g., 12"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs text-gray-600">Postal code</Label>
                                    <Input
                                        value={addressPostalCode}
                                        disabled={disabled}
                                        onChange={(event) => updateSectionField(section, onSectionUpdate, "addressPostalCode", event.target.value)}
                                        placeholder="e.g., 10557"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
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

            {/* Additional Details - Collapsed by Default */}
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => setShowAdditional(!showAdditional)}
                    className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                >
                    {showAdditional ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Additional details
                    <span className="text-xs font-normal text-gray-500">(optional)</span>
                </button>
                {showAdditional && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Build year</Label>
                            <Input
                                type="number"
                                value={buildYear}
                                disabled={disabled}
                                onChange={(event) =>
                                    updateSectionField(section, onSectionUpdate, "buildYear", toOptionalNumber(event.target.value))
                                }
                                placeholder="e.g., 1995"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Floors</Label>
                            <Input
                                type="number"
                                value={floors}
                                disabled={disabled}
                                onChange={(event) =>
                                    updateSectionField(section, onSectionUpdate, "floors", toOptionalNumber(event.target.value))
                                }
                                placeholder="e.g., 5"
                            />
                        </div>
                        <div className="sm:col-span-2 flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Notes</Label>
                            <Input
                                value={notes}
                                disabled={disabled}
                                onChange={(event) => updateSectionField(section, onSectionUpdate, "notes", event.target.value)}
                                placeholder="Additional information"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export { CoreBuildingEditor };
