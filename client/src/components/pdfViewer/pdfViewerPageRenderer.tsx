import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { pdfjs } from "react-pdf";
import { PdfViewerPageSliceRenderer } from "./pdfViewerPageSliceRenderer";
import type { RenderedSection } from "./pdfViewer.types";

type PdfViewerPageRendererProps = {
    pageNumber: number;
    pageWidth: number;
    onRenderSuccess: (page: pdfjs.PDFPageProxy) => void;
    renderedSections: Array<RenderedSection>;
    splitComponent: ReactNode;
    isActiveSplit: boolean;
    splitRatio: number;
    pageHeight: number;
    activeSectionId: string | null;
    dragMode?: boolean;
};

function PdfViewerPageRenderer({
    pageNumber,
    onRenderSuccess,
    pageWidth,
    splitComponent,
    splitRatio,
    isActiveSplit,
    pageHeight,
    renderedSections,
    activeSectionId,
    dragMode = false,
}: PdfViewerPageRendererProps) {
    const splitY = isActiveSplit ? Math.round(pageHeight * splitRatio) : 0;
    const pageLoadRef = useRef<boolean | null>(null);

    // We want to call onRenderSuccess only once per page, even
    // though we render the page twice (for top and bottom slices).
    const onPageRenderSuccess = useCallback(
        (page: pdfjs.PDFPageProxy) => {
            if (pageLoadRef.current === null) {
                pageLoadRef.current = false;
                return;
            }

            if (pageLoadRef.current === false) {
                pageLoadRef.current = true;
                onRenderSuccess?.(page);
            }
        },
        [onRenderSuccess],
    );

    return (
        <div className="relative border-x" data-page-number={pageNumber}>
            {/* TOP Page Slice */}
                <PdfViewerPageSliceRenderer
                pageNumber={pageNumber}
                slice="top"
                height={splitY}
                offset={0}
                pageWidth={pageWidth}
                onRenderSuccess={onPageRenderSuccess}
                renderedSections={renderedSections}
                activeSectionId={activeSectionId}
                dragMode={dragMode}
            />

            {/* Split Content */}
            {isActiveSplit && splitComponent}

            {/* BOTTOM Page Slice */}
                <PdfViewerPageSliceRenderer
                pageNumber={pageNumber}
                slice="bottom"
                height={Math.max(0, pageHeight - splitY)}
                offset={splitY}
                pageWidth={pageWidth}
                onRenderSuccess={onPageRenderSuccess}
                renderedSections={renderedSections}
                activeSectionId={activeSectionId}
                dragMode={dragMode}
            />
        </div>
    );
}

export { PdfViewerPageRenderer };