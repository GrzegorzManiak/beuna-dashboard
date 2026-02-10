import type { ActiveSplit, PageMetrics, RenderedSection, SectionData } from "./types";

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function calculateSectionStyle(
    pageNumber: number,
    section: SectionData,
    pageMetrics: Record<number, PageMetrics>,
): RenderedSection {
    const metrics = pageMetrics[pageNumber];
    const scale = metrics?.scale || 1;
    const pages = section.textPosition.page;
    const boxes = section.textPosition.boxes;
    if (boxes && boxes.length) {
        const box = boxes.find((entry) => entry.page === pageNumber);
        if (!box) {
            return {
                id: section.id,
                state: section.state,
                sectionType: section.sectionType,
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
        state: section.state,
        sectionType: section.sectionType,
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

function handleAutoSplit(
    sectionId: string | null,
    sections: SectionData[],
    pageMetrics: Record<number, PageMetrics>,
    setActiveSplit: (split: ActiveSplit) => void
) {
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
                    const element = document.querySelector(`[data-page-number="${pageNumber}"]`);
                    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                }
            }, 100);
        }
    }
}

export {
    clamp,
    calculateSectionStyle,
    handleAutoSplit,
}
