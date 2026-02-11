import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./sectionEditor";

function WegAdministrationBlockEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const managerName = toInputString(getFieldValue(section, "managerName"));
    const managerAddress = toInputString(getFieldValue(section, "managerAddress"));
    const accountantName = toInputString(getFieldValue(section, "accountantName"));
    const notes = toInputString(getFieldValue(section, "notes"));

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Manager name</Label>
                <Input
                    value={managerName}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "managerName", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Manager address</Label>
                <Input
                    value={managerAddress}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "managerAddress", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Accountant name</Label>
                <Input
                    value={accountantName}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "accountantName", event.target.value)}
                    placeholder="Optional"
                />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
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

export { WegAdministrationBlockEditor };
