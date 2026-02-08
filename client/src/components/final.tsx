import { PdfViewer } from "./pdf-viewer/PdfViewer";
import type { SectionData } from "./pdf-viewer";

export function Final() {
    return (
        <PdfViewer
            pdfUrl="/test.pdf"
            pdfScale={0.7}
            sections={mockSections}
        />
    );
}
