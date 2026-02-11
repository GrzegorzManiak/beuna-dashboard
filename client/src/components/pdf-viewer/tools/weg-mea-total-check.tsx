import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./section-editor";

function WegMeaTotalCheckEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const totalMea = toInputString(getFieldValue(section, "totalMea"));

    return (
        <div className="grid gap-3">
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Total MEA</Label>
                <Input
                    type="number"
                    value={totalMea}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "totalMea", event.target.value)}
                    placeholder="e.g. 1000"
                />
            </div>
        </div>
    );
}

export { WegMeaTotalCheckEditor };
