import { useCallback, useEffect, useRef } from "react";
import { useExtractSectionFieldsMutation } from "@/hooks/useExtractSectionFieldsMutation";
import type { SectionData, SectionState } from "@/components/pdfViewer";
import { REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType } from "@shared/section-types";

const EXTRACTABLE_STATES: SectionState[] = ["processing"];
const LOCKED_STATES: SectionState[] = ["valid", "identifying", "error"];
const POOL_SIZE = 5;
const DEPENDS_ON_BUILDINGS = new Set(["units.unit_block"]);

function generateBuildingUuid(): string {
    return `building-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

type UseSectionExtractionOpts = {
    propertyId: string;
    sections: SectionData[];
    onSectionUpdate: (sectionId: string, updates: Partial<SectionData>) => void;
    enabled?: boolean;
};

export function useSectionExtraction({
    propertyId,
    sections,
    onSectionUpdate,
    enabled = true,
}: UseSectionExtractionOpts) {
    const inflightRef = useRef(new Set<string>());
    const completedRef = useRef(new Set<string>());
    const buildingAssignmentDoneRef = useRef(false);
    const latestRef = useRef({ sections, onSectionUpdate, propertyId, enabled });
    latestRef.current = { sections, onSectionUpdate, propertyId, enabled };

    const extractMutation = useExtractSectionFieldsMutation();

    const processNext = useCallback(() => {
        const { sections: secs, onSectionUpdate: update, propertyId: pid, enabled: on } = latestRef.current;
        if (!on || !pid) return;

        const inflight = inflightRef.current;
        const completed = completedRef.current;

        const free = POOL_SIZE - inflight.size;
        if (free <= 0) return;

        const allCandidates = secs.filter(
            (s) =>
                s.sectionType &&
                s.sectionType !== "unknown" &&
                EXTRACTABLE_STATES.includes(s.state as SectionState) &&
                !inflight.has(s.id) &&
                !completed.has(s.id),
        );

        const allBuildings = secs.filter((s) => s.sectionType === "core.building");
        const pendingBuildings = allBuildings.filter(
            (s) =>
                EXTRACTABLE_STATES.includes(s.state as SectionState) ||
                inflight.has(s.id),
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
                    inflight.delete(section.id);
                    completed.add(section.id);

                    const current = latestRef.current.sections.find((s) => s.id === section.id);
                    if (current && LOCKED_STATES.includes(current.state as SectionState)) {
                        setTimeout(processNext, 0);
                        return;
                    }

                    if (result.error) {
                        update(section.id, { state: "error" });
                    } else if (!result.fields || !Object.keys(result.fields).length) {
                        update(section.id, { state: "error" });
                    } else {
                        let fields = { ...(current?.fields ?? {}), ...result.fields };

                        if (section.sectionType === "core.building" && !fields.buildingUuid) {
                            fields.buildingUuid = generateBuildingUuid();
                        }

                        const reqKeys = REQUIRED_FIELDS[section.sectionType as SectionType] ?? [];
                        const filledRequired = reqKeys.filter(
                            (k) => fields[k] !== null && fields[k] !== undefined && fields[k] !== "",
                        );

                        if (reqKeys.length > 0 && filledRequired.length === 0) {
                            update(section.id, { fields, state: "error" });
                        } else {
                            update(section.id, { fields, state: "needs_review" });
                        }
                    }

                    setTimeout(() => {
                        maybeAutoAssignBuildings();
                        processNext();
                    }, 0);
                })
                .catch(() => {
                    inflight.delete(section.id);
                    completed.add(section.id);
                    update(section.id, { state: "error" });
                    setTimeout(processNext, 0);
                });
        }
    }, [extractMutation]);

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

    useEffect(() => {
        if (!enabled) return;
        maybeAutoAssignBuildings();
        processNext();
    }, [sections, enabled, processNext, maybeAutoAssignBuildings]);

    const reset = useCallback(() => {
        inflightRef.current.clear();
        completedRef.current.clear();
        buildingAssignmentDoneRef.current = false;
    }, []);

    return { reset };
}
