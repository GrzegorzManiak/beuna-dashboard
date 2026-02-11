import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    PAGE_DIVIDER_HEIGHT,
    SELECTION_OFFSET,
    SIDEBAR_CARD_GAP,
    SIDEBAR_CARD_HEIGHT,
} from "./pdfViewer.constants";
import type { ActiveSplit, PageMetrics, SectionData } from "./pdfViewer.types";
import { SECTION_TYPE_OPTIONS } from "./pdfViewerSplitToolbar";
import { RENDERABLE_SECTION_TYPES, REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType as SharedSectionType } from "@shared/section-types";

type SectionBarProps = {
    sectionData: Array<SectionData>;
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    setActiveSectionId: (id: string | null) => void;
    onRetrySection?: (sectionId: string) => void;
};

function SectionBar({
    sectionData,
    pageMetrics,
    activeSplit,
    splitToolbarHeight,
    activeSectionId,
    setActiveSectionId,
    onRetrySection,
}: SectionBarProps){
    const isPartialSection = (section: SectionData): boolean => {
        if (section.state !== "needs_review") return false;
        const reqKeys = REQUIRED_FIELDS[section.sectionType as SharedSectionType] ?? [];
        if (!reqKeys.length) return false;
        for (const key of reqKeys) {
            const val = section.fields?.[key];
            if (val === null || val === undefined || val === "") return true;
        }
        return false;
    };

    const getStateClasses = (state: SectionData["state"], isSelected: boolean, isPartial = false) => {
        switch (state) {
            case "valid":
                return isSelected
                    ? "border-emerald-500 bg-emerald-500/40 z-10 scale-105"
                    : "border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30";
            case "needs_review":
                if (isPartial) {
                    return isSelected
                        ? "border-amber-500 bg-amber-500/40 z-10 scale-105 animate-slow-pulse"
                        : "border-amber-500 bg-amber-500/20 hover:bg-amber-500/30 animate-slow-pulse";
                }
                return isSelected
                    ? "border-amber-500 bg-amber-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-amber-500 bg-amber-500/20 hover:bg-amber-500/30";
            case "conflict":
                return isSelected
                    ? "border-red-500 bg-red-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-red-500 bg-red-500/20 hover:bg-red-500/30";
            case "processing":
                return isSelected
                    ? "border-sky-500 bg-sky-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-sky-400 bg-sky-400/20 hover:bg-sky-400/30 animate-slow-pulse";
            case "identifying":
                return isSelected
                    ? "border-indigo-500 bg-indigo-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-indigo-400 bg-indigo-400/20 hover:bg-indigo-400/30 animate-slow-pulse";
            case "error":
                return isSelected
                    ? "border-red-500 bg-red-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-red-400 bg-red-400/20 hover:bg-red-400/30 animate-slow-pulse";
            case "unknown":
            default:
                return isSelected
                    ? "border-red-500 bg-red-500/40 z-10 scale-105 animate-slow-pulse"
                    : "border-red-500 bg-red-500/20 hover:bg-red-500/30";
        }
    };

    const sidebarItems = useMemo(() => {
        // Don't render items until we have page metrics
        const hasMetrics = Object.keys(pageMetrics).length > 0;
        if (!hasMetrics) return [];

        // Filter to only renderable section types
        const renderableSections = sectionData.filter((section) =>
            section.sectionType &&
            RENDERABLE_SECTION_TYPES.includes(section.sectionType as any)
        );

        const items = renderableSections
            .map((section) => {
                const pageNumber = section.textPosition.page[0];
                const metrics = pageMetrics[pageNumber];

                // Calculate accumulating Y offset
                let rawY = 0;
                for (let i = 1; i < pageNumber; i++) {
                    const m = pageMetrics[i];
                    if (m) {
                        rawY += m.height;
                        rawY += PAGE_DIVIDER_HEIGHT;

                        // Add split toolbar height if this page was split
                        if (activeSplit?.pageNumber === i) {
                            rawY += splitToolbarHeight;
                        }
                    }
                }

                let visualY = rawY + PAGE_DIVIDER_HEIGHT;
                let scaledX = 0;

                if (metrics) {
                    const scaledY = section.textPosition.y * metrics.scale;
                    visualY += scaledY;
                    scaledX = section.textPosition.x * metrics.scale;

                    if (activeSplit?.pageNumber === pageNumber) {
                        const splitY = metrics.height * activeSplit.splitRatio;
                        if (scaledY > splitY) {
                            visualY += splitToolbarHeight;
                        }
                    }
                }

                return {
                    ...section,
                    targetTop: visualY - SELECTION_OFFSET,
                    top: visualY - SELECTION_OFFSET,
                    scaledX,
                };
            })
            .sort((a, b) => a.targetTop - b.targetTop);
        const activeIndex = activeSectionId
            ? items.findIndex((item) => item.id === activeSectionId)
            : -1;

        if (activeIndex >= 0) {
            items[activeIndex].top = items[activeIndex].targetTop;

            // Push items above upwards
            for (let i = activeIndex - 1; i >= 0; i -= 1) {
                const nextTop = items[i + 1].top;
                const maxTop = nextTop - SIDEBAR_CARD_HEIGHT - SIDEBAR_CARD_GAP;
                items[i].top = Math.min(items[i].targetTop, maxTop); // Use targetTop as max? No, used math.min in ref
                // Ref: items[i].top = Math.min(items[i].top, maxTop); which assumes items[i].top was initialized to targetTop
                if (items[i].top > maxTop) items[i].top = maxTop;
            }

            // Push items below downwards
            for (let i = activeIndex + 1; i < items.length; i += 1) {
                const prevTop = items[i - 1].top;
                const minTop = prevTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
                if (items[i].top < minTop) items[i].top = minTop;
            }
        } else {
            let lastTop = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const minTop = lastTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
                if (item.top < minTop) {
                    item.top = minTop;
                }
                lastTop = item.top;
            }
        }

        return items;
    }, [sectionData, pageMetrics, activeSplit, splitToolbarHeight, activeSectionId]);

    return (
        <div className="relative grow self-stretch w-34 flex flex-col items-end justify-end z-10">
            {sidebarItems.length === 0 && sectionData.length > 0 && (
                <div className="flex items-center justify-center w-full py-4">
                    <div className="text-xs text-gray-400 animate-pulse">Loading sections...</div>
                </div>
            )}
            {sidebarItems.map((section) => {
                const isSelected = section.id === activeSectionId;
                const partial = isPartialSection(section);
                return (
                    <div
                        key={section.id}
                        className="absolute"
                        style={{
                            top: section.top,
                            transform: `translateX(-${isSelected ? 2 : 0}px)`,
                        }}
                    >
                        <div
                            onClick={() => setActiveSectionId(section.id)}
                            className={cn(
                                "border rounded h-7 w-32 cursor-pointer transition-all duration-300 border-r-0 rounded-r-none pl-2",
                                getStateClasses(section.state, isSelected, partial),
                            )}
                        >
                            <span className="text-xs w-full font">
                                {SECTION_TYPE_OPTIONS.find((option) => option.value === section.sectionType)?.label || section.sectionType || "Unknown type"}
                            </span>
                        </div>
                        {section.state === "error" && onRetrySection && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onRetrySection(section.id); }}
                                className="mt-0.5 w-32 rounded rounded-r-none border border-r-0 border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                                Retry extraction
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export {
    SectionBar
}
