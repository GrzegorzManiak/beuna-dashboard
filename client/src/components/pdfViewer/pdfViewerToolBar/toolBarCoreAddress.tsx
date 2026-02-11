import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";
import { cn } from "@/lib/utils";

function CoreAddressEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps){
    const disabled = !onSectionUpdate;
    const street = toInputString(getFieldValue(section, "street"));
    const houseNumber = toInputString(getFieldValue(section, "houseNumber"));
    const postalCode = toInputString(getFieldValue(section, "postalCode"));
    const city = toInputString(getFieldValue(section, "city"));
    const country = toInputString(getFieldValue(section, "country"));

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn("sm:col-span-2 flex flex-col gap-1", isMissing("street") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Street</Label>
                <Input
                    value={street}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "street", event.target.value)}
                />
            </div>
            <div className={cn("flex flex-col gap-1", isMissing("houseNumber") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">House number</Label>
                <Input
                    value={houseNumber}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "houseNumber", event.target.value)}
                />
            </div>
            <div className={cn("flex flex-col gap-1", isMissing("postalCode") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Postal code</Label>
                <Input
                    value={postalCode}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "postalCode", event.target.value)}
                />
            </div>
            <div className={cn("flex flex-col gap-1", isMissing("city") && "ring-2 ring-amber-400 rounded-md p-1")}>
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
