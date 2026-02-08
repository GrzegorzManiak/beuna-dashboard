import type { PageMetrics, RenderedSection, SectionData } from "./types";

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function calculateSectionStyle(
    pageNumber: number,
    section: SectionData,
    pageMetrics: Record<number, PageMetrics>,
): RenderedSection {
    const metrics = pageMetrics[pageNumber];
    const scale = metrics?.scale || 1;
    const startPage = section.textPosition.page[0];
    const startPageMetrics = pageMetrics[startPage];
    const startPageScale = startPageMetrics?.scale || scale;

    const sectionRect = {
        left: section.textPosition.x * startPageScale,
        width: section.textPosition.width * startPageScale,
        top: 0,
        height: 0,
        hasTopBorder: pageNumber === startPage,
        hasBottomBorder: pageNumber === section.textPosition.page[section.textPosition.page.length - 1],
    };

    // Logic to calculate top/height for multi-page spanning
    if (pageNumber === startPage) {
        sectionRect.top = section.textPosition.y * scale;

        // Simple case: height is rest of section
        // For multi-page, on the first page, we take all the height
        // until the bottom of the page.
        const pageOriginalHeight = metrics?.originalHeight || 0;
        const availableHeight = Math.max(0, pageOriginalHeight - section.textPosition.y);

        // If height is small enough to fit on page, use it.
        // Otherwise take available space.
        const unscaledHeight = Math.min(section.textPosition.height, availableHeight);
        sectionRect.height = unscaledHeight * scale;
    } else {
        // Subsequent pages
        sectionRect.top = 0; // Starts at top

        let remainingHeight = section.textPosition.height;

        // Subtract height consumed by previous pages
        let currentPage = startPage;
        while (currentPage < pageNumber) {
            const m = pageMetrics[currentPage];
            if (m) {
                if (currentPage === startPage) {
                    const consumed = Math.max(0, m.originalHeight - section.textPosition.y);
                    remainingHeight -= consumed;
                } else remainingHeight -= m.originalHeight;
            }
            currentPage++;
        }

        // On this page, we take remaining height or full page height
        const pageOriginalHeight = metrics?.originalHeight || 0;
        const unscaledHeight = Math.min(Math.max(0, remainingHeight), pageOriginalHeight);

        // If remaining height is <= 0 (metrics might be missing or logic off), hide it
        if (remainingHeight <= 0) sectionRect.height = 0;
        else sectionRect.height = unscaledHeight * scale;
    }

    return {
        id: section.id,
        hasTopBorder: sectionRect.hasTopBorder,
        hasBottomBorder: sectionRect.hasBottomBorder,
        style: {
            left: sectionRect.left,
            top: sectionRect.top,
            width: sectionRect.width,
            height: sectionRect.height,
        },
    };
}

export {
    calculateSectionStyle,
    clamp
}
