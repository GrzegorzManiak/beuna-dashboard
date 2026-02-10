import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { MIN_SELECTION_PX, PAGE_DIVIDER_HEIGHT } from "./constants";
import type {
    ActiveSplit,
    DragSelection,
    DragSelectionResult,
    DragTextRect,
    PageMetrics,
    SelectionRect,
    TextMatch,
} from "./types";
import { clamp } from "./utils";

type PdfDragSelectionLayerProps = {
    enabled: boolean;
    textWrappingEnabled?: boolean;
    pages: number[];
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    pageContainerRef: RefObject<HTMLDivElement | null>;
    onSelectionComplete?: (result: DragSelectionResult) => void;
};

function PdfDragSelectionLayer({
    enabled,
    textWrappingEnabled,
    pages,
    pageMetrics,
    activeSplit,
    splitToolbarHeight,
    pageContainerRef,
    onSelectionComplete,
}: PdfDragSelectionLayerProps) {
    const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
    const [dragTextRects, setDragTextRects] = useState<DragTextRect[]>([]);

    useEffect(() => {
        if (!enabled) {
            setDragSelection(null);
            setDragTextRects([]);
        }
    }, [enabled]);

    const pageOffsets = useMemo(() => {
        const offsets: Record<number, number> = {};
        let cursor = 0;

        pages.forEach((page) => {
            const metrics = pageMetrics[page];
            if (!metrics) return;
            cursor += PAGE_DIVIDER_HEIGHT;
            offsets[page] = cursor;
            cursor += metrics.height;
            if (activeSplit?.pageNumber === page) cursor += splitToolbarHeight;
        });

        return offsets;
    }, [pages, pageMetrics, activeSplit, splitToolbarHeight]);

    const getPageWidthPx = useCallback(
        (page: number) => {
            const metrics = pageMetrics[page];
            if (!metrics) return null;
            return metrics.originalWidth * metrics.scale;
        },
        [pageMetrics],
    );

    const getLocalYForPage = useCallback(
        (page: number, yInContainer: number) => {
            const metrics = pageMetrics[page];
            if (!metrics) return null;
            const pageHeight = metrics.height;
            const offset = pageOffsets[page] ?? 0;
            let localY = yInContainer - offset;

            if (activeSplit?.pageNumber === page) {
                const splitY = Math.round(pageHeight * activeSplit.splitRatio);
                if (localY >= splitY && localY <= splitY + splitToolbarHeight) {
                    localY = splitY;
                } else if (localY > splitY + splitToolbarHeight) {
                    localY -= splitToolbarHeight;
                }
            }

            return clamp(localY, 0, pageHeight);
        },
        [activeSplit, pageMetrics, pageOffsets, splitToolbarHeight],
    );

    const getContainerYFromLocal = useCallback(
        (page: number, localY: number) => {
            const metrics = pageMetrics[page];
            if (!metrics) return null;
            const offset = pageOffsets[page] ?? 0;
            const pageHeight = metrics.height;
            let containerY = localY;

            if (activeSplit?.pageNumber === page) {
                const splitY = Math.round(pageHeight * activeSplit.splitRatio);
                if (localY >= splitY) containerY += splitToolbarHeight;
            }

            return offset + containerY;
        },
        [activeSplit, pageMetrics, pageOffsets, splitToolbarHeight],
    );

    const resolvePageFromY = useCallback(
        (yInContainer: number) => {
            for (const page of pages) {
                const metrics = pageMetrics[page];
                if (!metrics) continue;
                const offset = pageOffsets[page];
                if (offset === undefined) continue;
                const totalHeight =
                    metrics.height + (activeSplit?.pageNumber === page ? splitToolbarHeight : 0);
                if (yInContainer >= offset && yInContainer <= offset + totalHeight) {
                    return page;
                }
            }
            return null;
        },
        [activeSplit, pageMetrics, pageOffsets, pages, splitToolbarHeight],
    );

    const getLocalPointForPage = useCallback(
        (page: number, clientX: number, clientY: number) => {
            const container = pageContainerRef.current;
            if (!container) return null;
            const metrics = pageMetrics[page];
            if (!metrics) return null;
            const rect = container.getBoundingClientRect();
            const pageWidthPx = getPageWidthPx(page);
            if (!pageWidthPx) return null;

            const x = clamp(clientX - rect.left, 0, pageWidthPx);
            const yInContainer = clientY - rect.top;
            const localY = getLocalYForPage(page, yInContainer);
            if (localY === null) return null;

            return { x, y: localY, yInContainer };
        },
        [getLocalYForPage, getPageWidthPx, pageContainerRef, pageMetrics],
    );

    const getSelectionRect = useCallback(
        (selection: DragSelection): SelectionRect | null => {
            const startTop = getContainerYFromLocal(selection.page, selection.startY);
            const endTop = getContainerYFromLocal(selection.page, selection.currentY);
            if (startTop === null || endTop === null) return null;

            const left = Math.min(selection.startX, selection.currentX);
            const top = Math.min(startTop, endTop);
            const width = Math.abs(selection.startX - selection.currentX);
            const height = Math.abs(startTop - endTop);
            const localCenterY = (selection.startY + selection.currentY) / 2;

            return { left, top, width, height, localCenterY };
        },
        [getContainerYFromLocal],
    );

    const getSelectionSlice = useCallback(
        (page: number, localCenterY: number) => {
            const pageHeight = pageMetrics[page]?.height ?? 0;
            if (!pageHeight) return "bottom";
            const splitY =
                activeSplit?.pageNumber === page && pageHeight > 0
                    ? Math.round(pageHeight * activeSplit.splitRatio)
                    : null;
            if (splitY === null) return "bottom";
            return localCenterY >= splitY ? "bottom" : "top";
        },
        [activeSplit, pageMetrics],
    );

    const shouldSelectWholeWords = () => {
        if (typeof window === "undefined") return true;
        const flag = (window as Window & { __PDF_SELECT_WHOLE_WORDS__?: boolean })
            .__PDF_SELECT_WHOLE_WORDS__;
        return flag ?? true;
    };

    const expandToWordBounds = (text: string, start: number, end: number) => {
        let left = start;
        let right = end;
        if (!text.length) return { start, end };

        while (left > 0 && !/\s/.test(text[left - 1])) left -= 1;
        while (right < text.length && !/\s/.test(text[right])) right += 1;

        return { start: left, end: right };
    };

    const getSpansForRect = useCallback(
        (page: number, rect: SelectionRect): TextMatch[] => {
            const container = pageContainerRef.current;
            if (!container) return [];
            const slice = getSelectionSlice(page, rect.localCenterY);
            const spans = Array.from(
                container.querySelectorAll(
                    `[data-page-number="${page}"][data-slice="${slice}"] .textLayer span`,
                ),
            ) as HTMLSpanElement[];
            const containerRect = container.getBoundingClientRect();

            return spans
                .map((span) => {
                    const rectSpan = span.getBoundingClientRect();
                    const left = rectSpan.left - containerRect.left;
                    const top = rectSpan.top - containerRect.top;
                    const width = rectSpan.width;
                    const height = rectSpan.height;
                    const xOverlap =
                        Math.min(rect.left + rect.width, left + width) - Math.max(rect.left, left);
                    const yOverlap =
                        Math.min(rect.top + rect.height, top + height) - Math.max(rect.top, top);

                    return {
                        span,
                        text: span.textContent ?? "",
                        left,
                        top,
                        width,
                        height,
                        xOverlap,
                        yOverlap,
                    };
                })
                .filter((item) => {
                    if (!item.text.trim()) return false;
                    return item.xOverlap > 0 && item.yOverlap > 0;
                })
                .map((item) => {
                    const intersectionLeft = Math.max(rect.left, item.left);
                    const intersectionRight = Math.min(rect.left + rect.width, item.left + item.width);

                    let textSlice = item.text;
                    let highlightLeft = intersectionLeft;
                    let highlightRight = intersectionRight;
                    let startIndex = 0;
                    let endIndex = item.text.length;

                    if (item.width > 0 && item.text.length > 0) {
                        const startRatio = (intersectionLeft - item.left) / item.width;
                        const endRatio = (intersectionRight - item.left) / item.width;
                        startIndex = Math.max(
                            0,
                            Math.min(item.text.length, Math.floor(startRatio * item.text.length)),
                        );
                        endIndex = Math.max(
                            startIndex,
                            Math.min(item.text.length, Math.ceil(endRatio * item.text.length)),
                        );

                        if (shouldSelectWholeWords()) {
                            const expanded = expandToWordBounds(item.text, startIndex, endIndex);
                            startIndex = expanded.start;
                            endIndex = expanded.end;
                        }

                        textSlice = item.text.slice(startIndex, endIndex);
                        highlightLeft = item.left + (startIndex / item.text.length) * item.width;
                        highlightRight = item.left + (endIndex / item.text.length) * item.width;
                    }

                    const finalWidth = Math.max(0, highlightRight - highlightLeft);

                    return {
                        textSlice,
                        left: item.left,
                        top: item.top,
                        width: item.width,
                        height: item.height,
                        intersectionLeft: highlightLeft,
                        intersectionTop: item.top,
                        intersectionWidth: finalWidth,
                        intersectionHeight: item.height,
                    };
                });
        },
        [getSelectionSlice, pageContainerRef],
    );

    const handleDragStart = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!enabled) return;
            if (event.button !== 0) return;
            const container = pageContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const yInContainer = event.clientY - rect.top;
            const page = resolvePageFromY(yInContainer);
            if (!page) return;
            const point = getLocalPointForPage(page, event.clientX, event.clientY);
            if (!point) return;

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const selection: DragSelection = {
                page,
                startX: point.x,
                startY: point.y,
                currentX: point.x,
                currentY: point.y,
            };
            setDragSelection(selection);
            const selectionRect = getSelectionRect(selection);
            if (!selectionRect) return;
            const matches = getSpansForRect(selection.page, selectionRect);
            setDragTextRects(
                matches
                    .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
                    .map((item) => ({
                        left: item.intersectionLeft,
                        top: item.intersectionTop,
                        width: item.intersectionWidth,
                        height: item.intersectionHeight,
                    })),
            );
        },
        [
            enabled,
            getLocalPointForPage,
            getSelectionRect,
            getSpansForRect,
            pageContainerRef,
            resolvePageFromY,
        ],
    );

    const handleDragMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragSelection) return;
            const point = getLocalPointForPage(
                dragSelection.page,
                event.clientX,
                event.clientY,
            );
            if (!point) return;
            const nextSelection = {
                ...dragSelection,
                currentX: point.x,
                currentY: point.y,
            };
            setDragSelection(nextSelection);
            const rect = getSelectionRect(nextSelection);
            if (!rect) return;
            const matches = getSpansForRect(nextSelection.page, rect);
            setDragTextRects(
                matches
                    .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
                    .map((item) => ({
                        left: item.intersectionLeft,
                        top: item.intersectionTop,
                        width: item.intersectionWidth,
                        height: item.intersectionHeight,
                    })),
            );
        },
        [dragSelection, getLocalPointForPage, getSelectionRect, getSpansForRect],
    );

    const handleDragEnd = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragSelection) return;
            const point = getLocalPointForPage(
                dragSelection.page,
                event.clientX,
                event.clientY,
            );
            const finalX = point?.x ?? dragSelection.currentX;
            const finalY = point?.y ?? dragSelection.currentY;

            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragSelection(null);
            setDragTextRects([]);

            const x = Math.min(dragSelection.startX, finalX);
            const y = Math.min(dragSelection.startY, finalY);
            const width = Math.abs(dragSelection.startX - finalX);
            const height = Math.abs(dragSelection.startY - finalY);

            if (width < MIN_SELECTION_PX || height < MIN_SELECTION_PX) return;

            const metrics = pageMetrics[dragSelection.page];
            if (!metrics) return;
            const pageWidthPx = getPageWidthPx(dragSelection.page);
            if (!pageWidthPx) return;

            // Normalize back to original PDF coordinates
            const scale = metrics.scale;

            const selection: DragSelection = {
                page: dragSelection.page,
                startX: dragSelection.startX,
                startY: dragSelection.startY,
                currentX: finalX,
                currentY: finalY,
            };
            const rect = getSelectionRect(selection);
            const matches = rect ? getSpansForRect(selection.page, rect) : [];
            const selectedText = matches
                .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
                .map((item) => item.textSlice)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            const textRects = matches
                .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
                .map((item) => ({
                    left: item.intersectionLeft,
                    top: item.intersectionTop,
                    width: item.intersectionWidth,
                    height: item.intersectionHeight,
                }));

            // --- Text Wrapping Logic ---
            let finalRectX = x;
            let finalRectY = y;
            let finalRectWidth = width;
            let finalRectHeight = height;

            if (textWrappingEnabled && textRects.length > 0) {
                const PADDING = 3;
                let minCLeft = Infinity;
                let minCTop = Infinity;
                let maxCRight = -Infinity;
                let maxCBottom = -Infinity;

                textRects.forEach((r) => {
                    minCLeft = Math.min(minCLeft, r.left);
                    minCTop = Math.min(minCTop, r.top);
                    maxCRight = Math.max(maxCRight, r.left + r.width);
                    maxCBottom = Math.max(maxCBottom, r.top + r.height);
                });

                // Apply Padding
                minCLeft = Math.max(0, minCLeft - PADDING);
                minCTop = Math.max(0, minCTop - PADDING);
                maxCRight += PADDING;
                maxCBottom += PADDING;

                // X is same in local/container if we assume pages are full width & aligned left=0
                // Y needs conversion: Container -> Local
                const localYTop = getLocalYForPage(dragSelection.page, minCTop);
                const localYBottom = getLocalYForPage(dragSelection.page, maxCBottom);

                if (localYTop !== null && localYBottom !== null) {
                    finalRectX = minCLeft;
                    finalRectY = localYTop;
                    finalRectWidth = maxCRight - minCLeft;
                    finalRectHeight = localYBottom - localYTop;
                }
            }
            // ---------------------------

            onSelectionComplete?.({
                page: dragSelection.page,
                // Return normalized coordinates (original PDF / unscaled)
                rect: { 
                    x: finalRectX / scale, 
                    y: finalRectY / scale, 
                    width: finalRectWidth / scale, 
                    height: finalRectHeight / scale 
                },
                ratios: {
                    x: finalRectX / pageWidthPx,
                    y: finalRectY / metrics.height,
                    width: finalRectWidth / pageWidthPx,
                    height: finalRectHeight / metrics.height,
                },
                text: selectedText,
                textRects,
            });
        },
        [
            dragSelection,
            getLocalPointForPage,
            getPageWidthPx,
            getSelectionRect,
            getSpansForRect,
            onSelectionComplete,
            pageMetrics,
        ],
    );

    const dragBox = useMemo(() => {
        if (!dragSelection) return null;
        const rect = getSelectionRect(dragSelection);
        if (!rect) return null;
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }, [dragSelection, getSelectionRect]);

    if (!enabled) return null;

    return (
        <div
            className="absolute inset-0 z-10 cursor-crosshair"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
        >
            {dragTextRects.map((rect, index) => (
                <div
                    key={`drag-text-${index}`}
                    className="pointer-events-none absolute rounded-sm bg-blue-500/25 ring-1 ring-blue-500/20 mix-blend-multiply"
                    style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                    }}
                />
            ))}
            {dragBox ? (
                <div
                    className="absolute rounded-lg border border-blue-500/70 bg-blue-500/20 ring-1 ring-blue-500/30 mix-blend-multiply"
                    style={{
                        left: dragBox.left,
                        top: dragBox.top,
                        width: dragBox.width,
                        height: dragBox.height,
                    }}
                />
            ) : null}
        </div>
    );
}

export { 
    PdfDragSelectionLayer 
};
