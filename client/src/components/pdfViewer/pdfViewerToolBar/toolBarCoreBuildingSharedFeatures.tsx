import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { getFieldValue, toInputString, updateSectionField, type SectionEditorProps } from "./toolBar.utils.ts";

function CoreBuildingSharedFeaturesEditor({ section, onSectionUpdate }: SectionEditorProps) {
    const disabled = !onSectionUpdate;
    const hasGarage = Boolean(getFieldValue(section, "hasGarage"));
    const heatingType = toInputString(getFieldValue(section, "heatingType"));
    const energyStandard = toInputString(getFieldValue(section, "energyStandard"));
    const notes = toInputString(getFieldValue(section, "notes"));

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-gray-600">Has garage</Label>
                <Button
                    type="button"
                    size="xs"
                    variant={hasGarage ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => updateSectionField(section, onSectionUpdate, "hasGarage", !hasGarage)}
                    className="text-[11px]"
                >
                    {hasGarage ? "Yes" : "No"}
                </Button>
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Heating type</Label>
                <Input
                    value={heatingType}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "heatingType", event.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-600">Energy standard</Label>
                <Input
                    value={energyStandard}
                    disabled={disabled}
                    onChange={(event) => updateSectionField(section, onSectionUpdate, "energyStandard", event.target.value)}
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

export { CoreBuildingSharedFeaturesEditor };
