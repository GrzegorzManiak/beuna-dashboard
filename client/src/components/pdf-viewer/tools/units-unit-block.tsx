import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, toOptionalNumber, updateSectionField, type SectionEditorProps } from "./section-editor";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "@/lib/utils";

const unitTypeOptions = [
    { label: "Apartment", value: "apartment" },
    { label: "Office", value: "office" },
    { label: "Parking", value: "parking" },
    { label: "Garden", value: "garden" },
    { label: "Storage", value: "storage" },
    { label: "Other", value: "other" },
];

function UnitsUnitBlockEditor({ section, onSectionUpdate, propertyType = "WEG", availableBuildings, missingFields, totalMeaDenominator }: SectionEditorProps) {
    const [showLocation, setShowLocation] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const disabled = !onSectionUpdate;
    const unitNumber = toInputString(getFieldValue(section, "unitNumber"));
    const unitType = toInputString(getFieldValue(section, "unitType"));
    const buildingRef = toInputString(getFieldValue(section, "buildingRef"));
    const floor = toInputString(getFieldValue(section, "floor"));
    const entrance = toInputString(getFieldValue(section, "entrance"));
    const area = toInputString(getFieldValue(section, "area"));
    const rooms = toInputString(getFieldValue(section, "rooms"));
    const description = toInputString(getFieldValue(section, "description"));
    const meaNumerator = toInputString(getFieldValue(section, "meaNumerator"));
    const meaDenominatorDisplay = totalMeaDenominator != null ? String(totalMeaDenominator) : "1000";

    const unitTypeItems = unitTypeOptions.map((option) => option.value);
    const labelByValue = new Map(unitTypeOptions.map((option) => [option.value, option.label]));

    const buildingUuids = availableBuildings ? Array.from(availableBuildings.keys()) : [];
    const hasBuildingsAvailable = buildingUuids.length > 0;

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="flex flex-col gap-4">
            {/* Basic Info */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Basic Info</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className={cn("flex flex-col gap-1", isMissing("unitNumber") && "ring-2 ring-amber-400 rounded-md p-1")}>
                        <Label className="text-xs text-gray-600">Unit number</Label>
                        <Input
                            value={unitNumber}
                            disabled={disabled}
                            onChange={(event) => updateSectionField(section, onSectionUpdate, "unitNumber", event.target.value)}
                        />
                    </div>
                    <div className={cn("flex flex-col gap-1", isMissing("unitType") && "ring-2 ring-amber-400 rounded-md p-1")}>
                        <Label className="text-xs text-gray-600">Type</Label>
                        <Combobox
                            items={unitTypeItems}
                            value={unitType || undefined}
                            onValueChange={(nextValue) => updateSectionField(section, onSectionUpdate, "unitType", nextValue ?? "")}
                            itemToStringLabel={(item) => labelByValue.get(String(item)) ?? String(item)}
                            disabled={disabled}
                        >
                            <ComboboxInput placeholder="Select type" className="w-full" />
                            <ComboboxContent>
                                <ComboboxEmpty>No items found.</ComboboxEmpty>
                                <ComboboxList>
                                    {(item) => (
                                        <ComboboxItem key={item} value={item}>
                                            {labelByValue.get(item) ?? item}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                    </div>
                    <div className={cn("flex flex-col gap-1", isMissing("buildingRef") && "ring-2 ring-amber-400 rounded-md p-1")}>
                        <Label className="text-xs text-gray-600">Building</Label>
                        {hasBuildingsAvailable ? (
                            <Combobox
                                items={buildingUuids}
                                value={buildingRef || undefined}
                                onValueChange={(nextValue) => updateSectionField(section, onSectionUpdate, "buildingRef", nextValue ?? "")}
                                itemToStringLabel={(uuid) => availableBuildings?.get(String(uuid)) ?? String(uuid)}
                                disabled={disabled}
                            >
                                <ComboboxInput placeholder="Select building" className="w-full" />
                                <ComboboxContent>
                                    <ComboboxEmpty>No buildings found.</ComboboxEmpty>
                                    <ComboboxList>
                                        {(uuid) => (
                                            <ComboboxItem key={uuid} value={uuid}>
                                                {availableBuildings?.get(uuid) ?? uuid}
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                </ComboboxContent>
                            </Combobox>
                        ) : (
                            <Input
                                value={buildingRef}
                                disabled={disabled}
                                onChange={(event) => updateSectionField(section, onSectionUpdate, "buildingRef", event.target.value)}
                                placeholder="No buildings available"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Location (collapsible) */}
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => setShowLocation(!showLocation)}
                    className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                >
                    {showLocation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Location
                    <span className="text-xs font-normal text-gray-500">(optional)</span>
                </button>
                {showLocation && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Floor</Label>
                            <Input
                                value={floor}
                                disabled={disabled}
                                onChange={(event) => updateSectionField(section, onSectionUpdate, "floor", event.target.value)}
                                placeholder="e.g., 2nd floor"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Entrance</Label>
                            <Input
                                value={entrance}
                                disabled={disabled}
                                onChange={(event) => updateSectionField(section, onSectionUpdate, "entrance", event.target.value)}
                                placeholder="e.g., Main entrance"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Size & Ownership */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Size */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Size</h3>
                    <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-gray-600">Area (m²)</Label>
                            <Input
                                type="number"
                                value={area}
                                disabled={disabled}
                                onChange={(event) => updateSectionField(section, onSectionUpdate, "area", toOptionalNumber(event.target.value))}
                                placeholder="e.g., 75.5"
                            />
                        </div>
                        {showAdvanced && (
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs text-gray-600">Rooms</Label>
                                <Input
                                    value={rooms}
                                    disabled={disabled}
                                    onChange={(event) => updateSectionField(section, onSectionUpdate, "rooms", event.target.value)}
                                    placeholder="e.g., 3"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Ownership (WEG only) */}
                {propertyType === "WEG" && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">Ownership (WEG)</h3>
                        <div className={cn("flex flex-col gap-1", isMissing("meaNumerator") && "ring-2 ring-amber-400 rounded-md p-1")}>
                            <Label className="text-xs text-gray-600">MEA (Miteigentumsanteil)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={meaNumerator}
                                    disabled={disabled}
                                    onChange={(event) => updateSectionField(section, onSectionUpdate, "meaNumerator", toOptionalNumber(event.target.value))}
                                    placeholder="125"
                                    className="flex-1"
                                />
                                <span className="text-gray-500">/</span>
                                <Input
                                    type="number"
                                    value={meaDenominatorDisplay}
                                    disabled
                                    className="flex-1 bg-gray-50"
                                    title="Sourced from MEA Declaration total"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced fields toggle */}
            <div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-gray-600 hover:text-gray-900"
                >
                    {showAdvanced ? "Hide" : "Show"} advanced fields
                </Button>
            </div>

            {/* Advanced fields */}
            {showAdvanced && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-600">Description</Label>
                        <Input
                            value={description}
                            disabled={disabled}
                            onChange={(event) => updateSectionField(section, onSectionUpdate, "description", event.target.value)}
                            placeholder="Additional notes"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export { UnitsUnitBlockEditor };
