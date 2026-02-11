import { Button } from "@/components/ui/button";
import type { ReviewPanelAdministrationPerson } from "./reviewPanelTypes";

type ReviewPanelAdministrationBlockProps = {
    manager: ReviewPanelAdministrationPerson | null;
    accountant: ReviewPanelAdministrationPerson | null;
    onEdit: () => void;
};

function toAddressLine(person: ReviewPanelAdministrationPerson | null ){
    if (!person) return "Not detected";
    const streetLine = [person.street.trim(), person.houseNumber.trim()].filter(Boolean).join(" ").trim();
    const cityLine = [person.postalCode.trim(), person.city.trim()].filter(Boolean).join(" ").trim();
    const parts = [streetLine, cityLine].filter((part) => part.length > 0);
    return parts.length > 0 ? parts.join(", ") : "Address not set";
}

function ReviewPanelAdministrationBlock({ manager, accountant, onEdit }: ReviewPanelAdministrationBlockProps){
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Property Manager</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{manager?.name || "Not detected"}</p>
                    <p className="mt-1 text-sm text-gray-600">{toAddressLine(manager)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Accountant</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{accountant?.name || "Not detected"}</p>
                    <p className="mt-1 text-sm text-gray-600">{toAddressLine(accountant)}</p>
                </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Edit
            </Button>
        </div>
    );
}

export {
    ReviewPanelAdministrationBlock,
};
