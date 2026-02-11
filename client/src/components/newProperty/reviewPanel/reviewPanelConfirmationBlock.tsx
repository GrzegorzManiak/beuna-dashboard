import { Button } from "@/components/ui/button";

type ReviewPanelConfirmationBlockProps = {
    confirmed: boolean;
    isCreating: boolean;
    canCreate: boolean;
    onConfirmedChange: (checked: boolean) => void;
    onBack: () => void;
    onCreate: () => void;
    onDownload: () => void;
};

function ReviewPanelConfirmationBlock({
    confirmed,
    isCreating,
    canCreate,
    onConfirmedChange,
    onBack,
    onCreate,
    onDownload,
}: ReviewPanelConfirmationBlockProps){
    const createDisabled = !confirmed || !canCreate || isCreating;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => onConfirmedChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                I confirm that the extracted property structure matches the legal declaration.
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" onClick={onBack} disabled={isCreating}>
                    Back
                </Button>
                <Button type="button" onClick={onCreate} disabled={createDisabled}>
                    {isCreating ? "Creating..." : "Create Property"}
                </Button>
                <Button type="button" variant="outline" onClick={onDownload} disabled={isCreating}>
                    Download summary
                </Button>
            </div>

            {!canCreate && (
                <p className="mt-2 text-xs font-medium text-red-600">
                    Resolve blocking issues before creating this property.
                </p>
            )}
        </div>
    );
}

export {
    ReviewPanelConfirmationBlock,
};
