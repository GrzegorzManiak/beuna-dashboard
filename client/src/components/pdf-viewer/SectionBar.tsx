import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    PAGE_DIVIDER_HEIGHT,
    SELECTION_OFFSET,
    SIDEBAR_CARD_GAP,
    SIDEBAR_CARD_HEIGHT,
} from "./constants";
import type { ActiveSplit, PageMetrics, SectionData } from "./types";

type SectionBarProps = {
    sectionData: Array<SectionData>;
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    activeSectionId: string | null;
    setActiveSectionId: (id: string | null) => void;
};

function SectionBar({
    sectionData,
    pageMetrics,
    activeSplit,
    splitToolbarHeight,
    activeSectionId,
    setActiveSectionId,
}: SectionBarProps) {
    const getStateClasses = (state: SectionData["state"], isSelected: boolean) => {
        switch (state) {
            case "valid":
                return isSelected
                    ? "border-emerald-500 bg-emerald-500/40 z-10 scale-105"
                    : "border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30";
            case "needs_review":
                return isSelected
                    ? "border-amber-500 bg-amber-500/40 z-10 scale-105"
                    : "border-amber-500 bg-amber-500/20 hover:bg-amber-500/30";
            case "conflict":
                return isSelected
                    ? "border-red-500 bg-red-500/40 z-10 scale-105"
                    : "border-red-500 bg-red-500/20 hover:bg-red-500/30";
            case "processing":
                return isSelected
                    ? "border-amber-500 bg-amber-500/40 z-10 scale-105 animate-pulse"
                    : "border-amber-400 bg-amber-400/20 hover:bg-amber-400/30 animate-pulse";
            case "identifying":
                return isSelected
                    ? "border-indigo-500 bg-indigo-500/40 z-10 scale-105 animate-pulse"
                    : "border-indigo-400 bg-indigo-400/20 hover:bg-indigo-400/30 animate-pulse";
            case "unknown":
            default:
                return isSelected
                    ? "border-blue-500 bg-blue-500/40 z-10 scale-105"
                    : "border-blue-500 bg-blue-500/20 hover:bg-blue-500/30";
        }
    };

    const sidebarItems = useMemo(() => {
        const items = sectionData
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
        <div className="relative w-full grow self-stretch max-w-60 flex flex-col items-start justify-start z-10">
            {sidebarItems.map((section) => {
                const isSelected = section.id === activeSectionId;
                return (
                    <div
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        
                        className={cn(
                            "border rounded absolute h-8 w-27 cursor-pointer transition-all duration-300 border-l-0 rounded-l-none pl-2",
                            getStateClasses(section.state, isSelected),
                        )}
                        style={{ 
                            top: section.top,
                            transform: ``,
                        }}
                    >
                        <span className="text-xs p-1 w-full">{section.id}</span>
                        {/* {isSelected && (
                            <div
                                className="absolute top-1/2 left-full h-0.5 bg-blue-600 pointer-events-none"
                                style={{
                                    width: section.scaledX,
                                    zIndex: -1
                                }}
                            />
                        )} */}
                    </div>
                );
            })}
        </div>
    );
}

export {
    SectionBar
}
