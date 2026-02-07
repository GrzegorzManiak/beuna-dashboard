import { cn } from "@/lib/utils";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { OnDocumentLoadSuccess, OnRenderSuccess } from "react-pdf/dist/shared/types.js";
import { Separator } from "./ui/separator";

const PAGE_DIVIDER_HEIGHT = 1;
const SIDEBAR_CARD_HEIGHT = 32; // h-8 = 32px
const SIDEBAR_CARD_GAP = 8; // gap-2 approx

// Section stuff START
type SectionPosition = {
    page: Array<number>;
    x: number;
    y: number;
    width: number;
    height: number;
};

type SectionData = {
    id: string;
    textPosition: SectionPosition;
};

const mockSections: SectionData[] = [
    // Simple Single Page Section
    {
        id: "section-1",
        textPosition: {
            page: [1],
            x: 100,
            y: 172,
            width: 200,
            height: 50,
        },
    },
    // Split Area Section (Spans across split)
    {
        id: "section-2",
        textPosition: {
            page: [1],
            x: 100,
            y: 450,
            width: 200,
            height: 50,
        },
    },
    // Multi-Page Section
    {
        id: "section-3",
        textPosition: {
            page: [1, 2],
            x: 300,
            y: 850,
            width: 200,
            height: 500,
        },
    },
    // Triple-Page Section
    {
        id: "section-4",
        textPosition: {
            page: [1, 2, 3],
            x: 550,
            y: 851,
            width: 50,
            height: 1100,
        },
    },
];
// Section stuff END

type RenderedSection = {
    id: string;
    hasTopBorder: boolean;
    hasBottomBorder: boolean;
    style: React.CSSProperties;
};

type SectionHighlightsProps = {
    sections: Array<RenderedSection>;
    activeSectionId: string | null;
};

function SectionHighlights({ sections, activeSectionId }: SectionHighlightsProps) {
    return (
        <>
            {sections.map((section) => (
                <div
                    key={section.id}
                    className={cn(
                        "absolute border-2 pointer-events-none transition-colors duration-300",
                        activeSectionId === section.id
                            ? "border-blue-600 bg-blue-600/40 z-10"
                            : "border-blue-500 bg-blue-500/20",
                        section.hasTopBorder ? "border-t-2" : "border-t-0",
                        section.hasBottomBorder ? "border-b-2" : "border-b-0",
                    )}
                    style={section.style}
                />
            ))}
        </>
    );
}

type PdfPageSliceRendererProps = {
    pageNumber: number;
    pageWidth: number;
    slice: "top" | "bottom";
    height: number;
    offset: number;
    onRenderSuccess?: OnRenderSuccess;
    renderedSections: Array<RenderedSection>;
    activeSectionId: string | null;
};
function PdfPageSliceRenderer({
    pageNumber,
    slice,
    height,
    offset,
    pageWidth,
    onRenderSuccess,
    renderedSections,
    activeSectionId,
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

            <SectionHighlights sections={renderedSections} activeSectionId={activeSectionId} />
        </div>
    </div>);
}

type PdfPageRendererProps = {
    pageNumber: number;
    pageWidth: number;
    onRenderSuccess: (page: pdfjs.PDFPageProxy) => void;
    renderedSections: Array<RenderedSection>;
    splitComponent: React.ReactNode;
    isActiveSplit: boolean;
    splitRatio: number;
    pageHeight: number;
    activeSectionId: string | null;
};
function PdfPageRenderer({
    pageNumber,
    onRenderSuccess,
    pageWidth,
    splitComponent,
    splitRatio,
    isActiveSplit,
    pageHeight,
    renderedSections,
    activeSectionId,
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
            renderedSections={renderedSections}
            activeSectionId={activeSectionId}
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
            renderedSections={renderedSections}
            activeSectionId={activeSectionId}
        />
    </span>);
}

type PdfSplitToolbarProps = {
    closeSplit: () => void;
    splitToolbarRef: React.Ref<HTMLDivElement>;
};
function PdfSplitToolbar({
    closeSplit,
    splitToolbarRef,
}: PdfSplitToolbarProps) {
    return (<div
        ref={splitToolbarRef}
        className="pointer-events-auto mx-auto gap-2 w-full bg-white p-5 flex justify-center border border-gray-300">
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
    pageMetrics: Record<number, PageMetrics>;
    setPageMetrics: React.Dispatch<React.SetStateAction<Record<number, PageMetrics>>>;
    error?: React.ReactNode;
    loading?: React.ReactNode;
    onLoadSuccess?: OnDocumentLoadSuccess;
    sectionData: Array<SectionData>;
    activeSplit: { pageNumber: number; splitRatio: number } | null;
    setActiveSplit: React.Dispatch<React.SetStateAction<{ pageNumber: number; splitRatio: number } | null>>;
    splitToolbarHeight: number;
    setSplitToolbarHeight: React.Dispatch<React.SetStateAction<number>>;
    activeSectionId: string | null;
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
}: PdfRendererProps) {
    const [numPages, setNumPages] = useState(0);
    const [pageWidth, setPageWidth] = useState(960 * pdfScale);

    const onSplitToolbarRefChange = useCallback((node: HTMLDivElement | null) => {
        if (node) setSplitToolbarHeight(node.getBoundingClientRect().height);
        else setSplitToolbarHeight(0);
    }, [setSplitToolbarHeight]);

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
    }, [pageWidth]);

    const closeSplit = () => setActiveSplit(null);

    useEffect(() => {
        // setActiveSplit({
        //     pageNumber: 1,
        //     splitRatio: 0.5,
        // });
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
            const splitContent = pageCurrentlySplit ? <PdfSplitToolbar
                closeSplit={closeSplit}
                splitToolbarRef={onSplitToolbarRefChange} /> : null;

            return (<div key={pageNumber} style={{
                height: pageHeight + PAGE_DIVIDER_HEIGHT + (pageCurrentlySplit ? splitToolbarHeight : 0),
                width: pageWidth,
            }}>
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
                        .filter((section) => section.textPosition.page.includes(pageNumber))
                        .map((section) => calculateSectionStyle(pageNumber, section, pageMetrics))
                    }
                />
            </div>);
        })}
    </Document>);
}

type SectionBarProps = {
    sectionData: Array<SectionData>;
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: { pageNumber: number; splitRatio: number } | null;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    setActiveSectionId: (id: string | null) => void;
};
function SectionBar({
    sectionData,
    pageMetrics,
    activeSplit,
    splitToolbarHeight,
    activeSectionId,
    setActiveSectionId,
}: SectionBarProps) {
    const sidebarItems = useMemo(() => {
        const items = sectionData.map((section) => {
            const pageNumber = section.textPosition.page[0];
            const metrics = pageMetrics[pageNumber];

            // Calculate accumulating Y offset
            let rawY = 0;
            for (let i = 1; i < pageNumber; i++) {
                const m = pageMetrics[i];
                if (m) {
                    rawY += m.height;
                    rawY += PAGE_DIVIDER_HEIGHT;

                    // Add split toolbar height if this page was split
                    if (activeSplit?.pageNumber === i) {
                        rawY += splitToolbarHeight;
                    }
                }
            }

            let visualY = rawY + PAGE_DIVIDER_HEIGHT;

            if (metrics) {
                const scaledY = section.textPosition.y * metrics.scale;
                visualY += scaledY;

                if (activeSplit?.pageNumber === pageNumber) {
                    const splitY = metrics.height * activeSplit.splitRatio;
                    if (scaledY > splitY) {
                        visualY += splitToolbarHeight;
                    }
                }
            }

            return {
                ...section,
                targetTop: visualY,
                top: visualY,
            };
        }).sort((a, b) => a.targetTop - b.targetTop);

        const activeIndex = activeSectionId ? items.findIndex((item) => item.id === activeSectionId) : -1;

        if (activeIndex >= 0) {
            items[activeIndex].top = items[activeIndex].targetTop;

            // Push items above upwards
            for (let i = activeIndex - 1; i >= 0; i -= 1) {
                const nextTop = items[i + 1].top;
                const maxTop = nextTop - SIDEBAR_CARD_HEIGHT - SIDEBAR_CARD_GAP;
                items[i].top = Math.min(items[i].targetTop, maxTop); // Use targetTop as max? No, used math.min in ref
                // Ref: items[i].top = Math.min(items[i].top, maxTop); which assumes items[i].top was initialized to targetTop
                if (items[i].top > maxTop) items[i].top = maxTop;
            }

            // Push items below downwards
            for (let i = activeIndex + 1; i < items.length; i += 1) {
                const prevTop = items[i - 1].top;
                const minTop = prevTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
                if (items[i].top < minTop) items[i].top = minTop;
            }
        } else {
            let lastTop = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const minTop = lastTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
                if (item.top < minTop) {
                    item.top = minTop;
                }
                lastTop = item.top;
            }
        }

        return items;
    }, [sectionData, pageMetrics, activeSplit, splitToolbarHeight, activeSectionId]);

    return (<div className="relative w-full grow self-stretch max-w-60 bg-gray-200 flex flex-col items-start justify-start px-4">
        {sidebarItems.map((section) => {
            const isSelected = section.id === activeSectionId;
            return (
                <div
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    className={cn(
                        "border border-blue-500 rounded absolute h-8 w-30 cursor-pointer transition-all duration-300",
                        isSelected ? "bg-blue-500/40 z-10 scale-105" : "bg-blue-500/20 hover:bg-blue-500/30"
                    )}
                    style={{ top: section.top }}
                >
                    <span className="text-xs p-1">{section.id}</span>
                </div>
            );
        })}
    </div>);
};

export function Final() {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<{ pageNumber: number; splitRatio: number } | null>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    return <>
        <div className="w-full bg-gray-300 flex items-start justify-center">
            <SectionBar
                sectionData={mockSections}
                pageMetrics={pageMetrics}
                activeSplit={activeSplit}
                splitToolbarHeight={splitToolbarHeight}
                activeSectionId={activeSectionId}
                setActiveSectionId={setActiveSectionId}
            />
            <PdfRenderer
                pdfUrl="/test.pdf"
                pdfScale={0.7}
                sectionData={mockSections}
                pageMetrics={pageMetrics}
                setPageMetrics={setPageMetrics}
                activeSplit={activeSplit}
                setActiveSplit={setActiveSplit}
                splitToolbarHeight={splitToolbarHeight}
                setSplitToolbarHeight={setSplitToolbarHeight}
                activeSectionId={activeSectionId}
            />
        </div>
    </>;
}

function calculateSectionStyle(
    pageNumber: number,
    section: SectionData,
    pageMetrics: Record<number, PageMetrics>
): RenderedSection {
    const startPage = section.textPosition.page[0];
    const sectionRect = {
        left: section.textPosition.x,
        width: section.textPosition.width,
        top: 0,
        height: 0,
        hasTopBorder: pageNumber === startPage,
        hasBottomBorder: pageNumber === section.textPosition.page[section.textPosition.page.length - 1],
    };

    // Logic to calculate top/height for multi-page spanning
    if (pageNumber === startPage) {
        sectionRect.top = section.textPosition.y;

        // Simple case: height is rest of section
        // For multi-page, on the first page, we take all the height 
        // until the bottom of the page.
        const pageHeight = pageMetrics[pageNumber]?.height || 0;
        const availableHeight = Math.max(0, pageHeight - section.textPosition.y);

        // If height is small enough to fit on page, use it.
        // Otherwise take available space.
        sectionRect.height = Math.min(section.textPosition.height, availableHeight);
    } else {
        // Subsequent pages
        sectionRect.top = 0; // Starts at top

        let remainingHeight = section.textPosition.height;

        // Subtract height consumed by previous pages
        let currentPage = startPage;
        while (currentPage < pageNumber) {
            const m = pageMetrics[currentPage];
            if (m) {
                if (currentPage === startPage) {
                    const consumed = Math.max(0, m.height - section.textPosition.y);
                    remainingHeight -= consumed;
                }
                else remainingHeight -= m.height;
            }
            currentPage++;
        }

        // On this page, we take remaining height or full page height
        const pageHeight = pageMetrics[pageNumber]?.height || 0;
        sectionRect.height = Math.min(Math.max(0, remainingHeight), pageHeight);

        // If remaining height is <= 0 (metrics might be missing or logic off), hide it
        if (remainingHeight <= 0) sectionRect.height = 0;
    }

    return {
        id: section.id,
        hasTopBorder: sectionRect.hasTopBorder,
        hasBottomBorder: sectionRect.hasBottomBorder,
        style: {
            left: sectionRect.left,
            top: sectionRect.top,
            width: sectionRect.width,
            height: sectionRect.height,
        },
    };
}