import { useEffect, useState } from "react";
import { Checklist, PdfViewer, SectionBar, usePdfViewerState } from "@/components/pdf-viewer";
import type { SectionData } from "@/components/pdf-viewer";
import type { PropertySection } from "@/api/properties";
import { usePropertyDocumentQuery } from "@/api/properties";

type UnitsStepProps = {
    onNext: () => void;
    onBack: () => void;
    propertyId: string;
    sections: PropertySection[];
    propertyType: "WEG" | "MV";
    sectionsProcessing: boolean;
};

export function UnitsStep({
    onNext,
    onBack,
    propertyId,
    sections: incomingSections,
    propertyType,
    sectionsProcessing,
}: UnitsStepProps) {
    const [sections, setSections] = useState<SectionData[]>([]);
    const [viewerState, viewerActions] = usePdfViewerState(sections, true);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const { data: documentBlob, isLoading: isDocumentLoading, isError: isDocumentError, error: documentError } = usePropertyDocumentQuery(propertyId);
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!incomingSections.length) return;
        setSections((prev) => mergeSectionData(prev, mapPropertySections(incomingSections)));
    }, [incomingSections]);

    useEffect(() => {
        if (!documentBlob) return;
        const url = URL.createObjectURL(documentBlob);
        setDocumentUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [documentBlob]);
    useEffect(() => {
        if (isLoaded || !documentUrl) return;
        const hasMetrics = Object.keys(viewerState.pageMetrics).length > 0;
        if (!hasMetrics) return;
        const timer = setTimeout(() => setIsLoaded(true), 300);
        return () => clearTimeout(timer);
    }, [viewerState.pageMetrics, isLoaded, documentUrl]);

    function handleSectionAdd(newSection: SectionData) {
        setSections((prev) => [...prev, newSection]);
    }

    function handleSectionUpdate(sectionId: string, updates: Partial<SectionData>) {
        setSections((prev) =>
            prev.map((section) => (section.id === sectionId ? { ...section, ...updates } : section)),
        );
    }

    function handleSectionDelete(sectionId: string) {
        setSections((prev) => prev.filter((section) => section.id !== sectionId));
    }

    return (
        <div className="flex h-[80vh] relative">
            {sectionsProcessing && (
                <div className="absolute right-4 top-4 z-40 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    Extracting unit and building blocks...
                </div>
            )}
            {(!isLoaded || isDocumentLoading || !documentUrl) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-gray-700">Preparing document...</p>
                    </div>
                </div>
            )}

            <div
                className={`flex w-full h-full transition-opacity duration-700 ${
                    isLoaded ? "opacity-100" : "opacity-0"
                }`}
            >
                <div className="flex-1 overflow-y-scroll">
                    <div className="flex relative">
                        <div className="w-34 shrink-0">
                            <SectionBar
                                sectionData={sections}
                                pageMetrics={viewerState.pageMetrics}
                                activeSplit={viewerState.activeSplit}
                                splitToolbarHeight={viewerState.splitToolbarHeight}
                                activeSectionId={viewerState.activeSectionId}
                                setActiveSectionId={viewerActions.setActiveSectionId}
                            />
                        </div>

                        <div className="flex-1">
                            {isDocumentError && (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm text-red-600">
                                        {documentError?.message ?? "Failed to load document."}
                                    </p>
                                </div>
                            )}
                            {!isDocumentError && documentUrl && (
                                <PdfViewer
                                    pdfUrl={documentUrl}
                                    pdfScale={1}
                                    sections={sections}
                                    propertyType={propertyType}
                                    onSectionAdd={handleSectionAdd}
                                    onSectionUpdate={handleSectionUpdate}
                                    onSectionDelete={handleSectionDelete}
                                    {...viewerState}
                                    {...viewerActions}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-80 shrink-0 overflow-auto ml-4">
                    <Checklist
                        sections={sections}
                        propertyType={propertyType}
                        onSectionClick={viewerActions.setActiveSectionId}
                        onNext={onNext}
                        onBack={onBack}
                    />
                </div>
            </div>
        </div>
    );
}

function mapPropertySections(sections: PropertySection[]): SectionData[] {
    const result: SectionData[] = [];

    // Map container types to their singular item-level equivalents
    const CONTAINER_TO_ITEM_TYPE: Record<string, string> = {
        "core.buildings": "core.building",
        "units.unit_blocks": "units.unit_block",
    };
    
    for (const section of sections) {
        const isArrayContainer = section.items && Array.isArray(section.items) && section.items.length > 0;
        
        if (isArrayContainer) {
            // For array containers (buildings, units), expand items into individual sections
            console.log(`[CLIENT] Expanding ${section.sectionType} with ${section.items!.length} items`);
            const itemType = CONTAINER_TO_ITEM_TYPE[section.sectionType] ?? section.sectionType;
            
            for (let i = 0; i < section.items!.length; i++) {
                const item = section.items![i];
                if (!item) continue;
                
                const itemPositions = item.textPosition || [];
                const pages = itemPositions.map((pos) => pos.page);
                const first = itemPositions[0];
                
                result.push({
                    id: item.id || `${section.id}-item-${i}`,
                    textPosition: first ? {
                        page: pages.length ? pages : [first.page],
                        x: first.x,
                        y: first.y,
                        width: first.width,
                        height: first.height,
                        boxes: itemPositions,
                    } : { page: [], x: 0, y: 0, width: 0, height: 0 },
                    state: item.state || "needs_review",
                    sectionType: itemType as any,
                    reusable: section.reusable,
                    fields: {},
                });
            }
        } else {
            // For single-object sections, map as-is
            const positions = [...(section.textPosition ?? [])].sort((a, b) => a.page - b.page);
            const pages = positions.map((position) => position.page);
            const first = positions[0];
            const state = section.sectionType === "unknown" ? "unknown" : "needs_review";
            
            if (!first) {
                result.push({
                    id: section.id,
                    textPosition: { page: [], x: 0, y: 0, width: 0, height: 0 },
                    state,
                    sectionType: section.sectionType,
                    reusable: section.reusable,
                    fields: {},
                });
            } else {
                result.push({
                    id: section.id,
                    textPosition: {
                        page: pages.length ? pages : [first.page],
                        x: first.x,
                        y: first.y,
                        width: first.width,
                        height: first.height,
                        boxes: positions,
                    },
                    state,
                    sectionType: section.sectionType,
                    reusable: section.reusable,
                    fields: {},
                });
            }
        }
    }
    
    console.log(`[CLIENT] Mapped ${sections.length} sections to ${result.length} display items`);
    return result;
}

function mergeSectionData(existing: SectionData[], incoming: SectionData[]): SectionData[] {
    const map = new Map<string, SectionData>();
    for (const section of existing) map.set(section.id, section);
    for (const section of incoming) map.set(section.id, section);
    return Array.from(map.values());
}
