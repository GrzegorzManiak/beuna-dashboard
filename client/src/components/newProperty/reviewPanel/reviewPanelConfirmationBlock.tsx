import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Check } from "lucide-react";

type ReviewPanelConfirmationBlockProps = {
    confirmed: boolean;
    isCreating: boolean;
    canCreate: boolean;
    onConfirmedChange: (checked: boolean) => void;
    onBack: () => void;
    onCreate: () => void;
};

function ReviewPanelConfirmationBlock({
    confirmed,
    isCreating,
    canCreate,
    onConfirmedChange,
    onBack,
    onCreate,
}: ReviewPanelConfirmationBlockProps){
    if (!canCreate) {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                    <div>
                        <p className="text-sm font-semibold text-red-900">Resolve Blocking Issues</p>
                        <p className="mt-1 text-sm text-red-800 opacity-90">
                            There are critical inconsistencies in the property structure. Please fix the issues highlighted above before proceeding.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" onClick={onBack} disabled={isCreating}>
                        Back
                    </Button>
                    <Button disabled type="button" variant="secondary" className="bg-gray-100 text-gray-400">
                        Create Property
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div
                onClick={() => onConfirmedChange(!confirmed)}
                className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                    confirmed
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/10"
                }`}
            >
                <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        confirmed
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-gray-300 bg-white text-transparent group-hover:border-emerald-400"
                    }`}
                >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </div>
                <div>
                     <p className={`text-sm font-medium ${confirmed ? "text-emerald-900" : "text-gray-900"}`}>
                        I confirm that the extracted property structure matches the legal declaration.
                     </p>
                     <p className="mt-1 text-xs text-gray-500">
                        Once created, the core structure (buildings and units) becomes the foundation for this property.
                     </p>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                <Button 
                className="py-6 px-5"
                type="button" variant="outline" onClick={onBack} disabled={isCreating}>
                    Back
                </Button>
                <div className="flex grow gap-3">
                     <Button
                        type="button"
                        onClick={onCreate}
                        disabled={!confirmed || isCreating}
                        className={cn(confirmed ? "bg-emerald-600 hover:bg-emerald-700 hover:ring-2 hover:ring-emerald-600/20" : "", " w-full p-5 py-6")}
                    >
                        {isCreating ? "Creating..." : "Create Property"}
                     </Button>
                </div>
            </div>
        </div>
    );
}

export { ReviewPanelConfirmationBlock };

