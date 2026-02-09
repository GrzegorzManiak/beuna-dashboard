import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "../../ui/combobox";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./section-editor";

const managementOptions = [
    { label: "Unknown", value: "unknown" },
    { label: "WEG", value: "WEG" },
    { label: "MV", value: "MV" },
];

function CorePropertyOverviewEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const propertyName = toInputString(getFieldValue(section, "propertyName"));
    const propertyId = toInputString(getFieldValue(section, "propertyId"));
    const managementValue = toInputString(getFieldValue(section, "managementTypeHint"));
    const managementItems = managementOptions.map((option) => option.value);
    const labelByValue = new Map(managementOptions.map((option) => [option.value, option.label]));

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Property name</Label>
                <Input
                    value={propertyName}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "propertyName", event.target.value)}
                    placeholder="Property name"
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Internal reference</Label>
                <Input
                    value={propertyId}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "propertyId", event.target.value)}
                    placeholder="Optional"
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Management type</Label>
                <Combobox
                    items={managementItems}
                    value={managementValue || undefined}
                    onValueChange={(nextValue) => updateSectionField(section, onSectionUpdate, "managementTypeHint", nextValue ?? "")}
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
        </div>
    );
}

export { CorePropertyOverviewEditor };
