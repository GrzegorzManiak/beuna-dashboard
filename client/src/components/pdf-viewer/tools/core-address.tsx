import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./section-editor";

function CoreAddressEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const street = toInputString(getFieldValue(section, "street"));
    const houseNumber = toInputString(getFieldValue(section, "houseNumber"));
    const postalCode = toInputString(getFieldValue(section, "postalCode"));
    const city = toInputString(getFieldValue(section, "city"));
    const country = toInputString(getFieldValue(section, "country"));

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Street</Label>
                <Input
                    value={street}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "street", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">House number</Label>
                <Input
                    value={houseNumber}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "houseNumber", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Postal code</Label>
                <Input
                    value={postalCode}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "postalCode", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">City</Label>
                <Input
                    value={city}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "city", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Country</Label>
                <Input
                    value={country}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "country", event.target.value)}
                    placeholder="Optional"
                />
            </div>
        </div>
    );
}

export { CoreAddressEditor };
