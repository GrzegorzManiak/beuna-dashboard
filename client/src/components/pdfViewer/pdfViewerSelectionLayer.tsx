import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { MIN_SELECTION_PX, PAGE_DIVIDER_HEIGHT } from "./pdfViewer.constants";
import type {
    ActiveSplit,
    DragSelection,
    DragSelectionResult,
    DragTextRect,
    PageMetrics,
    SelectionRect,
    TextMatch,
} from "./pdfViewer.types";
import { clamp } from "./pdfViewer.utils";

type PdfViewerSelectionLayerProps = {
    enabled: boolean;
    pages: number[];
    pageMetrics: Record<number, PageMetrics>;
    activeSplit: ActiveSplit;
    splitToolbarHeight: number;
    pageContainerRef: RefObject<HTMLDivElement | null>;
    onSelectionComplete?: (result: DragSelectionResult) => void;
};

type MultiPageDragBox = {
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
};

function PdfViewerSelectionLayer({
    enabled,
    pages,
    pageMetrics,
    activeSplit,
    splitToolbarHeight,
    pageContainerRef,
    onSelectionComplete,
}: PdfViewerSelectionLayerProps){
    const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
    const [dragTextRects, setDragTextRects] = useState<DragTextRect[]>([]);
    const [dragBoxes, setDragBoxes] = useState<MultiPageDragBox[]>([]);

    useEffect(() => {
        if (!enabled) {
            setDragSelection(null);
            setDragTextRects([]);
            setDragBoxes([]);
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

    const getMultiPageSelectionBoxes = useCallback(
        (selection: DragSelection): MultiPageDragBox[] => {
            const container = pageContainerRef.current;
            if (!container) return [];

            const startPage = Math.min(selection.startPage, selection.endPage);
            const endPage = Math.max(selection.startPage, selection.endPage);
            const x = Math.min(selection.startX, selection.currentX);
            const width = Math.abs(selection.startX - selection.currentX);
            const pageWidthPx = getPageWidthPx(startPage);

            if (!pageWidthPx) return [];

            const boxes: MultiPageDragBox[] = [];

            const startContainerY = getContainerYFromLocal(selection.startPage, selection.startY);
            const endContainerY = getContainerYFromLocal(selection.endPage, selection.currentY);

            if (startContainerY === null || endContainerY === null) return [];

            const topY = Math.min(startContainerY, endContainerY);
            const bottomY = Math.max(startContainerY, endContainerY);

            for (let page = startPage; page <= endPage; page++) {
                const metrics = pageMetrics[page];
                if (!metrics) continue;
                const offset = pageOffsets[page];
                if (offset === undefined) continue;

                const pageTop = offset;
                const pageHeight = metrics.height;
                const pageBottom = offset + pageHeight;

                const boxTop = Math.max(pageTop, topY);
                const boxBottom = Math.min(pageBottom, bottomY);

                if (boxTop < boxBottom) {
                    boxes.push({
                        page,
                        left: x,
                        top: boxTop,
                        width,
                        height: boxBottom - boxTop,
                    });
                }
            }

            return boxes;
        },
        [pageContainerRef, pageMetrics, pageOffsets, getContainerYFromLocal, getPageWidthPx],
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
                startPage: page,
                endPage: page,
                startX: point.x,
                startY: point.y,
                currentX: point.x,
                currentY: point.y,
            };
            setDragSelection(selection);
        },
        [
            enabled,
            getLocalPointForPage,
            pageContainerRef,
            resolvePageFromY,
        ],
    );

    const handleDragMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragSelection) return;

            const container = pageContainerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const yInContainer = event.clientY - rect.top;
            const currentPage = resolvePageFromY(yInContainer);

            if (!currentPage) return;

            const point = getLocalPointForPage(currentPage, event.clientX, event.clientY);
            if (!point) return;

            const nextSelection: DragSelection = {
                ...dragSelection,
                endPage: currentPage,
                currentX: point.x,
                currentY: point.y,
            };

            setDragSelection(nextSelection);

            const boxes = getMultiPageSelectionBoxes(nextSelection);
            setDragBoxes(boxes);

            const allTextRects: DragTextRect[] = [];
            const startPage = Math.min(nextSelection.startPage, nextSelection.endPage);
            const endPage = Math.max(nextSelection.startPage, nextSelection.endPage);

            for (let page = startPage; page <= endPage; page++) {
                const pageMetricsEntry = pageMetrics[page];
                if (!pageMetricsEntry) continue;

                const pageOffset = pageOffsets[page];
                if (pageOffset === undefined) continue;

                const box = boxes.find((b) => b.page === page);
                if (!box) continue;

                const localTop = getLocalYForPage(page, box.top);
                const localBottom = getLocalYForPage(page, box.top + box.height);

                if (localTop === null || localBottom === null) continue;

                const selectionRect: SelectionRect = {
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    localCenterY: (localTop + localBottom) / 2,
                };

                const matches = getSpansForRect(page, selectionRect);
                const textRects = matches
                    .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
                    .map((item) => ({
                        left: item.intersectionLeft,
                        top: item.intersectionTop,
                        width: item.intersectionWidth,
                        height: item.intersectionHeight,
                    }));

                allTextRects.push(...textRects);
            }

            setDragTextRects(allTextRects);
        },
        [
            dragSelection,
            getLocalPointForPage,
            getMultiPageSelectionBoxes,
            getSpansForRect,
            pageContainerRef,
            pageMetrics,
            pageOffsets,
            resolvePageFromY,
            getLocalYForPage,
        ],
    );

    const handleDragEnd = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!dragSelection) return;

            event.currentTarget.releasePointerCapture(event.pointerId);

            const finalSelection = dragSelection;
            setDragSelection(null);
            setDragBoxes([]);
            setDragTextRects([]);

            const startPage = Math.min(finalSelection.startPage, finalSelection.endPage);
            const endPage = Math.max(finalSelection.startPage, finalSelection.endPage);

            const x = Math.min(finalSelection.startX, finalSelection.currentX);
            const width = Math.abs(finalSelection.startX - finalSelection.currentX);

            if (width < MIN_SELECTION_PX) return;

            const textMatchesByPage = new Map<number, TextMatch[]>();
            const allTextMatches: TextMatch[] = [];

            for (let page = startPage; page <= endPage; page++) {
                const metrics = pageMetrics[page];
                if (!metrics) continue;

                let localYStart: number;
                let localYEnd: number;

                if (page === finalSelection.startPage && page === finalSelection.endPage) {
                    localYStart = Math.min(finalSelection.startY, finalSelection.currentY);
                    localYEnd = Math.max(finalSelection.startY, finalSelection.currentY);
                } else if (page === finalSelection.startPage) {
                    localYStart = finalSelection.startPage < finalSelection.endPage
                        ? finalSelection.startY
                        : finalSelection.currentY;
                    localYEnd = metrics.height;
                } else if (page === finalSelection.endPage) {
                    localYStart = 0;
                    localYEnd = finalSelection.startPage < finalSelection.endPage
                        ? finalSelection.currentY
                        : finalSelection.startY;
                } else {
                    localYStart = 0;
                    localYEnd = metrics.height;
                }

                const containerYStart = getContainerYFromLocal(page, localYStart);
                const containerYEnd = getContainerYFromLocal(page, localYEnd);

                if (containerYStart === null || containerYEnd === null) continue;

                const selectionRect: SelectionRect = {
                    left: x,
                    top: containerYStart,
                    width,
                    height: containerYEnd - containerYStart,
                    localCenterY: (localYStart + localYEnd) / 2,
                };

                const matches = getSpansForRect(page, selectionRect);
                if (matches.length > 0) {
                    allTextMatches.push(...matches);
                    textMatchesByPage.set(page, matches);
                }
            }

            if (allTextMatches.length === 0) return;

            const PADDING = 3;
            let minX = Infinity;
            let maxX = -Infinity;
            let firstPageTop = Infinity;
            let lastPageBottom = -Infinity;

            for (const item of allTextMatches) {
                minX = Math.min(minX, item.intersectionLeft);
                maxX = Math.max(maxX, item.intersectionLeft + item.intersectionWidth);
                firstPageTop = Math.min(firstPageTop, item.intersectionTop);
                lastPageBottom = Math.max(lastPageBottom, item.intersectionTop + item.intersectionHeight);
            }

            const boxX = Math.max(0, minX - PADDING);
            const boxWidth = (maxX + PADDING) - boxX;
            const boxes: Array<{ page: number; x: number; y: number; width: number; height: number }> = [];

            for (let page = startPage; page <= endPage; page++) {
                const metrics = pageMetrics[page];
                if (!metrics) continue;

                const scale = metrics.scale;
                const pageHeight = metrics.originalHeight;

                if (page === startPage && page === endPage) {
                    const localYTop = getLocalYForPage(page, firstPageTop);
                    const localYBottom = getLocalYForPage(page, lastPageBottom);
                    if (localYTop !== null && localYBottom !== null) {
                        boxes.push({
                            page,
                            x: boxX / scale,
                            y: localYTop / scale,
                            width: boxWidth / scale,
                            height: (localYBottom - localYTop) / scale,
                        });
                    }
                } else if (page === startPage) {
                    const localYTop = getLocalYForPage(page, firstPageTop);
                    if (localYTop !== null) {
                        boxes.push({
                            page,
                            x: boxX / scale,
                            y: localYTop / scale,
                            width: boxWidth / scale,
                            height: (pageHeight - localYTop) / scale,
                        });
                    }
                } else if (page === endPage) {
                    const localYBottom = getLocalYForPage(page, lastPageBottom);
                    if (localYBottom !== null) {
                        boxes.push({
                            page,
                            x: boxX / scale,
                            y: 0,
                            width: boxWidth / scale,
                            height: localYBottom / scale,
                        });
                    }
                } else {
                    boxes.push({
                        page,
                        x: boxX / scale,
                        y: 0,
                        width: boxWidth / scale,
                        height: pageHeight,
                    });
                }
            }

            const selectedText = allTextMatches
                .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
                .map((item) => item.textSlice)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            let headingText = "";
            if (startPage === endPage) {
                const firstPageBox = textMatchesByPage.get(startPage);
                if (firstPageBox && firstPageBox.length > 0) {
                    const selectionTop = firstPageTop;
                    const container = pageContainerRef.current;
                    if (container) {
                        const slice = getSelectionSlice(startPage, (firstPageTop + lastPageBottom) / 2);
                        const textSpans = Array.from(
                            container.querySelectorAll(
                                `[data-page-number="${startPage}"][data-slice="${slice}"] .textLayer span`,
                            ),
                        ) as HTMLSpanElement[];

                        const headingCandidates = textSpans
                            .map(span => {
                                const rect = span.getBoundingClientRect();
                                const containerRect = container.getBoundingClientRect();
                                return {
                                    text: span.textContent || "",
                                    top: rect.top - containerRect.top,
                                };
                            })
                            .filter(item => item.top < selectionTop - 10 && item.top > selectionTop - 200)
                            .sort((a, b) => b.top - a.top)
                            .slice(0, 3)
                            .map(item => item.text)
                            .join(" ");

                        headingText = headingCandidates || "";
                    }
                }
            }

            const textRects = allTextMatches
                .map((item) => ({
                    left: item.intersectionLeft,
                    top: item.intersectionTop,
                    width: item.intersectionWidth,
                    height: item.intersectionHeight,
                }));

            onSelectionComplete?.({
                startPage,
                endPage,
                boxes,
                text: selectedText,
                heading: headingText,
                textRects,
            });
        },
        [
            dragSelection,
            getSpansForRect,
            getSelectionSlice,
            getContainerYFromLocal,
            getLocalYForPage,
            pageContainerRef,
            pageMetrics,
            onSelectionComplete,
        ],
    );

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
            {dragBoxes.map((box, index) => (
                <div
                    key={`drag-box-${index}`}
                    className="absolute rounded-lg border border-blue-500/70 bg-blue-500/20 ring-1 ring-blue-500/30 mix-blend-multiply"
                    style={{
                        left: box.left,
                        top: box.top,
                        width: box.width,
                        height: box.height,
                    }}
                />
            ))}
        </div>
    );
}

export {
    PdfViewerSelectionLayer
};
