type ReviewPanelOwnershipCardProps = {
    totalMea: number | null;
    allocatedMea: number;
    propertyType: "WEG" | "MV";
};

function ReviewPanelOwnershipCard({ totalMea, allocatedMea, propertyType }: ReviewPanelOwnershipCardProps){
    if (propertyType === "MV") {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-700">Ownership shares are not required for MV onboarding.</p>
            </div>
        );
    }

    const hasMismatch = totalMea != null && allocatedMea !== totalMea;

    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-900">Total MEA: {totalMea ?? "Not detected"}</p>
            <p className={`mt-1 text-sm ${hasMismatch ? "text-red-700" : "text-emerald-700"}`}>
                Allocated: {allocatedMea} / {totalMea ?? "?"} {hasMismatch ? "Mismatch" : "OK"}
            </p>
        </div>
    );
}

export {
    ReviewPanelOwnershipCard,
};
