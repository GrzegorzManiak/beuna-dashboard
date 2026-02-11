import { useRef } from "react";
import { Page } from "react-pdf";
import type { OnRenderSuccess } from "react-pdf/dist/shared/types.js";
import { SectionHighlights } from "./SectionHighlights";
import type { RenderedSection } from "./types";

type PdfPageSliceRendererProps = {
    pageNumber: number;
    pageWidth: number;
    slice: "top" | "bottom";
    height: number;
    offset: number;
    onRenderSuccess?: OnRenderSuccess;
    renderedSections: Array<RenderedSection>;
    activeSectionId: string | null;
    dragMode?: boolean;
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
    dragMode = false,
}: PdfPageSliceRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className="w-full overflow-hidden"
            data-page-number={pageNumber}
            data-slice={slice}
            style={{ height }}
        >
            <div
                ref={containerRef}
                className={`relative border-0 ${dragMode ? 'pointer-events-none select-none' : ''}`}
                style={{ transform: `translateY(-${offset}px)` }}
            >
                <Page
                    width={pageWidth}
                    onRenderSuccess={onRenderSuccess}
                    pageNumber={pageNumber}
                />

                <SectionHighlights
                    sections={renderedSections}
                    activeSectionId={activeSectionId}
                />
            </div>
        </div>
    );
}

export {
    PdfPageSliceRenderer
}