import { cn } from "@/lib/utils";
import type { RenderedSection } from "./types";

type SectionHighlightsProps = {
    sections: Array<RenderedSection>;
    activeSectionId: string | null;
};

function SectionHighlights({ sections, activeSectionId }: SectionHighlightsProps) {
    const getStatusColor = (isActive: boolean, state: string | undefined) => {
        switch (state) {
            case "valid":
                return isActive
                    ? "border-emerald-600 bg-emerald-500/40 z-10"
                    : "border-emerald-500 bg-emerald-500/20";
            case "processing":
                return isActive
                    ? "border-amber-600 bg-amber-500/40 z-10 animate-pulse"
                    : "border-amber-400 bg-amber-400/20 animate-pulse";
            case "unknown":
            default:
                return isActive
                    ? "border-blue-600 bg-blue-600/40 z-10"
                    : "border-blue-500 bg-blue-500/20";
        }
    };

    return (
        <>
            {sections.map((section) => (
                <div
                    key={section.id}
                    className={cn(
                        "absolute border-[0.5px] pointer-events-none transition-colors duration-300 rounded-[3px]",
                        getStatusColor(activeSectionId === section.id, section.state),
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
