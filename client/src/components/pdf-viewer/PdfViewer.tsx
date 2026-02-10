import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfRenderer } from "./PdfRenderer";
import { handleAutoSplit, normalizeSectionBoxes } from "./utils";
import type { ActiveSplit, PageMetrics, SectionData } from "./types";

interface PdfViewerProps {
    pdfUrl: string;
    pdfScale?: number;
    sections: SectionData[];
    onSectionAdd?: (section: SectionData) => void;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    onSectionDelete?: (sectionId: string) => void;
    propertyType?: "WEG" | "MV";
    autoSplitOnSelection?: boolean;
    autoSplitOnSectionClick?: boolean;
    // State can be provided externally or managed internally
    pageMetrics?: Record<number, PageMetrics>;
    setPageMetrics?: Dispatch<SetStateAction<Record<number, PageMetrics>>>;
    activeSplit?: ActiveSplit;
    setActiveSplit?: Dispatch<SetStateAction<ActiveSplit>>;
    splitToolbarHeight?: number;
    setSplitToolbarHeight?: Dispatch<SetStateAction<number>>;
    activeSectionId?: string | null;
    setActiveSectionId?: (id: string | null) => void;
    dragMode?: boolean;
    setDragMode?: Dispatch<SetStateAction<boolean>>;
}

export interface PdfViewerState {
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    dragMode: boolean;
}

export interface PdfViewerActions {
    setPageMetrics: Dispatch<SetStateAction<Record<number, PageMetrics>>>;
    setActiveSplit: Dispatch<SetStateAction<ActiveSplit>>;
    setSplitToolbarHeight: Dispatch<SetStateAction<number>>;
    setActiveSectionId: (id: string | null) => void;
    setDragMode: Dispatch<SetStateAction<boolean>>;
}

export function usePdfViewerState(sections: SectionData[], autoSplitOnSectionClick = true): [PdfViewerState, PdfViewerActions] {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);

    const handleSectionSelect = (id: string | null) => {
        setActiveSectionId(id);
        if (id && autoSplitOnSectionClick) {
            handleAutoSplit(id, sections, pageMetrics, setActiveSplit);
        }
    };

    return [
        { pageMetrics, activeSplit, splitToolbarHeight, activeSectionId, dragMode },
        { setPageMetrics, setActiveSplit, setSplitToolbarHeight, setActiveSectionId: handleSectionSelect, setDragMode }
    ];
}

export function PdfViewer({
    pdfUrl,
    pdfScale = 0.7,
    sections,
    onSectionAdd,
    onSectionUpdate,
    onSectionDelete,
    propertyType = "WEG",
    autoSplitOnSelection = true,
    pageMetrics,
    setPageMetrics,
    activeSplit,
    setActiveSplit,
    splitToolbarHeight,
    setSplitToolbarHeight,
    activeSectionId,
    setActiveSectionId,
    dragMode,
    setDragMode,
}: PdfViewerProps & PdfViewerState & PdfViewerActions) {
    const handleSectionDelete = (sectionId: string) => {
        if (activeSectionId === sectionId) setActiveSectionId(null);
        onSectionDelete?.(sectionId);
    };

    return (
        <div className="flex items-start justify-center relative h-full">
            <div className="relative">
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    <div className="sticky top-0 p-4 z-50 flex justify-end pointer-events-auto">
                        <Button
                            type="button"
                            onClick={() => setDragMode?.(!dragMode)}
                            variant={dragMode ? "default" : "outline"}
                            className={`flex items-center gap-2 shadow-md ${
                                dragMode 
                                    ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-700" 
                                    : "bg-white/95 backdrop-blur-sm hover:bg-gray-50"
                            }`}
                        >
                            <MousePointerClick className="w-4 h-4" />
                            {dragMode ? "Stop Selecting" : "Select Text"}
                        </Button>
                    </div>
                </div>
                <PdfRenderer
                    pdfUrl={pdfUrl}
                    pdfScale={pdfScale}
                    sectionData={sections}
                    pageMetrics={pageMetrics}
                    setPageMetrics={setPageMetrics}
                    activeSplit={activeSplit}
                    setActiveSplit={setActiveSplit}
                    splitToolbarHeight={splitToolbarHeight}
                    setSplitToolbarHeight={setSplitToolbarHeight}
                    activeSectionId={activeSectionId}
                    onActiveSectionChange={setActiveSectionId}
                    onSectionUpdate={onSectionUpdate}
                    onSectionDelete={handleSectionDelete}
                    propertyType={propertyType}
                    dragMode={dragMode}
                    textWrappingEnabled={true}
                    onDragSelection={(result) => {
                        console.log("Selected:", result);

                        // Convert DragSelectionResult to SectionData
                        if (onSectionAdd) {
                            const pages = result.boxes.map((b) => b.page);
                            const rawSection: SectionData = {
                                id: `section-${Date.now()}`,
                                sectionType: "unknown",
                                state: "identifying",
                                textPosition: {
                                    page: pages,
                                    x: result.boxes[0]?.x ?? 0,
                                    y: result.boxes[0]?.y ?? 0,
                                    width: result.boxes[0]?.width ?? 0,
                                    height: result.boxes.reduce((sum, b) => sum + b.height, 0),
                                    boxes: result.boxes.map((b) => ({
                                        page: b.page,
                                        x: b.x,
                                        y: b.y,
                                        width: b.width,
                                        height: b.height,
                                    })),
                                }
                            };

                            // Pass through THE GATE - normalize multi-page boxes
                            const normalizedSection = normalizeSectionBoxes(rawSection, pageMetrics);

                            onSectionAdd(normalizedSection);
                            setActiveSectionId?.(normalizedSection.id);
                            setDragMode?.(false);

                            if (onSectionUpdate) {
                                window.setTimeout(() => {
                                    onSectionUpdate(normalizedSection.id, {
                                        state: "unknown",
                                    });
                                }, 1200);
                            }

                            // Open split toolbar below the selected area (on the last page)
                            if (autoSplitOnSelection) {
                                const lastPage = pages[pages.length - 1];
                                const box = normalizedSection.textPosition.boxes?.find((b) => b.page === lastPage);
                                if (box) {
                                    const metrics = pageMetrics?.[lastPage];
                                    if (metrics) {
                                        const splitRatio = (box.y + box.height) / metrics.originalHeight;
                                        setActiveSplit({
                                            pageNumber: lastPage,
                                            splitRatio: Math.min(splitRatio, 1),
                                        });
                                    }
                                }
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
}
