import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./section-editor";

function MvOwnerEntityBlockEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const ownerName = toInputString(getFieldValue(section, "ownerName"));
    const ownerType = toInputString(getFieldValue(section, "ownerType"));
    const registrationId = toInputString(getFieldValue(section, "registrationId"));

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Owner name</Label>
                <Input
                    value={ownerName}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "ownerName", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
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
