import { useEffect, useRef, useState } from "react";
import { Checklist, PdfViewer, SectionBar, usePdfViewerState } from "@/components/pdfViewer";
import type { SectionData } from "@/components/pdfViewer";
import type { PropertySection } from "@/api/properties";
import { usePropertyDocumentQuery } from "@/hooks/usePropertyDocumentQuery";
import { useSectionExtraction } from "@/hooks/useSectionExtraction";
import { useCreateSectionMutation } from "@/hooks/useCreateSectionMutation";
import { useUpdateSectionMutation } from "@/hooks/useUpdateSectionMutation";
import { useDeleteSectionMutation } from "@/hooks/useDeleteSectionMutation";

type NewPropertySectionsStageProps = {
    onNext: () => void;
    onBack: () => void;
    propertyId: string;
    sections: PropertySection[];
    propertyType: "WEG" | "MV";
    sectionsProcessing: boolean;
};

function NewPropertySectionsStage({
    onNext,
    onBack,
    propertyId,
    sections: incomingSections,
    propertyType,
    sectionsProcessing,
}: NewPropertySectionsStageProps){
    const [sections, setSections] = useState<SectionData[]>([]);
    const [viewerState, viewerActions] = usePdfViewerState(sections, true);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const { data: documentBlob, isLoading: isDocumentLoading, isError: isDocumentError, error: documentError } = usePropertyDocumentQuery(propertyId);
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);

    // Maps item-expanded IDs (e.g. "unit-10-xxx") to their parent section UUID
    // so the extraction hook can persist item results back to the parent's items JSON.
    const itemToParentMapRef = useRef<Map<string, string>>(new Map());

    const createSectionMutation = useCreateSectionMutation();
    const updateSectionMutation = useUpdateSectionMutation();
    const deleteSectionMutation = useDeleteSectionMutation();

    // Automatic LLM field extraction for sections in "processing" state.
    // Enabled once sections have been mapped and the viewer is loaded.
    useSectionExtraction({
        propertyId,
        sections,
        onSectionUpdate: handleSectionUpdate,
        enabled: isLoaded && sections.length > 0,
        itemToParentMapRef,
        incomingSections,
    });

    useEffect(() => {
        if (!incomingSections.length) return;
        const { sections: mapped, itemToParentMap } = mapPropertySections(incomingSections);
        itemToParentMapRef.current = itemToParentMap;
        setSections((prev) => mergeSectionData(prev, mapped));
    }, [incomingSections]);

    useEffect(() => {
        if (!isLoaded || !incomingSections.length) return;
        const { sections: mapped, itemToParentMap } = mapPropertySections(incomingSections);
        itemToParentMapRef.current = itemToParentMap;
        setSections((prev) => mergeSectionData(prev, mapped));
    }, [isLoaded]);

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

    function handleSectionAdd(newSection: SectionData ){
        setSections((prev) => [...prev, newSection]);

        // Persist the new section to the server and swap the temp id for the real one
        createSectionMutation.mutateAsync({
            propertyId,
            headingText: "",
            rawText: newSection.rawText ?? "",
            textPosition: newSection.textPosition,
            sectionType: newSection.sectionType ?? "unknown",
            confidence: 0,
            state: newSection.state ?? "identifying",
        }).then((response) => {
            const serverId = response.section.id;
            setSections((prev) =>
                prev.map((s) => (s.id === newSection.id ? { ...s, id: serverId } : s)),
            );
        }).catch((err) => {
            console.error("[createSection] Failed to persist new section:", err);
        });
    }

    function handleSectionUpdate(sectionId: string, updates: Partial<SectionData> ){
        setSections((prev) =>
            prev.map((section) => (section.id === sectionId ? { ...section, ...updates } : section)),
        );

        // Persist meaningful state changes to the server (only for real DB UUIDs)
        const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId);
        if (isDbId && (updates.state || updates.fields || updates.sectionType || updates.rawText)) {
            updateSectionMutation.mutateAsync({
                propertyId,
                sectionId,
                ...(updates.state ? { state: updates.state } : {}),
                ...(updates.fields ? { fields: updates.fields } : {}),
                ...(updates.sectionType ? { sectionType: updates.sectionType } : {}),
                ...(updates.rawText ? { rawText: updates.rawText } : {}),
            }).catch((err) => {
                console.error(`[updateSection] Failed to persist section ${sectionId}:`, err);
            });
        }
    }

    function handleSectionDelete(sectionId: string ){
        setSections((prev) => prev.filter((section) => section.id !== sectionId));

        // Persist deletion to the server (only for real DB UUIDs)
        const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId);
        if (isDbId) {
            deleteSectionMutation.mutateAsync({ propertyId, sectionId }).catch((err) => {
                console.error(`[deleteSection] Failed to delete section ${sectionId}:`, err);
            });
        }
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
                                    propertyId={propertyId}
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

/**
 * Compute an overall bounding box from an array of per-page position boxes.
 *
 * The top-level x/y/width/height uses the FIRST page's box so that
 * SectionBar (which positions cards relative to the first page) and
 * the fallback path in calculateSectionStyle work correctly.  The full
 * per-page boxes array is preserved for per-page highlight rendering.
 */
function computeBoundingBox(boxes: Array<{ page: number; x: number; y: number; width: number; height: number }> ){
    if (!boxes.length) return { page: [] as number[], x: 0, y: 0, width: 0, height: 0, boxes: undefined as any };

    const pages = [...new Set(boxes.map((b) => b.page))].sort((a, b) => a - b);
    const firstPage = pages[0];

    // Use the first page's box for the top-level bounding box.
    const firstPageBoxes = boxes.filter((b) => b.page === firstPage);
    let minX = Infinity;
    let minY = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    for (const box of firstPageBoxes) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxRight = Math.max(maxRight, box.x + box.width);
        maxBottom = Math.max(maxBottom, box.y + box.height);
    }

    return {
        page: pages,
        x: minX,
        y: minY,
        width: Math.max(0, maxRight - minX),
        height: Math.max(0, maxBottom - minY),
        boxes,
    };
}

function mapPropertySections(sections: PropertySection[] ){
    const result: SectionData[] = [];
    const itemToParent = new Map<string, string>();

    for (const section of sections) {
        const isArrayContainer = section.items && Array.isArray(section.items) && section.items.length > 0;
        
        // If the section already has a persisted state (from a previous extraction),
        // use it directly to avoid re-running expensive LLM extraction.
        const hasPersistedState = section.state && section.state !== "processing";
        const hasPersistedFields = section.fields && Object.keys(section.fields).length > 0;

        if (isArrayContainer) {
            // For array containers (buildings, units, administration), expand items into individual sections
            
            for (let i = 0; i < section.items!.length; i++) {
                const item = section.items![i];
                if (!item) continue;
                
                // Prefer item-level sectionType (e.g. weg.administration items carry their
                // own type: weg.property_manager / weg.accountant).  Fall back to the
                // container section type for homogeneous arrays (buildings, units).
                const itemType = (item.sectionType ?? section.sectionType) as any;
                
                const itemPositions = item.textPosition || [];

                const itemId = item.id || `${section.id}-item-${i}`;

                // Track which parent UUID owns this item so we can persist
                // item extraction results back into the parent's items JSON.
                itemToParent.set(itemId, section.id);

                // If the item already carries persisted state/fields (saved from
                // a previous extraction), honour them to avoid re-extraction.
                const itemHasPersistedState = item.state && item.state !== "processing";
                const itemHasPersistedFields = item.fields && Object.keys(item.fields).length > 0;

                if (itemHasPersistedState) {
                    result.push({
                        id: itemId,
                        textPosition: computeBoundingBox(itemPositions),
                        state: item.state as SectionData["state"],
                        sectionType: itemType as any,
                        reusable: section.reusable,
                        rawText: item.rawText || "",
                        fields: (itemHasPersistedFields ? item.fields : {}) as Record<string, string | number | boolean | null>,
                    });
                } else {
                    result.push({
                        id: itemId,
                        textPosition: computeBoundingBox(itemPositions),
                        state: "processing",
                        sectionType: itemType as any,
                        reusable: section.reusable,
                        rawText: item.rawText || "",
                        fields: {},
                    });
                }
            }
        } else {
            // For single-object sections, map as-is
            const positions = [...(section.textPosition ?? [])].sort((a, b) => a.page - b.page);

            // If state/fields were persisted from a previous session, honour them.
            if (hasPersistedState) {
                result.push({
                    id: section.id,
                    textPosition: computeBoundingBox(positions),
                    state: section.state as SectionData["state"],
                    sectionType: section.sectionType,
                    reusable: section.reusable,
                    rawText: section.rawText || "",
                    fields: (hasPersistedFields ? section.fields : {}) as Record<string, string | number | boolean | null>,
                });
            } else {
                // core.address is already collected in the Basic Details step, so
                // mark it as valid immediately — it should be visible in the viewer
                // but must not block progression.
                const state = section.sectionType === "unknown"
                    ? "unknown"
                    : section.sectionType === "core.address"
                        ? "valid"
                        : "processing";

                result.push({
                    id: section.id,
                    textPosition: computeBoundingBox(positions),
                    state,
                    sectionType: section.sectionType,
                    reusable: section.reusable,
                    rawText: section.rawText || "",
                    fields: {},
                });
            }
        }
    }
    
    return { sections: result, itemToParentMap: itemToParent };
}

function mergeSectionData(existing: SectionData[], incoming: SectionData[] ){
    const map = new Map<string, SectionData>();
    for (const section of existing) map.set(section.id, section);
    for (const section of incoming) {
        const prev = map.get(section.id);
        if (prev) {
            // Don't regress state: if we already extracted fields, the user
            // validated, or extraction errored, keep the richer version.
            // Only preserve "needs_review" if the section has extracted fields —
            // otherwise it was never truly extracted and should re-enter the queue.
            const hasFields = prev.fields && Object.keys(prev.fields).length > 0;
            const preserveState =
                prev.state === "valid" ||
                (prev.state === "needs_review" && hasFields) ||
                prev.state === "identifying" ||
                prev.state === "error";
            map.set(section.id, {
                ...section,
                state: preserveState ? prev.state : section.state,
                fields: preserveState && prev.fields && Object.keys(prev.fields).length
                    ? prev.fields
                    : section.fields,
                rawText: section.rawText || prev.rawText,
            });
        } else {
            map.set(section.id, section);
        }
    }
    return Array.from(map.values());
}

export {
    NewPropertySectionsStage,
};
