import { cn } from "@/lib/utils";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { OnDocumentLoadSuccess, OnRenderSuccess } from "react-pdf/dist/shared/types.js";
import { Separator } from "./ui/separator";

const PAGE_DIVIDER_HEIGHT = 15;

type PdfPageSliceRendererProps = {
    pageNumber: number;
    pageWidth: number;
    slice: "top" | "bottom";
    height: number;
    offset: number;
    onRenderSuccess?: OnRenderSuccess;
};
function PdfPageSliceRenderer({
    pageNumber,
    slice,
    height,
    offset,
    pageWidth,
    onRenderSuccess,
}: PdfPageSliceRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    return (<div
        className="w-full overflow-hidden"
        data-page-number={pageNumber}
        data-slice={slice}
        style={{ height }}
    >
        <div
            ref={containerRef}
            className="relative"
            style={{ transform: `translateY(-${offset}px)` }}
        >
            <Page
                width={pageWidth}
                onRenderSuccess={onRenderSuccess}
                pageNumber={pageNumber} />
        </div>
    </div>);
}

type PdfPageRendererProps = {
    pageNumber: number;
    pageWidth: number;
    onRenderSuccess: (page: pdfjs.PDFPageProxy) => void;

    splitComponent: React.ReactNode;
    isActiveSplit: boolean;
    splitRatio: number;
    pageHeight: number;
};
function PdfPageRenderer({
    pageNumber,
    onRenderSuccess,
    pageWidth,
    splitComponent,
    splitRatio,
    isActiveSplit,
    pageHeight,
}: PdfPageRendererProps) {
    const splitY = isActiveSplit ? Math.round(pageHeight * splitRatio) : 0;
    const pageLoadRef = useRef<Boolean | null>(null);

    // We want to call onRenderSuccess only once per page, even 
    // though we render the page twice (for top and bottom slices).
    const onPageRenderSuccess = useCallback((page: pdfjs.PDFPageProxy) => {
        if (pageLoadRef.current === null) {
            pageLoadRef.current = false;
            return;
        }

        if (pageLoadRef.current === false) {
            pageLoadRef.current = true;
            onRenderSuccess?.(page);
        }
    }, [onRenderSuccess]);

    return (<span
        className="relative"
        data-page-number={pageNumber}
    >
        {/* TOP Page Slice */}
        <PdfPageSliceRenderer
            pageNumber={pageNumber}
            slice="top"
            height={splitY}
            offset={0}
            pageWidth={pageWidth}
            onRenderSuccess={onPageRenderSuccess}
        />

        {/* Split Content */}
        {isActiveSplit && splitComponent}

        {/* BOTTOM Page Slice */}
        <PdfPageSliceRenderer
            pageNumber={pageNumber}
            slice="bottom"
            height={Math.max(0, pageHeight - splitY)}
            offset={splitY}
            pageWidth={pageWidth}
            onRenderSuccess={onPageRenderSuccess}
        />
    </span>);
}

type PdfSplitToolbarProps = {
    closeSplit: () => void;
};
function PdfSplitToolbar({
    closeSplit,
}: PdfSplitToolbarProps) {
    return (<div className="pointer-events-auto mx-auto gap-2 w-full bg-white p-5 flex justify-center border border-gray-300">
        <button
            onClick={() => closeSplit()}
            className="rounded bg-red-500 px-3 py-1 text-white">
            Close Split
        </button>
    </div>);
}


type PdfRendererProps = {
    pdfUrl: string;
    pdfScale: number;

    error?: React.ReactNode;
    loading?: React.ReactNode;
    onLoadSuccess?: OnDocumentLoadSuccess;
};
type PageMetrics = {
    originalWidth: number;
    originalHeight: number;
    scale: number;
    height: number;
};
function PdfRenderer({
    pdfUrl,
    onLoadSuccess,
    error,
    pdfScale,
    loading,
}: PdfRendererProps) {
    const [numPages, setNumPages] = useState(0);
    const [activeSplit, setActiveSplit] = useState<{ pageNumber: number; splitRatio: number } | null>(null);
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [pageWidth, setPageWidth] = useState(960 * pdfScale);

    const pages = useMemo(() => {
        if (numPages <= 0) return [];
        return Array.from({ length: numPages }, (_, index) => index + 1);
    }, [numPages]);

    const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        onLoadSuccess?.(pdf);
    }, [onLoadSuccess]);

    const onPageRenderSuccess = useCallback((page: pdfjs.PDFPageProxy) => {
        const { width, height } = page.getViewport({ scale: 1 });
        setPageMetrics((prev) => {
            if (prev[page.pageNumber]) return prev;
            return {
                ...prev,
                [page.pageNumber]: {
                    originalWidth: width, originalHeight: height,
                    scale: pageWidth / width,
                    height: height * (pageWidth / width),
                },
            };
        });
    }, []);

    const closeSplit = () => setActiveSplit(null);

    useEffect(() => {
        setActiveSplit({
            pageNumber: 1,
            splitRatio: 0.5,
        });
    }, []);

    return (<Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={loading ?? "Loading PDF..."}
        error={error ?? "Failed to load PDF."}
    >
        {pages.map((pageNumber) => {
            const pageCurrentlySplit = activeSplit?.pageNumber === pageNumber;
            const metrics = pageMetrics[pageNumber];
            const pageHeight = metrics ? metrics.height : 0;
            const splitContent = pageCurrentlySplit ? <PdfSplitToolbar closeSplit={closeSplit} /> : null;

            return (<div key={pageNumber} style={{
                height: pageHeight + (pageCurrentlySplit ? PAGE_DIVIDER_HEIGHT : 0),
                width: pageWidth,
            }}>
                <PdfPageRenderer
                    key={pageNumber}
                    pageWidth={pageWidth}
                    pageNumber={pageNumber}
                    onRenderSuccess={onPageRenderSuccess}
                    pageHeight={pageHeight}
                    splitRatio={activeSplit?.splitRatio ?? 0}
                    isActiveSplit={pageCurrentlySplit}
                    splitComponent={splitContent}
                />

                {/* Divider between pages, skips last page */}
                {pageNumber < numPages &&
                    <div style={{ height: PAGE_DIVIDER_HEIGHT }} className="w-full">
                        <Separator />
                    </div>
                }
            </div>);
        })}
    </Document>);
}

type SectionBarProps = {
};
function SectionBar({ }: SectionBarProps) {
    return (<div className="w-full grow self-stretch max-w-60 bg-gray-200 flex items-center justify-center">
        <span className="text-sm text-gray-600">Section Bar (placeholder)</span>
    </div>);
}

export function Final() {
    return <>
        <div className="w-full bg-gray-300 flex items-center justify-center">
            <SectionBar />
            <PdfRenderer
                pdfUrl="/test.pdf"
                pdfScale={0.7}
            />
        </div>
    </>;
}
