import type { Ref } from "react";
import type { SectionData } from "./types";

type PdfSplitToolbarProps = {
    closeSplit: () => void;
    splitToolbarRef: Ref<HTMLDivElement>;
    sections: SectionData[];
    activeSectionId: string | null;
    pageNumber: number;
};

function PdfSplitToolbar({
    closeSplit,
    splitToolbarRef,
    sections,
    activeSectionId,
    pageNumber,
}: PdfSplitToolbarProps) {
    const activeSection =
        (activeSectionId ? sections.find((section) => section.id === activeSectionId) : null) ??
        sections[0] ??
        null;

    return (
        <div
            id="pdf-split-toolbar"
            ref={splitToolbarRef}
            className="h-full border-y bg-muted flex items-center px-4 py-6 gap-4 transition-transform"
        >
            <div className="flex flex-col">
                {activeSection?.sectionType ? (
                    <span className="text-[15px] uppercase font-bold tracking-wide text-emerald-600">
                        {activeSection.sectionType}
                    </span>
                ) : null}
                <span className="text-sm font-semibold text-gray-900">
                    {activeSection?.id ?? `Page ${pageNumber}`}
                </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
                <button onClick={() => closeSplit()} className="rounded bg-red-500 px-3 py-1 text-white">
                    Close
                </button>
            </div>
        </div>
    );
}

export {
    PdfSplitToolbar
}
