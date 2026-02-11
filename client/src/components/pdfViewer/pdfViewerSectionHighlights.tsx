import { cn } from "@/lib/utils";
import type { RenderedSection } from "./pdfViewer.types";

type SectionHighlightsProps = {
    sections: Array<RenderedSection>;
    activeSectionId: string | null;
};

function SectionHighlights({ sections, activeSectionId }: SectionHighlightsProps) {
    const getStatusColor = (isActive: boolean, state: string | undefined, isPartial?: boolean) => {
        switch (state) {
            case "valid":
                return isActive
                    ? "border-emerald-600 bg-emerald-500/40 z-10"
                    : "border-emerald-500 bg-emerald-500/20";
            case "needs_review":
                if (isPartial) {
                    return isActive
                        ? "border-amber-600 bg-amber-500/40 z-10 animate-slow-pulse"
                        : "border-amber-500 bg-amber-500/20 animate-slow-pulse";
                }
                return isActive
                    ? "border-amber-600 bg-amber-500/40 z-10 animate-slow-pulse"
                    : "border-amber-500 bg-amber-500/20";
            case "conflict":
                return isActive
                    ? "border-red-600 bg-red-500/40 z-10 animate-slow-pulse"
                    : "border-red-500 bg-red-500/20";
            case "processing":
                return isActive
                    ? "border-sky-600 bg-sky-500/40 z-10 animate-slow-pulse"
                    : "border-sky-500 bg-sky-500/20 animate-slow-pulse";
            case "identifying":
                return isActive
                    ? "border-indigo-600 bg-indigo-500/40 z-10 animate-slow-pulse"
                    : "border-indigo-500 bg-indigo-500/20 animate-slow-pulse";
            case "error":
                return isActive
                    ? "border-red-600 bg-red-500/40 z-10 animate-slow-pulse"
                    : "border-red-500 bg-red-500/20 animate-slow-pulse";
            case "unknown":
            default:
                return isActive
                    ? "border-red-600 bg-red-600/40 z-10 animate-slow-pulse"
                    : "border-red-500 bg-red-500/20";
        }
    };

    return (
        <>
            {sections.map((section) => (
                <div
                    key={section.id}
                    className={cn(
                        "absolute border-[0.5px] pointer-events-none transition-colors duration-300 rounded-[3px]",
                        getStatusColor(activeSectionId === section.id, section.state, section.isPartial),
                        section.hasTopBorder ? "border-t-[0.5px]" : "border-t-0",
                        section.hasBottomBorder ? "border-b-[0.5px]" : "border-b-0",
                    )}
                    style={section.style}
                />
            ))}
        </>
    );
}

export {
    SectionHighlights
}
