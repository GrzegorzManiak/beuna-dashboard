import { useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import type { SectionData } from "@/components/pdf-viewer";

export const mockSections: SectionData[] = [
    // Simple Single Page Section
    {
        id: "section-1",
        state: "valid",
        sectionType: "core.property_overview",
        fields: {
            propertyName: "Parkside Residences",
            propertyId: "PK-102",
            managementTypeHint: "WEG",
        },
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
        sectionType: "core.address",
        state: "needs_review",
        fields: {
            street: "Kaiserstraße",
            houseNumber: "17A",
            postalCode: "60311",
            city: "Frankfurt",
            country: "DE",
        },
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
        sectionType: "units.unit_block",
        state: "needs_review",
        fields: {
            unitNumber: "06",
            unitType: "office",
            buildingRef: "Haus A",
            floor: "2",
            area: 84.2,
            rooms: "3",
            meaNumerator: 84,
            meaDenominator: 1000,
        },
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
        sectionType: "weg.special_rights_block",
        state: "unknown",
        fields: {
            unitRef: "06",
            rightType: "roof_terrace",
            description: "Exclusive use of roof terrace",
            area: 24,
        },
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
                onSectionUpdate={(sectionId, updates) => {
                    setSections((prev) =>
                        prev.map((section) =>
                            section.id === sectionId ? { ...section, ...updates } : section,
                        ),
                    );
                }}
            />
        </div>
    );
}
