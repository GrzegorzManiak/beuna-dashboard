import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type ReviewPanelSectionProps = {
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    action?: ReactNode;
    children: ReactNode;
};

function ReviewPanelSection({
    title,
    subtitle,
    defaultOpen = true,
    action,
    children,
}: ReviewPanelSectionProps){
    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    className="flex min-w-0 items-center gap-2 text-left"
                >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
                        {subtitle ? <p className="truncate text-xs text-gray-500">{subtitle}</p> : null}
                    </div>
                </button>
                {action}
            </div>
            {isOpen ? <div className="p-4">{children}</div> : null}
        </div>
    );
}

export {
    ReviewPanelSection,
};
