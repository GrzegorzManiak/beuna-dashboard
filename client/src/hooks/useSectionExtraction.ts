import { useCallback, useEffect, useRef } from "react";
import { extractSectionFields } from "@/api/properties";
import type { SectionData, SectionState } from "@/components/pdf-viewer";
import { REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType } from "@shared/section-types";

/**
 * Section states that indicate extraction should run.
 * "processing" = server-delivered section awaiting field extraction.
 */
const EXTRACTABLE_STATES: SectionState[] = ["processing"];

/** States that should NOT be overwritten by the extraction pipeline. */
const LOCKED_STATES: SectionState[] = ["valid", "identifying", "error"];

/** Max number of concurrent LLM extraction requests. */
const POOL_SIZE = 5;

/**
 * Section types that depend on buildings being extracted first.
 */
const DEPENDS_ON_BUILDINGS = new Set(["units.unit_block"]);

function generateBuildingUuid(): string {
    return `building-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

type UseSectionExtractionOpts = {
    /** Property ID for the API call. */
    propertyId: string;
    /** Current section list (read-only for the hook). */
    sections: SectionData[];
    /** Callback to update a section's fields + state. */
    onSectionUpdate: (sectionId: string, updates: Partial<SectionData>) => void;
    /** Whether extraction is enabled (disable while sections are still streaming in). */
    enabled?: boolean;
};

/**
 * Automatically extracts field values for sections in "processing" state
 * using the LLM extraction endpoint.  Processes with a concurrency pool
 * of {@link POOL_SIZE}.
 *
 * **Ordering**: Buildings are extracted before units so that `buildingRef`
 * can be auto-assigned once all buildings are known.
 */
export function useSectionExtraction({
    propertyId,
    sections,
    onSectionUpdate,
    enabled = true,
}: UseSectionExtractionOpts) {
    /** Set of section IDs currently in-flight. */
    const inflightRef = useRef(new Set<string>());
    /** Set of section IDs that have already been extracted (or attempted). */
    const completedRef = useRef(new Set<string>());
    /** Whether building-dependent auto-assignment has already run. */
    const buildingAssignmentDoneRef = useRef(false);
    /** Stable reference to latest sections / callbacks. */
    const latestRef = useRef({ sections, onSectionUpdate, propertyId, enabled });
    latestRef.current = { sections, onSectionUpdate, propertyId, enabled };

    const processNext = useCallback(() => {
        const { sections: secs, onSectionUpdate: update, propertyId: pid, enabled: on } = latestRef.current;
        if (!on || !pid) return;

        const inflight = inflightRef.current;
        const completed = completedRef.current;

        // How many slots are free?
        const free = POOL_SIZE - inflight.size;
        if (free <= 0) return;

        // Gather all extractable candidates.
        const allCandidates = secs.filter(
            (s) =>
                s.sectionType &&
                s.sectionType !== "unknown" &&
                EXTRACTABLE_STATES.includes(s.state as SectionState) &&
                !inflight.has(s.id) &&
                !completed.has(s.id),
        );

        // Check whether all buildings are done (extracted or attempted).
        const allBuildings = secs.filter((s) => s.sectionType === "core.building");
        const pendingBuildings = allBuildings.filter(
            (s) =>
                EXTRACTABLE_STATES.includes(s.state as SectionState) ||
                inflight.has(s.id),
        );
        const buildingsDone = pendingBuildings.length === 0 && allBuildings.length > 0;

        // Prioritise: extract buildings & non-unit sections first.
        // Only release units once all buildings are complete.
        let candidates: SectionData[];
        if (!buildingsDone) {
            // Buildings still pending — only pick priority types + non-dependent types
            candidates = allCandidates.filter(
                (s) => !DEPENDS_ON_BUILDINGS.has(s.sectionType!),
            );
        } else {
            // Buildings are done — allow everything (units included)
            candidates = allCandidates;
        }

        const batch = candidates.slice(0, free);
        if (!batch.length) return;

        console.log(
            `[extraction] pool: ${inflight.size} inflight, ${completed.size} completed, ` +
            `${candidates.length} candidates (buildings ${buildingsDone ? "done" : "pending"}), ` +
            `dispatching ${batch.length}`,
        );

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

            // For unit sections, pass available buildings so the LLM can pick the right one.
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

            extractSectionFields(pid, section.id, rawText, section.sectionType, buildings)
                .then((result) => {
                    inflight.delete(section.id);
                    completed.add(section.id);

                    console.log(
                        `[extraction] ${section.id} (${section.sectionType}) →`,
                        result.error
                            ? `ERROR: ${result.error}`
                            : `${Object.keys(result.fields).length} fields`,
                        result.fields,
                    );

                    const current = latestRef.current.sections.find((s) => s.id === section.id);
                    if (current && LOCKED_STATES.includes(current.state as SectionState)) {
                        setTimeout(processNext, 0);
                        return;
                    }

                    if (result.error) {
                        update(section.id, { state: "error" });
                    } else if (!result.fields || !Object.keys(result.fields).length) {
                        // Extraction returned nothing — error
                        update(section.id, { state: "error" });
                    } else {
                        let fields = { ...(current?.fields ?? {}), ...result.fields };

                        // Auto-generate buildingUuid for buildings if the LLM didn't provide one.
                        if (section.sectionType === "core.building" && !fields.buildingUuid) {
                            fields.buildingUuid = generateBuildingUuid();
                        }

                        // Check how many required fields were filled to
                        // determine the extraction quality.
                        const reqKeys = REQUIRED_FIELDS[section.sectionType as SectionType] ?? [];
                        const filledRequired = reqKeys.filter(
                            (k) => fields[k] !== null && fields[k] !== undefined && fields[k] !== "",
                        );

                        if (reqKeys.length > 0 && filledRequired.length === 0) {
                            // All required fields are empty — treat as error
                            update(section.id, { fields, state: "error" });
                        } else {
                            update(section.id, { fields, state: "needs_review" });
                        }
                    }

                    // After any extraction finishes, try auto-assigning buildings.
                    // (Buildings must be fully extracted before assignment works,
                    // and units may finish after the initial building check.)
                    setTimeout(() => {
                        maybeAutoAssignBuildings();
                        processNext();
                    }, 0);
                })
                .catch((err) => {
                    inflight.delete(section.id);
                    completed.add(section.id);
                    console.error(`[extraction] ${section.id} (${section.sectionType}) EXCEPTION:`, err);
                    update(section.id, { state: "error" });
                    setTimeout(processNext, 0);
                });
        }
    }, []);

    /**
     * Once all buildings have been extracted, auto-assign `buildingRef` on
     * unit sections when there is exactly one building.
     */
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

        if (pendingBuildings.length > 0) return; // Not done yet
        if (allBuildings.length === 0) return; // No buildings at all

        // Collect building UUIDs from extracted buildings
        const buildingUuids: string[] = [];
        for (const b of allBuildings) {
            const uuid = b.fields?.buildingUuid;
            if (uuid && typeof uuid === "string") {
                buildingUuids.push(uuid);
            }
        }

        // If buildings are "done" but no UUIDs found yet, React may not have
        // committed the state update.  Don't mark as done — retry on next tick.
        if (buildingUuids.length === 0) return;

        buildingAssignmentDoneRef.current = true;

        // Auto-assign: if there's exactly 1 building, assign it to all units
        // that don't already have a buildingRef.
        if (buildingUuids.length === 1) {
            const singleUuid = buildingUuids[0]!;
            const units = secs.filter(
                (s) => s.sectionType === "units.unit_block" && !s.fields?.buildingRef,
            );
            console.log(`[extraction] auto-assigning ${units.length} units to building ${singleUuid}`);
            for (const unit of units) {
                update(unit.id, {
                    fields: { ...(unit.fields ?? {}), buildingRef: singleUuid },
                });
            }
        }
    }, []);

    // Re-trigger whenever sections change (new sections arrive, state changes)
    useEffect(() => {
        if (!enabled) return;
        maybeAutoAssignBuildings();
        processNext();
    }, [sections, enabled, processNext, maybeAutoAssignBuildings]);

    /** Reset the completed set (e.g. when property changes). */
    const reset = useCallback(() => {
        inflightRef.current.clear();
        completedRef.current.clear();
        buildingAssignmentDoneRef.current = false;
    }, []);

    return { reset };
}
