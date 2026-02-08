import { useState } from "react";
import { PdfRenderer } from "./PdfRenderer";
import { SectionBar } from "./SectionBar";
import type { ActiveSplit, PageMetrics, SectionData } from "./types";

interface PdfViewerProps {
    pdfUrl: string;
    pdfScale?: number;
    sections: SectionData[];
    onSectionAdd?: (section: SectionData) => void;
}

export function PdfViewer({ pdfUrl, pdfScale = 0.7, sections, onSectionAdd }: PdfViewerProps) {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);

    return (
        <div className="bg-red-500 flex items-start justify-center relative">
            <SectionBar
                sectionData={sections}
                pageMetrics={pageMetrics}
                activeSplit={activeSplit}
                splitToolbarHeight={splitToolbarHeight}
                activeSectionId={activeSectionId}
                setActiveSectionId={setActiveSectionId}
            />
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setDragMode((prev) => !prev)}
                    className="absolute right-4 top-4 z-50 rounded bg-white/90 px-3 py-1 text-xs text-gray-900 shadow border border-gray-200"
                >
                    {dragMode ? "Stop Selection" : "Select Text"}
                </button>
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
                    onDragSelection={(result) => {
                        console.log("Selected:", result);
                        
                        // Convert DragSelectionResult to SectionData
                        if (onSectionAdd) {
                            const newSection: SectionData = {
                                id: `section-${Date.now()}`, // Or some ID generation logic
                                textPosition: {
                                    page: [result.page],
                                    x: result.rect.x,
                                    y: result.rect.y,
                                    width: result.rect.width,
                                    height: result.rect.height,
                                }
                            };
                            onSectionAdd(newSection);
                            setDragMode(false); // Optionally turn off drag mode after selection
                        }
                    }}
                />
            </div>
        </div>
    );
}
