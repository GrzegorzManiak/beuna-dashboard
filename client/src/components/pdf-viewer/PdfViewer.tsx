import { useState } from "react";
import { PdfRenderer } from "./PdfRenderer";
import { SectionBar } from "./SectionBar";
import { handleAutoSplit } from "./utils";
import type { ActiveSplit, PageMetrics, SectionData } from "./types";

interface PdfViewerProps {
    pdfUrl: string;
    pdfScale?: number;
    sections: SectionData[];
    onSectionAdd?: (section: SectionData) => void;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    autoSplitOnSelection?: boolean;
    autoSplitOnSectionClick?: boolean;
}

export function PdfViewer({ 
    pdfUrl, 
    pdfScale = 0.7, 
    sections, 
    onSectionAdd,
    onSectionUpdate,
    autoSplitOnSelection = true,
    autoSplitOnSectionClick = true,
}: PdfViewerProps) {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);
    const [textWrapping, setTextWrapping] = useState(false);

    return (
        <div className="flex items-start justify-center relative h-full ">
            <SectionBar
                sectionData={sections}
                pageMetrics={pageMetrics}
                activeSplit={activeSplit}
                splitToolbarHeight={splitToolbarHeight}
                activeSectionId={activeSectionId}
                setActiveSectionId={(id) => {
                    setActiveSectionId(id);
                    if (id && autoSplitOnSectionClick) 
                        handleAutoSplit(id, sections, pageMetrics, setActiveSplit);
                    else if (id === null) {}
                }}
            />
            <div className="relative ">
                <div className="absolute right-4 top-4 z-50 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setTextWrapping((prev) => !prev)}
                        className={`rounded px-3 py-1 text-xs shadow border border-gray-200 transition-colors ${
                            textWrapping ? "bg-blue-600 text-white" : "bg-white/90 text-gray-900"
                        }`}
                    >
                        {textWrapping ? "Wrap Enabled" : "Wrap Disabled"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDragMode((prev) => !prev)}
                        className={`rounded px-3 py-1 text-xs shadow border border-gray-200 transition-colors ${
                            dragMode ? "bg-blue-600 text-white" : "bg-white/90 text-gray-900"
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
                                sectionType: "identifying",
                                state: "processing",
                                textPosition: {
                                    page: [result.page],
                                    x: result.rect.x,
                                    y: result.rect.y,
                                    width: result.rect.width,
                                    height: result.rect.height,
                                }
                            };
                            onSectionAdd(newSection);
                            setActiveSectionId(newSection.id);
                            setDragMode(false); // Optionally turn off drag mode after selection

                            if (onSectionUpdate) {
                                // Mock API classification: move from identifying -> unknown
                                window.setTimeout(() => {
                                    onSectionUpdate(newSection.id, {
                                        sectionType: "unknown",
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
