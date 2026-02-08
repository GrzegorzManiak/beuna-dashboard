import { useState } from "react";
import { PdfRenderer, SectionBar } from ".";
import type { ActiveSplit, PageMetrics, SectionData } from ".";

interface PdfViewerProps {
    pdfUrl: string;
    pdfScale?: number;
    sections: SectionData[];
}

export function PdfViewer({ pdfUrl, pdfScale = 0.7, sections }: PdfViewerProps) {
    const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
    const [activeSplit, setActiveSplit] = useState<ActiveSplit>(null);
    const [splitToolbarHeight, setSplitToolbarHeight] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    return (
        <div className="bg-red-500 flex items-start justify-center">
            <SectionBar
                sectionData={sections}
                pageMetrics={pageMetrics}
                activeSplit={activeSplit}
                splitToolbarHeight={splitToolbarHeight}
                activeSectionId={activeSectionId}
                setActiveSectionId={setActiveSectionId}
            />
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
            />
        </div>
    );
}
