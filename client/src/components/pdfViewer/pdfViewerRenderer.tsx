import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Document, pdfjs } from "react-pdf";
import type { OnDocumentLoadSuccess } from "react-pdf/dist/shared/types.js";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Separator } from "../ui/separator";
import { PAGE_DIVIDER_HEIGHT } from "./pdfViewer.constants";
import { PdfViewerPageRenderer } from "./pdfViewerPageRenderer";
import { PdfViewerSelectionLayer } from "./pdfViewerSelectionLayer";
import { PdfViewerSplitToolbar } from "./pdfViewerSplitToolbar";

import type {
    ActiveSplit,
    DragSelectionResult,
    PageMetrics,
    SectionData,
} from "./pdfViewer.types";
import { calculateSectionStyle } from "./pdfViewer.utils";
import { RENDERABLE_SECTION_TYPES } from "@shared/section-types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

type PdfViewerRendererProps = {
    pdfUrl: string;
    pdfScale: number;
    pageMetrics: Record<number, PageMetrics>;
    setPageMetrics: Dispatch<SetStateAction<Record<number, PageMetrics>>>;
    error?: ReactNode;
    loading?: ReactNode;
    onLoadSuccess?: OnDocumentLoadSuccess;
    sectionData: Array<SectionData>;
    activeSplit: ActiveSplit;
    setActiveSplit: Dispatch<SetStateAction<ActiveSplit>>;
    splitToolbarHeight: number;
    setSplitToolbarHeight: Dispatch<SetStateAction<number>>;
    activeSectionId: string | null;
    onActiveSectionChange?: (sectionId: string | null) => void;
    onSectionUpdate?: (sectionId: string, updates: Partial<SectionData>) => void;
    onSectionDelete?: (sectionId: string) => void;
    propertyType?: "WEG" | "MV";
    dragMode?: boolean;
    onDragSelection?: (result: DragSelectionResult) => void;
};

function PdfViewerRenderer({
    pdfUrl,
    onLoadSuccess,
    sectionData,
    error,
    pdfScale,
    loading,
    pageMetrics,
    setPageMetrics,
    activeSplit,
    setActiveSplit,
    splitToolbarHeight,
    setSplitToolbarHeight,
    activeSectionId,
    onActiveSectionChange,
    onSectionUpdate,
    onSectionDelete,
    propertyType,
    dragMode = false,
    onDragSelection,
}: PdfViewerRendererProps){
    const [numPages, setNumPages] = useState(0);
    const [pageWidth] = useState(960 * pdfScale);
    const [showContent, setShowContent] = useState(false);
    const pageContainerRef = useRef<HTMLDivElement | null>(null);
    const pagesReady = numPages > 0 && Object.keys(pageMetrics).length === numPages;

    const onSplitToolbarRefChange = useCallback(
        (node: HTMLDivElement | null) => {
            if (node) {
                setSplitToolbarHeight(node.getBoundingClientRect().height);
                const resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) setSplitToolbarHeight(entry.contentRect.height);
                });
                
                resizeObserver.observe(node);
                
                return () => {
 resizeObserver.disconnect(); 
};
            } else {
                setSplitToolbarHeight(0);
            }
        },
        [setSplitToolbarHeight],
    );

    const pages = useMemo(() => {
        if (numPages <= 0) return [];
        return Array.from({ length: numPages }, (_, index) => index + 1);
    }, [numPages]);

    const onDocumentLoadSuccess = useCallback(
        (pdf: pdfjs.PDFDocumentProxy) => {
            setNumPages(pdf.numPages);
            setPageMetrics({});
            setShowContent(false);
            onLoadSuccess?.(pdf);
        },
        [onLoadSuccess, setPageMetrics],
    );

    const onPageRenderSuccess = useCallback(
        (page: pdfjs.PDFPageProxy) => {
            const { width, height } = page.getViewport({ scale: 1 });
            setPageMetrics((prev) => {
                if (prev[page.pageNumber]) return prev;
                const updated = {
                    ...prev,
                    [page.pageNumber]: {
                        originalWidth: width,
                        originalHeight: height,
                        scale: pageWidth / width,
                        height: height * (pageWidth / width),
                    },
                };
                return updated;
            });
        },
        [pageWidth],
    );

    const closeSplit = () => setActiveSplit(null);

    useEffect(() => {
        if (!pagesReady) {
            setShowContent(false);
            return;
        }
        const timer = setTimeout(() => setShowContent(true), 150);
        return () => clearTimeout(timer);
    }, [pagesReady]);

    return (
        <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={loading ?? "Loading PDF..."}
            error={error ?? "Failed to load PDF."}
        >
            <div className="relative">
                {!showContent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-600">Loading document...</p>
                        </div>
                    </div>
                )}

                <div 
                    className={`transition-opacity duration-500 ${
                        showContent ? 'opacity-100' : 'opacity-0'
                    }`}
                    ref={pageContainerRef}
                >
                    <div className="flex flex-col">
                    {pages.map((pageNumber) => {
                        const pageCurrentlySplit = activeSplit?.pageNumber === pageNumber;
                        const metrics = pageMetrics[pageNumber];
                        const pageHeight = metrics ? metrics.height : 0;
                        const splitContent = pageCurrentlySplit ? (
                            <PdfViewerSplitToolbar
                                closeSplit={closeSplit}
                                splitToolbarRef={onSplitToolbarRefChange}
                                sections={sectionData}
                                activeSectionId={activeSectionId}
                                onActiveSectionChange={onActiveSectionChange}
                                onSectionUpdate={onSectionUpdate}
                                onSectionDelete={onSectionDelete}
                                propertyType={propertyType}
                                pageNumber={pageNumber}
                            />
                        ) : null;

                        return (
                            <div
                                key={pageNumber}
                                style={{
                                    height:
                                        pageHeight +
                                        PAGE_DIVIDER_HEIGHT +
                                        (pageCurrentlySplit ? splitToolbarHeight : 0),
                                    width: pageWidth,
                                }}
                            >
                                <div style={{ height: PAGE_DIVIDER_HEIGHT }} className="w-full">
                                    <Separator />
                                </div>

                                <PdfViewerPageRenderer
                                    key={pageNumber}
                                    pageWidth={pageWidth}
                                    pageNumber={pageNumber}
                                    onRenderSuccess={onPageRenderSuccess}
                                    pageHeight={pageHeight}
                                    splitRatio={activeSplit?.splitRatio ?? 0}
                                    isActiveSplit={pageCurrentlySplit}
                                    splitComponent={splitContent}
                                    activeSectionId={activeSectionId}
                                    renderedSections={pagesReady ? sectionData
                                        .filter((section) =>
                                            section.textPosition.page.includes(pageNumber) &&
                                            section.sectionType &&
                                            RENDERABLE_SECTION_TYPES.includes(section.sectionType as any),
                                        )
                                        .map((section) =>
                                            calculateSectionStyle(pageNumber, section, pageMetrics),
                                        ) : []}
                                    dragMode={dragMode}
                                />
                            </div>
                        );
                    })}
                </div>
                </div>
                <PdfViewerSelectionLayer
                    enabled={dragMode}
                    pages={pages}
                    pageMetrics={pageMetrics}
                    activeSplit={activeSplit}
                    splitToolbarHeight={splitToolbarHeight}
                    pageContainerRef={pageContainerRef}
                    onSelectionComplete={onDragSelection}
                />
            </div>
        </Document>
    );
}

export {
    PdfViewerRenderer
}
