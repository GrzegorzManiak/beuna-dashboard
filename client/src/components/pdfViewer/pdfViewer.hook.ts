import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { handleAutoSplit } from "./pdfViewer.utils";
import type { ActiveSplit, PageMetrics, SectionData } from "./pdfViewer.types";

interface PdfViewerState {
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    dragMode: boolean;
}

interface PdfViewerActions {
    setPageMetrics: Dispatch<SetStateAction<Record<number, PageMetrics>>>;
    setActiveSplit: Dispatch<SetStateAction<ActiveSplit>>;
    setSplitToolbarHeight: Dispatch<SetStateAction<number>>;
    setActiveSectionId: (id: string | null) => void;
    setDragMode: Dispatch<SetStateAction<boolean>>;
}

function usePdfViewerState(sections: SectionData[], autoSplitOnSectionClick = true): [PdfViewerState, PdfViewerActions] {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);

    const handleSectionSelect = (id: string | null): void => {
        setActiveSectionId(id);
        if (id && autoSplitOnSectionClick) handleAutoSplit(id, sections, pageMetrics, setActiveSplit);
    };

    return [
        { pageMetrics, activeSplit, splitToolbarHeight, activeSectionId, dragMode },
        { setPageMetrics, setActiveSplit, setSplitToolbarHeight, setActiveSectionId: handleSectionSelect, setDragMode }
    ];
}

export {
    type PdfViewerActions,
    type PdfViewerState,
    usePdfViewerState,
};
