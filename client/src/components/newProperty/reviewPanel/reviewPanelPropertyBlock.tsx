import { Button } from "@/components/ui/button";

type ReviewPanelPropertyBlockProps = {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    onEdit: () => void;
};

function formatAddress(street: string, postalCode: string, city: string ){
    const pieces = [street.trim(), `${postalCode.trim()} ${city.trim()}`.trim()].filter((value) => value.length > 0);
    if (pieces.length === 0) return "Address not set";
    return pieces.join(", ");
}

function ReviewPanelPropertyBlock({
    name,
    street,
    postalCode,
    city,
    onEdit,
}: ReviewPanelPropertyBlockProps){
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Name</p>
                    <p className="text-sm font-semibold text-gray-900">{name.trim() || "Unnamed property"}</p>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Address</p>
                    <p className="text-sm text-gray-700">{formatAddress(street, postalCode, city)}</p>
                </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Edit
            </Button>
        </div>
    );
}

export {
    ReviewPanelPropertyBlock,
};
