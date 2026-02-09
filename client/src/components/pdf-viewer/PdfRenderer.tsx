import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Document, pdfjs } from "react-pdf";
import type { OnDocumentLoadSuccess } from "react-pdf/dist/shared/types.js";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Separator } from "../ui/separator";
import { PAGE_DIVIDER_HEIGHT } from "./constants";
import { PdfDragSelectionLayer } from "./PdfDragSelectionLayer";
import { PdfPageRenderer } from "./PdfPageRenderer";
import { PdfSplitToolbar } from "./PdfSplitToolbar";
import type {
    ActiveSplit,
    DragSelectionResult,
    PageMetrics,
    SectionData,
} from "./types";
import { calculateSectionStyle } from "./utils";

// Setup PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

type PdfRendererProps = {
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
    textWrappingEnabled?: boolean;
    onDragSelection?: (result: DragSelectionResult) => void;
};

function PdfRenderer({
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
    textWrappingEnabled,
    onDragSelection,
}: PdfRendererProps) {
    const [numPages, setNumPages] = useState(0);
    const [pageWidth] = useState(960 * pdfScale);
    const pageContainerRef = useRef<HTMLDivElement | null>(null);

    const onSplitToolbarRefChange = useCallback(
        (node: HTMLDivElement | null) => {
            if (node) setSplitToolbarHeight(node.getBoundingClientRect().height);
            else setSplitToolbarHeight(0);
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
            onLoadSuccess?.(pdf);
        },
        [onLoadSuccess],
    );

    const onPageRenderSuccess = useCallback(
        (page: pdfjs.PDFPageProxy) => {
            const { width, height } = page.getViewport({ scale: 1 });
            setPageMetrics((prev) => {
                if (prev[page.pageNumber]) return prev;
                return {
                    ...prev,
                    [page.pageNumber]: {
                        originalWidth: width,
                        originalHeight: height,
                        scale: pageWidth / width,
                        height: height * (pageWidth / width),
                    },
                };
            });
        },
        [pageWidth],
    );

    const closeSplit = () => setActiveSplit(null);

    useEffect(() => {
        // setActiveSplit({
        //     pageNumber: 1,
        //     splitRatio: 0.5,
        // });
    }, []);

    return (
        <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={loading ?? "Loading PDF..."}
            error={error ?? "Failed to load PDF."}
        >
            <div className="relative">
                <div ref={pageContainerRef} className="flex w-full flex-col">
                    {pages.map((pageNumber) => {
                        const pageCurrentlySplit = activeSplit?.pageNumber === pageNumber;
                        const metrics = pageMetrics[pageNumber];
                        const pageHeight = metrics ? metrics.height : 0;
                        const splitContent = pageCurrentlySplit ? (
                            <PdfSplitToolbar
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

                                <PdfPageRenderer
                                    key={pageNumber}
                                    pageWidth={pageWidth}
                                    pageNumber={pageNumber}
                                    onRenderSuccess={onPageRenderSuccess}
                                    pageHeight={pageHeight}
                                    splitRatio={activeSplit?.splitRatio ?? 0}
                                    isActiveSplit={pageCurrentlySplit}
                                    splitComponent={splitContent}
                                    activeSectionId={activeSectionId}
                                    renderedSections={sectionData
                                        .filter((section) =>
                                            section.textPosition.page.includes(pageNumber),
                                        )
                                        .map((section) =>
                                            calculateSectionStyle(pageNumber, section, pageMetrics),
                                        )}
                                />
                            </div>
                        );
                    })}
                </div>
                <PdfDragSelectionLayer
                    enabled={dragMode}
                    textWrappingEnabled={textWrappingEnabled}
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
    PdfRenderer
}
