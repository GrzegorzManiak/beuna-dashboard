import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";
import { cn } from "@/lib/utils";

function MvOwnerEntityBlockEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const ownerName = toInputString(getFieldValue(section, "ownerName"));
    const ownerType = toInputString(getFieldValue(section, "ownerType"));
    const registrationId = toInputString(getFieldValue(section, "registrationId"));

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn("flex flex-col gap-1", isMissing("ownerName") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Owner name</Label>
                <Input
                    value={ownerName}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "ownerName", event.target.value)}
                />
            </div>
            <div className={cn("flex flex-col gap-1", isMissing("ownerType") && "ring-2 ring-amber-400 rounded-md p-1")}>
                <Label className="text-xs text-gray-600">Owner type</Label>
                <Input
                    value={ownerType}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "ownerType", event.target.value)}
                    placeholder="Company / Individual"
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Registration ID</Label>
                <Input
                    value={registrationId}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "registrationId", event.target.value)}
                    placeholder="Optional"
                />
            </div>
        </div>
    );
}

export { MvOwnerEntityBlockEditor };
