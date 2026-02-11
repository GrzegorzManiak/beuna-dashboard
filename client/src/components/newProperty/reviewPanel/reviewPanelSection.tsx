import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type ReviewPanelSectionProps = {
    id?: string;
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    action?: ReactNode;
    children: ReactNode;
};

function ReviewPanelSection({
    id,
    title,
    subtitle,
    defaultOpen = true,
    action,
    children,
}: ReviewPanelSectionProps){
    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

    return (
        <div id={id} className="scroll-mt-24 rounded-xl border border-emerald-800/40 bg-white">
            <div className={cn(
                "flex items-center justify-between gap-4 border-emerald-800/40 px-4 py-3 bg-emerald-100/50 rounded-t-xl",
                isOpen ? "rounded-b-none border-b" : "rounded-b-xl"
            )}>
                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    className="flex min-w-0 items-center gap-2 text-left"
                >
                    {isOpen ? <ChevronDown className="h-5 w-5 text-emerald-800/40" /> : <ChevronRight className="h-5 w-5 text-emerald-800/40" />}
                    <div className="min-w-0">
                        <p className="truncate text-[1rem] font-semibold text-gray-900">{title}</p>
                        {subtitle ? <p className="truncate text-xs text-gray-500">{subtitle}</p> : null}
                    </div>
                </button>
                {action}
            </div>
            {isOpen ? <div className="p-5">{children}</div> : null}
        </div>
    );
}

export {
    ReviewPanelSection,
};
