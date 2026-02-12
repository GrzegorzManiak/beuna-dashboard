import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useExtractSectionFieldsMutation } from "@/hooks/useExtractSectionFieldsMutation";
import { useUpdateSectionMutation } from "@/hooks/useUpdateSectionMutation";
import { REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType } from "@shared/section-types";
import type { SectionData, SectionState } from "@/components/pdfViewer/pdfViewer.types";
import type { PropertySection } from "@/api/properties";

const EXTRACTABLE_STATES: SectionState[] = ["processing"];
const TRANSIENT_STATES: SectionState[] = ["identifying"];
const LOCKED_STATES: SectionState[] = ["valid", "identifying", "error"];
const POOL_SIZE = 5;
const DEPENDS_ON_BUILDINGS = new Set(["units.unit_block"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateBuildingUuid( ){
    return `building-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

type UseSectionExtractionOpts = {
    propertyId: string;
    sections: SectionData[];
    onSectionUpdate: (sectionId: string, updates: Partial<SectionData>) => void;
    enabled?: boolean;
    itemToParentMapRef?: RefObject<Map<string, string>>;
    incomingSections?: PropertySection[];
    tempIdToRealIdRef?: RefObject<Map<string, string>>;
};

function useSectionExtraction({
    propertyId,
    sections,
    onSectionUpdate,
    enabled = true,
    itemToParentMapRef,
    incomingSections,
    tempIdToRealIdRef,
}: UseSectionExtractionOpts){
    const inflightRef = useRef(new Set<string>());
    const completedRef = useRef(new Set<string>());
    const buildingAssignmentDoneRef = useRef(false);
    const latestRef = useRef({ sections, onSectionUpdate, propertyId, enabled, incomingSections });
    latestRef.current = { sections, onSectionUpdate, propertyId, enabled, incomingSections };

    const resolveId = useCallback((id: string): string => {
        return tempIdToRealIdRef?.current?.get(id) ?? id;
    }, [tempIdToRealIdRef]);

    // Local cache of parent items arrays so concurrent item persists don't
    // overwrite each other (each persist builds on the latest known state).
    const parentItemsCacheRef = useRef(new Map<string, PropertySection["items"]>());

    const extractMutation = useExtractSectionFieldsMutation();
    const updateSectionMutation = useUpdateSectionMutation();

    const persistSection = useCallback((sectionId: string, updates: { state?: string; fields?: Record<string, unknown> }) => {
        const pid = latestRef.current.propertyId;
        if (!pid) return;

        const isDbId = UUID_RE.test(sectionId);

        if (isDbId) {
            // Direct DB section — persist state/fields directly
            updateSectionMutation.mutateAsync({
                propertyId: pid,
                sectionId,
                ...updates,
            }).catch((err) => {
                console.error(`[persist] Failed to save section ${sectionId}:`, err);
            });
            return;
        }

        // Item-expanded section — persist fields/state into the parent's items JSON
        const parentId = itemToParentMapRef?.current?.get(sectionId);
        if (!parentId || !UUID_RE.test(parentId)) return;

        // Use cached items if available, otherwise read from incomingSections
        let currentItems = parentItemsCacheRef.current.get(parentId);
        if (!currentItems) {
            const parentSection = latestRef.current.incomingSections?.find((s) => s.id === parentId);
            currentItems = parentSection?.items;
        }
        if (!currentItems) return;

        // Clone items and update the matching item with extracted fields/state
        const updatedItems = currentItems.map((item) => {
            if (item.id === sectionId) {
                return {
                    ...item,
                    state: (updates.state as typeof item.state) ?? item.state,
                    fields: updates.fields ?? item.fields,
                };
            }
            return item;
        });

        // Update the local cache so the next persist for a sibling item
        // will see this item's fields already applied.
        parentItemsCacheRef.current.set(parentId, updatedItems);

        updateSectionMutation.mutateAsync({
            propertyId: pid,
            sectionId: parentId,
            items: updatedItems,
        }).catch((err) => {
            console.error(`[persist-item] Failed to save item ${sectionId} on parent ${parentId}:`, err);
        });
    }, [itemToParentMapRef, updateSectionMutation]);

    const maybeAutoAssignBuildings = useCallback(() => {
        if (buildingAssignmentDoneRef.current) return;

        const { sections: secs, onSectionUpdate: update } = latestRef.current;
        const inflight = inflightRef.current;

        const allBuildings = secs.filter((s) => s.sectionType === "core.building");
        const pendingBuildings = allBuildings.filter(
            (s) =>
                EXTRACTABLE_STATES.includes(s.state as SectionState) ||
                inflight.has(s.id),
        );

        if (pendingBuildings.length > 0) return;
        if (allBuildings.length === 0) return;

        const buildingUuids: string[] = [];
        for (const b of allBuildings) {
            const uuid = b.fields?.buildingUuid;
            if (uuid && typeof uuid === "string") buildingUuids.push(uuid);
        }

        if (buildingUuids.length === 0) return;

        buildingAssignmentDoneRef.current = true;

        if (buildingUuids.length === 1) {
            const singleUuid = buildingUuids[0]!;
            const units = secs.filter(
                (s) => s.sectionType === "units.unit_block" && !s.fields?.buildingRef,
            );
            for (const unit of units) {
                update(unit.id, {
                    fields: { ...(unit.fields ?? {}), buildingRef: singleUuid },
                });
            }
        }
    }, []);

    const processNext = useCallback(() => {
        const { sections: secs, onSectionUpdate: update, propertyId: pid, enabled: on } = latestRef.current;
        if (!on || !pid) return;

        const inflight = inflightRef.current;
        const completed = completedRef.current;

        const free = POOL_SIZE - inflight.size;
        if (free <= 0) return;

        const resolvedInflight = new Set(Array.from(inflight).map(resolveId));
        const resolvedCompleted = new Set(Array.from(completed).map(resolveId));

        const allCandidates = secs.filter(
            (s) =>
                s.sectionType &&
                s.sectionType !== "unknown" &&
                EXTRACTABLE_STATES.includes(s.state as SectionState) &&
                !inflight.has(s.id) &&
                !completed.has(s.id) &&
                !resolvedInflight.has(s.id) &&
                !resolvedCompleted.has(s.id),
        );

        const allBuildings = secs.filter((s) => s.sectionType === "core.building");
        const pendingBuildings = allBuildings.filter(
            (s) =>
                EXTRACTABLE_STATES.includes(s.state as SectionState) ||
                inflight.has(s.id) ||
                resolvedInflight.has(s.id),
        );
        const buildingsDone = pendingBuildings.length === 0 && allBuildings.length > 0;

        let candidates: SectionData[];
        if (!buildingsDone) {
            candidates = allCandidates.filter(
                (s) => !DEPENDS_ON_BUILDINGS.has(s.sectionType!),
            );
        } else {
            candidates = allCandidates;
        }

        const batch = candidates.slice(0, free);
        if (!batch.length) return;

        for (const section of batch) {
            inflight.add(section.id);

            const rawText = section.rawText || "";

            if (!rawText || !section.sectionType) {
                inflight.delete(section.id);
                completed.add(section.id);
                update(section.id, { state: "error" });
                setTimeout(processNext, 0);
                continue;
            }

            let buildings: Array<{ uuid: string; name: string }> | undefined;
            if (DEPENDS_ON_BUILDINGS.has(section.sectionType!)) {
                buildings = secs
                    .filter((s) => s.sectionType === "core.building" && s.fields?.buildingUuid)
                    .map((s) => {
                        const uuid = String(s.fields!.buildingUuid);
                        const namePart = s.fields?.buildingName ? String(s.fields.buildingName).trim() : "";
                        const labelPart = s.fields?.label ? String(s.fields.label).trim() : "";
                        const name = namePart && labelPart
                            ? `${namePart} — ${labelPart}`
                            : namePart || labelPart || `Building ${uuid.slice(-8)}`;
                        return { uuid, name };
                    });
            }

            extractMutation.mutateAsync({
                propertyId: pid,
                sectionId: section.id,
                rawText,
                sectionType: section.sectionType,
                buildings,
            })
                .then((result) => {
                    const realId = resolveId(section.id);
                    inflight.delete(section.id);
                    inflight.delete(realId);
                    completed.add(section.id);
                    completed.add(realId);

                    const current = latestRef.current.sections.find(
                        (s) => s.id === section.id || s.id === realId,
                    );
                    const updateId = current?.id ?? section.id;

                    if (current && LOCKED_STATES.includes(current.state as SectionState)) {
                        setTimeout(processNext, 0);
                        return;
                    }

                    if (result.error) {
                        update(updateId, { state: "error" });
                        persistSection(updateId, { state: "error" });
                    } else if (!result.fields || !Object.keys(result.fields).length) {
                        update(updateId, { state: "error" });
                        persistSection(updateId, { state: "error" });
                    } else {
                        const fields = { ...(current?.fields ?? {}), ...result.fields };

                        if (section.sectionType === "core.building" && !fields.buildingUuid) {
                            fields.buildingUuid = generateBuildingUuid();
                        }

                        const reqKeys = REQUIRED_FIELDS[section.sectionType as SectionType] ?? [];
                        const filledRequired = reqKeys.filter(
                            (k) => fields[k] !== null && fields[k] !== undefined && fields[k] !== "",
                        );

                        if (reqKeys.length > 0 && filledRequired.length === 0) {
                            update(updateId, { fields, state: "error" });
                            persistSection(updateId, { fields, state: "error" });
                        } else {
                            update(updateId, { fields, state: "needs_review" });
                            persistSection(updateId, { fields, state: "needs_review" });
                        }
                    }

                    setTimeout(() => {
                        maybeAutoAssignBuildings();
                        processNext();
                    }, 0);
                })
                .catch(() => {
                    const realId = resolveId(section.id);
                    inflight.delete(section.id);
                    inflight.delete(realId);
                    completed.add(section.id);
                    completed.add(realId);
                    const current = latestRef.current.sections.find(
                        (s) => s.id === section.id || s.id === realId,
                    );
                    const updateId = current?.id ?? section.id;
                    update(updateId, { state: "error" });
                    persistSection(updateId, { state: "error" });
                    setTimeout(processNext, 0);
                });
        }
    }, [extractMutation, maybeAutoAssignBuildings, persistSection, resolveId]);

    // Seed completedRef with sections that are already extracted / not
    // in a processable state so they are never re-sent for LLM extraction
    // (e.g. when the component remounts after navigating back from review).
    useEffect(() => {
        if (!enabled) return;
        const completed = completedRef.current;
        for (const s of latestRef.current.sections) {
            if (
                !EXTRACTABLE_STATES.includes(s.state as SectionState) &&
                !TRANSIENT_STATES.includes(s.state as SectionState) &&
                !completed.has(s.id)
            ) {
                completed.add(s.id);
            }
        }
        maybeAutoAssignBuildings();
        processNext();
    }, [sections, enabled, processNext, maybeAutoAssignBuildings]);

    const retrySection = useCallback((sectionId: string) => {
        completedRef.current.delete(sectionId);
        inflightRef.current.delete(sectionId);
        const { onSectionUpdate: update } = latestRef.current;
        update(sectionId, { state: "processing" });
        setTimeout(processNext, 0);
    }, [processNext]);

    const reset = useCallback(() => {
        inflightRef.current.clear();
        completedRef.current.clear();
        buildingAssignmentDoneRef.current = false;
    }, []);

    return { reset, retrySection };
}

export {
    useSectionExtraction,
};
