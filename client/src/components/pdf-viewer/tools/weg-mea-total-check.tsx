import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./section-editor";
import { cn } from "@/lib/utils";

function WegMeaTotalCheckEditor({ section, onSectionUpdate, missingFields }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const totalMea = toInputString(getFieldValue(section, "totalMea"));

    const isMissing = (key: string) => missingFields?.has(key);

    return (
        <div className="grid gap-3">
            <div className={cn("flex flex-col gap-1", isMissing("totalMea") && "ring-2 ring-amber-400 rounded-md p-1")}>
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
