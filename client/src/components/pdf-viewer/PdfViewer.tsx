import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { PdfRenderer } from "./PdfRenderer";
import { handleAutoSplit } from "./utils";
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
    textWrapping?: boolean;
    setTextWrapping?: Dispatch<SetStateAction<boolean>>;
}

export interface PdfViewerState {
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    dragMode: boolean;
    textWrapping: boolean;
}

export interface PdfViewerActions {
    setPageMetrics: Dispatch<SetStateAction<Record<number, PageMetrics>>>;
    setActiveSplit: Dispatch<SetStateAction<ActiveSplit>>;
    setSplitToolbarHeight: Dispatch<SetStateAction<number>>;
    setActiveSectionId: (id: string | null) => void;
    setDragMode: Dispatch<SetStateAction<boolean>>;
    setTextWrapping: Dispatch<SetStateAction<boolean>>;
}

export function usePdfViewerState(sections: SectionData[], autoSplitOnSectionClick = true): [PdfViewerState, PdfViewerActions] {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);
    const [textWrapping, setTextWrapping] = useState(false);

    const handleSectionSelect = (id: string | null) => {
        setActiveSectionId(id);
        if (id && autoSplitOnSectionClick) {
            handleAutoSplit(id, sections, pageMetrics, setActiveSplit);
        }
    };

    return [
        { pageMetrics, activeSplit, splitToolbarHeight, activeSectionId, dragMode, textWrapping },
        { setPageMetrics, setActiveSplit, setSplitToolbarHeight, setActiveSectionId: handleSectionSelect, setDragMode, setTextWrapping }
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
    textWrapping,
    setTextWrapping,
}: PdfViewerProps & PdfViewerState & PdfViewerActions) {
    const handleSectionDelete = (sectionId: string) => {
        if (activeSectionId === sectionId) setActiveSectionId(null);
        onSectionDelete?.(sectionId);
    };

    return (
        <div className="flex items-start justify-center relative h-full">
            <div className="relative">
                <div className="absolute right-4 top-4 z-50 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setTextWrapping?.(!textWrapping)}
                        className={`rounded px-3 py-1 text-xs shadow border border-gray-200 transition-colors ${textWrapping ? "bg-blue-600 text-white" : "bg-white/90 text-gray-900"
                            }`}
                    >
                        {textWrapping ? "Wrap Enabled" : "Wrap Disabled"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDragMode?.(!dragMode)}
                        className={`rounded px-3 py-1 text-xs shadow border border-gray-200 transition-colors ${dragMode ? "bg-blue-600 text-white" : "bg-white/90 text-gray-900"
                            }`}
                    >
                        {dragMode ? "Stop Selection" : "Select Text"}
                    </button>
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
                    textWrappingEnabled={textWrapping}
                    onDragSelection={(result) => {
                        console.log("Selected:", result);

                        // Open split toolbar below the selected area
                        if (autoSplitOnSelection) {
                            setActiveSplit({
                                pageNumber: result.page,
                                splitRatio: result.ratios.y + result.ratios.height,
                            });
                        }

                        // Convert DragSelectionResult to SectionData
                        if (onSectionAdd) {
                            const newSection: SectionData = {
                                id: `section-${Date.now()}`, // Or some ID generation logic
                                sectionType: "unknown",
                                state: "identifying",
                                textPosition: {
                                    page: [result.page],
                                    x: result.rect.x,
                                    y: result.rect.y,
                                    width: result.rect.width,
                                    height: result.rect.height,
                                }
                            };
                            onSectionAdd(newSection);
                            setActiveSectionId?.(newSection.id);
                            setDragMode?.(false); // Optionally turn off drag mode after selection

                            if (onSectionUpdate) {
                                // Mock API classification: move from identifying -> unknown
                                window.setTimeout(() => {
                                    onSectionUpdate(newSection.id, {
                                        state: "unknown",
                                    });
                                }, 1200);
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
}
