import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, toOptionalNumber, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";
import { cn } from "@/lib/utils";

const rightTypeOptions = [
    { label: "Terrace", value: "terrace" },
    { label: "Roof terrace", value: "roof_terrace" },
    { label: "Garden", value: "garden" },
    { label: "Parking access", value: "parking_access" },
    { label: "Mixed", value: "mixed" },
    { label: "Other", value: "other" },
];

function WegSpecialRightsBlockEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const unitRef = toInputString(getFieldValue(section, "unitRef"));
    const rightType = toInputString(getFieldValue(section, "rightType"));
    const description = toInputString(getFieldValue(section, "description"));
    const area = toInputString(getFieldValue(section, "area"));

    const rightTypeItems = rightTypeOptions.map((option) => option.value);
    const labelByValue = new Map(rightTypeOptions.map((option) => [option.value, option.label]));

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn("flex flex-col gap-1", isMissing("unitRef") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Unit reference</Label>
                <Input
                    value={unitRef}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "unitRef", event.target.value)}
                />
            </div>
            <div className={cn("flex flex-col gap-1", isMissing("rightType") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Right type</Label>
                <Combobox
                    items={rightTypeItems}
                    value={rightType || undefined}
                    onValueChange={(nextValue) => updateSectionField(section, onSectionUpdate, "rightType", nextValue ?? "")}
                    itemToStringLabel={(item) => labelByValue.get(String(item)) ?? String(item)}
                    disabled={disabled}
                >
                    <ComboboxInput placeholder="Select right type" className="w-full" />
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
            <div className={cn("sm:col-span-2 flex flex-col gap-1", isMissing("description") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Description</Label>
                <Input
                    value={description}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "description", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Area</Label>
                <Input
                    type="number"
                    value={area}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "area", toOptionalNumber(event.target.value))}
                    placeholder="Optional"
                />
            </div>
        </div>
    );
}

export { WegSpecialRightsBlockEditor };
