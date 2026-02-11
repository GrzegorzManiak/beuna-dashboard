import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";

type ReviewPanelOwnershipCardProps = {
    totalMea: number | null;
    allocatedMea: number;
    propertyType: "WEG" | "MV";
    onEdit?: () => void;
};

function ReviewPanelOwnershipCard({ totalMea, allocatedMea, propertyType, onEdit }: ReviewPanelOwnershipCardProps){
    if (propertyType === "MV") {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-700">Ownership shares are not required for MV onboarding.</p>
            </div>
        );
    }

    const isBalanced = totalMea != null && allocatedMea === totalMea;
    const isMissing = totalMea == null;

    return (
        <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                     <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Voting Structure</h4>
                     {isBalanced ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Balanced
                        </div>
                     ) : (
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {isMissing ? "Declaration missing" : "Unbalanced"}
                        </div>
                     )}
                </div>

                <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                    <div>
                        <p className="text-xs text-gray-500">Total Shares</p>
                        <p className="text-lg font-bold text-gray-900">{totalMea ?? "—"}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Allocated</p>
                        <p className={`text-lg font-bold ${isBalanced ? "text-gray-900" : "text-amber-700"}`}>
                            {allocatedMea} <span className="text-sm font-normal text-gray-500">/ {totalMea ?? "?"}</span>
                        </p>
                    </div>
                </div>
            </div>
            {onEdit && (
                <button
                    type="button"
                    onClick={onEdit}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Edit voting structure"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

export {
    ReviewPanelOwnershipCard,
};
