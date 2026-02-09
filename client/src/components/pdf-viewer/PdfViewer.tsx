import { useState } from "react";
import { PdfRenderer } from "./PdfRenderer";
import { SectionBar } from "./SectionBar";
import type { ActiveSplit, PageMetrics, SectionData } from "./types";

interface PdfViewerProps {
    pdfUrl: string;
    pdfScale?: number;
    sections: SectionData[];
    onSectionAdd?: (section: SectionData) => void;
    autoSplitOnSelection?: boolean;
    autoSplitOnSectionClick?: boolean;
}

export function PdfViewer({ 
    pdfUrl, 
    pdfScale = 0.7, 
    sections, 
    onSectionAdd,
    autoSplitOnSelection = true,
    autoSplitOnSectionClick = true
}: PdfViewerProps) {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState(false);
    const [textWrapping, setTextWrapping] = useState(false);

    return (
        <div className="bg-red-500 flex items-start justify-center relative">
            <SectionBar
                sectionData={sections}
                pageMetrics={pageMetrics}
                activeSplit={activeSplit}
                splitToolbarHeight={splitToolbarHeight}
                activeSectionId={activeSectionId}
                setActiveSectionId={(id) => {
                    setActiveSectionId(id);
                    if (id && autoSplitOnSectionClick) {
                        const section = sections.find((s) => s.id === id);
                        if (section && section.textPosition.page.length > 0) {
                            const pageNumber = section.textPosition.page[0];
                            const metrics = pageMetrics[pageNumber];
                            if (metrics) {
                                // Calculate split ratio: (y + height) / originalHeight
                                // Note: textPosition is in original PDF coordinates
                                const splitRatio = (section.textPosition.y + section.textPosition.height) / metrics.originalHeight;
                                setActiveSplit({
                                    pageNumber,
                                    splitRatio: Math.min(splitRatio, 1),
                                });

                                // Basic scroll into view logic (optional, for better UX)
                                // Scroll to the split toolbar after a short delay to allow it to render
                                setTimeout(() => {
                                    const splitElement = document.getElementById('pdf-split-toolbar');
                                    if (splitElement) {
                                        splitElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    } else {
                                        // Fallback to scrolling the page into view if split not found
                                        const element = document.querySelector(`[data-page-number="${pageNumber}"]`);
                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }
                                }, 100);
                            }
                        }
                    } else if (id === null) {
                        // Optional: Clear split when deselected? 
                        // For now keeping it simple.
                    }
                }}
            />
            <div className="relative">
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
