import { useEffect, useState } from "react";
import { Checklist, PdfViewer, SectionBar, usePdfViewerState } from "@/components/pdf-viewer";
import type { SectionData } from "@/components/pdf-viewer";
import { mockSections } from "./mockSections";
import { usePropertyDocumentQuery } from "@/api/properties";

type UnitsStepProps = {
    onNext: () => void;
    onBack: () => void;
    propertyId: string;
};

export function UnitsStep({ onNext, onBack, propertyId }: UnitsStepProps) {
    const [sections, setSections] = useState<SectionData[]>(mockSections);
    const propertyType: "WEG" | "MV" = "WEG";
    const [viewerState, viewerActions] = usePdfViewerState(sections, true);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const { data: documentBlob, isLoading: isDocumentLoading, isError: isDocumentError, error: documentError } = usePropertyDocumentQuery(propertyId);
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);

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
