import type { ActiveSplit, PageMetrics, SectionData, SectionBox } from "./pdfViewer.types";
import { REQUIRED_FIELDS } from "@shared/section-types";
import type { SectionType as SharedSectionType } from "@shared/section-types";

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

/**
 * THE GATE - Normalizes all section boxes (from server or user) to proper multi-page format.
 *
 * Rules for multi-page sections:
 * - First page: y stays, height expands to bottom of page
 * - Middle pages: y=0, height=full page height
 * - Last page: y=0, height comes from the vacuum-sealed box (actual text height)
 * - All pages: same x position and width (use maximum width)
 *
 * @param section - The section data with textPosition
 * @param pageMetrics - Page metrics to get original dimensions
 * @returns Normalized SectionData with proper boxes array
 */
function normalizeSectionBoxes(
    section: SectionData,
    pageMetrics: Record<number, PageMetrics> ){
    const { textPosition } = section;
    const pages = textPosition.page;

    // Single page - return as-is
    if (pages.length <= 1) return section;


    // Already has boxes - normalize them
    if (textPosition.boxes && textPosition.boxes.length > 0) {
        const normalizedBoxes: SectionBox[] = [];
        const firstPage = pages[0];
        const lastPage = pages[pages.length - 1];

        // Find max width across all boxes
        let minX = Infinity;
        let maxWidth = 0;
        for (const box of textPosition.boxes) {
            if (box.x < minX) minX = box.x;
            if (box.width > maxWidth) maxWidth = box.width;
        }

        for (const page of pages) {
            const existingBox = textPosition.boxes.find(b => b.page === page);
            const metrics = pageMetrics[page];
            if (!metrics) continue;

            const pageHeight = metrics.originalHeight;

            if (page === firstPage && page === lastPage) {
                // Single page
                normalizedBoxes.push(existingBox || {
                    page,
                    x: minX,
                    y: textPosition.y,
                    width: maxWidth,
                    height: textPosition.height,
                });
            } else if (page === firstPage) {
                // First page: y stays, expand to bottom
                const boxY = existingBox?.y ?? textPosition.y;
                normalizedBoxes.push({
                    page,
                    x: minX,
                    y: boxY,
                    width: maxWidth,
                    height: pageHeight - boxY,
                });
            } else if (page === lastPage) {
                // Last page: y=0, height extends to the bottom of the text (box.y + box.height)
                const box = existingBox;
                const textBottom = box ? (box.y + box.height) : pageHeight;
                normalizedBoxes.push({
                    page,
                    x: minX,
                    y: 0,
                    width: maxWidth,
                    height: textBottom,
                });
            } else {
                // Middle pages: full height from top to bottom
                normalizedBoxes.push({
                    page,
                    x: minX,
                    y: 0,
                    width: maxWidth,
                    height: pageHeight,
                });
            }
        }

        // Freeze each box and the array to prevent downstream mutation
        const frozenBoxes = normalizedBoxes.map(b => Object.freeze({ ...b }));
        Object.freeze(frozenBoxes);

        const frozenTextPosition = Object.freeze({ ...textPosition, boxes: frozenBoxes });
        const frozenSection = Object.freeze({ ...section, textPosition: frozenTextPosition });
        return frozenSection;
    }

    // No boxes yet - create them from textPosition
    const normalizedBoxes: SectionBox[] = [];
    const firstPage = pages[0];
    const lastPage = pages[pages.length - 1];
    const x = textPosition.x;
    const width = textPosition.width;

    for (const page of pages) {
        const metrics = pageMetrics[page];
        if (!metrics) continue;

        const pageHeight = metrics.originalHeight;

        if (page === firstPage && page === lastPage) {
            // Single page
            normalizedBoxes.push({
                page,
                x,
                y: textPosition.y,
                width,
                height: textPosition.height,
            });
        } else if (page === firstPage) {
            // First page: expand to bottom
            normalizedBoxes.push({
                page,
                x,
                y: textPosition.y,
                width,
                height: pageHeight - textPosition.y,
            });
        } else if (page === lastPage) {
            // Last page: expand from top
            // Need to calculate remaining height
            let heightUsed = 0;
            // First page consumed height
            const firstMetrics = pageMetrics[firstPage];
            if (firstMetrics) {
                heightUsed = firstMetrics.originalHeight - textPosition.y;
            }
            // Middle pages consumed full height
            for (let p = firstPage + 1; p < lastPage; p++) {
                const m = pageMetrics[p];
                if (m) heightUsed += m.originalHeight;
            }
            const remainingHeight = textPosition.height - heightUsed;
            normalizedBoxes.push({
                page,
                x,
                y: 0,
                width,
                height: Math.max(0, remainingHeight),
            });
        } else {
            // Middle pages: full height
            normalizedBoxes.push({
                page,
                x,
                y: 0,
                width,
                height: pageHeight,
            });
        }
    }

    // Freeze each box and the array to prevent downstream mutation
    const frozenBoxes = normalizedBoxes.map(b => Object.freeze({ ...b }));
    Object.freeze(frozenBoxes);

    const frozenTextPosition = Object.freeze({ ...textPosition, boxes: frozenBoxes });
    const frozenSection = Object.freeze({ ...section, textPosition: frozenTextPosition });
    return frozenSection;
}

/** Check if a section is partially extracted (needs_review but missing required fields). */
function computeIsPartial(section: SectionData ){
    if (section.state !== "needs_review") return false;
    const reqKeys = REQUIRED_FIELDS[section.sectionType as SharedSectionType] ?? [];
    if (!reqKeys.length) return false;
    for (const key of reqKeys) {
        const val = section.fields?.[key];
        if (val === null || val === undefined || val === "") return true;
    }
    return false;
}

function calculateSectionStyle(
    pageNumber: number,
    section: SectionData,
    pageMetrics: Record<number, PageMetrics>, ){
    // Normalize boxes first (THE GATE)
    const normalizedSection = normalizeSectionBoxes(section, pageMetrics);

    const metrics = pageMetrics[pageNumber];
    const scale = metrics?.scale || 1;
    const pages = normalizedSection.textPosition.page;
    const boxes = normalizedSection.textPosition.boxes;

    const isPartial = computeIsPartial(section);

    if (boxes && boxes.length) {
        const box = boxes.find((entry) => entry.page === pageNumber);
        if (!box) {
            return {
                id: section.id,
                state: section.state,
                sectionType: section.sectionType,
                isPartial,
                hasTopBorder: false,
                hasBottomBorder: false,
                style: {
                    left: 0,
                    top: 0,
                    width: 0,
                    height: 0,
                },
            };
        }

        return {
            id: section.id,
            state: section.state,
            sectionType: section.sectionType,
            isPartial,
            hasTopBorder: pageNumber === pages[0],
            hasBottomBorder: pageNumber === pages[pages.length - 1],
            style: {
                left: box.x * scale,
                top: box.y * scale,
                width: box.width * scale,
                height: box.height * scale,
            },
        };
    }

    // Fallback for single-page without boxes
    return {
        id: section.id,
        state: section.state,
        sectionType: section.sectionType,
        isPartial,
        hasTopBorder: true,
        hasBottomBorder: true,
        style: {
            left: section.textPosition.x * scale,
            top: section.textPosition.y * scale,
            width: section.textPosition.width * scale,
            height: section.textPosition.height * scale,
        },
    };
}

function handleAutoSplit(
    sectionId: string | null,
    sections: SectionData[],
    pageMetrics: Record<number, PageMetrics>,
    setActiveSplit: (split: ActiveSplit) => void ){
    if (!sectionId) return;

    const section = sections.find((s) => s.id === sectionId);
    if (section && section.textPosition.page.length > 0) {
        // Use the last page the section appears on so the toolbar opens below it.
        const pages = section.textPosition.page;
        const lastPage = pages[pages.length - 1];
        const metrics = pageMetrics[lastPage];
        if (metrics) {
            // Prefer the per-page box if available, otherwise fall back to
            // the top-level bounding box (which may span multiple pages).
            const box = section.textPosition.boxes?.find((b) => b.page === lastPage);
            const y = box ? box.y : section.textPosition.y;
            const h = box ? box.height : section.textPosition.height;

            const splitRatio = (y + h) / metrics.originalHeight;
            setActiveSplit({ pageNumber: lastPage, splitRatio: Math.min(splitRatio, 1) });

            // Basic scroll into view logic (optional, for better UX)
            // Scroll to the split toolbar after a short delay to allow it to render
            setTimeout(() => {
                const splitElement = document.getElementById('pdf-split-toolbar');
                if (splitElement) splitElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else {
                    const element = document.querySelector(`[data-page-number="${lastPage}"]`);
                    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                }
            }, 100);
        }
    }
}

export {
    calculateSectionStyle,
    clamp,
    handleAutoSplit,
    normalizeSectionBoxes,
}
