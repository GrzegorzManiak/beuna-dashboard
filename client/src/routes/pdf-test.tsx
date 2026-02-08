import { useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import type { SectionData } from "@/components/pdf-viewer";

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

export default function PdfTest() {
    const [sections, setSections] = useState<SectionData[]>(mockSections);

    return (
        <div className="h-screen w-full flex flex-col">
            <PdfViewer
                pdfUrl="/test.pdf"
                pdfScale={1}
                sections={sections}
                onSectionAdd={(newSection) => {
                    setSections((prev) => [...prev, newSection]);
                }}
            />
        </div>
    );
}
