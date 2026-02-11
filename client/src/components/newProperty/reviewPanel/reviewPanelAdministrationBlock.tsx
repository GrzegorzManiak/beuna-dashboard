import { Pencil } from "lucide-react";
import type { ReviewPanelAdministrationPerson } from "./reviewPanelTypes";

type ReviewPanelAdministrationBlockProps = {
    manager: ReviewPanelAdministrationPerson | null;
    accountant: ReviewPanelAdministrationPerson | null;
    onEditManager: () => void;
    onEditAccountant: () => void;
};

function toAddressLine(person: ReviewPanelAdministrationPerson | null ){
    if (!person) return "Not detected";
    const streetLine = [person.street.trim(), person.houseNumber.trim()].filter(Boolean).join(" ").trim();
    const cityLine = [person.postalCode.trim(), person.city.trim()].filter(Boolean).join(" ").trim();
    const parts = [streetLine, cityLine].filter((part) => part.length > 0);
    return parts.length > 0 ? parts.join(", ") : "Address not set";
}

function ReviewPanelAdministrationBlock({ manager, accountant, onEditManager, onEditAccountant }: ReviewPanelAdministrationBlockProps){
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Property Manager</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{manager?.name || "Not detected"}</p>
                    <p className="mt-1 text-sm text-gray-600">{toAddressLine(manager)}</p>
                </div>
                <button
                    type="button"
                    onClick={onEditManager}
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Edit property manager"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Accountant</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{accountant?.name || "Not detected"}</p>
                    <p className="mt-1 text-sm text-gray-600">{toAddressLine(accountant)}</p>
                </div>
                <button
                    type="button"
                    onClick={onEditAccountant}
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Edit accountant"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export {
    ReviewPanelAdministrationBlock,
};
