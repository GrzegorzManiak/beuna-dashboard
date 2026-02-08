import { cn } from "@/lib/utils";
import type { RenderedSection } from "./types";

type SectionHighlightsProps = {
    sections: Array<RenderedSection>;
    activeSectionId: string | null;
};

function SectionHighlights({ sections, activeSectionId }: SectionHighlightsProps) {
    return (
        <>
            {sections.map((section) => (
                <div
                    key={section.id}
                    className={cn(
                        "absolute border-2 pointer-events-none transition-colors duration-300",
                        activeSectionId === section.id
                            ? "border-blue-600 bg-blue-600/40 z-10"
                            : "border-blue-500 bg-blue-500/20",
                        section.hasTopBorder ? "border-t-2" : "border-t-0",
                        section.hasBottomBorder ? "border-b-2" : "border-b-0",
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