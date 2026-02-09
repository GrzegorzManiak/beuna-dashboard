import type { CSSProperties } from "react";

type SectionPosition = {
    page: Array<number>;
    x: number;
    y: number;
    width: number;
    height: number;
};

type SectionData = {
    id: string;
    textPosition: SectionPosition;
    state?: "valid" | "unknown" | "processing";
    sectionType?: string;
};

type RenderedSection = {
    id: string;
    hasTopBorder: boolean;
    hasBottomBorder: boolean;
    style: CSSProperties;
    state?: "valid" | "unknown" | "processing";
    sectionType?: string;
};

type PageMetrics = {
    originalWidth: number;
    originalHeight: number;
    scale: number;
    height: number;
};

type ActiveSplit = {
    pageNumber: number;
    splitRatio: number;
} | null;

type DragSelection = {
    page: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
};

type DragTextRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type DragSelectionResult = {
    page: number;
    rect: { x: number; y: number; width: number; height: number };
    ratios: { x: number; y: number; width: number; height: number };
    text: string;
    textRects: DragTextRect[];
};

type SelectionRect = {
    left: number;
    top: number;
    width: number;
    height: number;
    localCenterY: number;
};

type TextMatch = {
    textSlice: string;
    left: number;
    top: number;
    width: number;
    height: number;
    intersectionLeft: number;
    intersectionTop: number;
    intersectionWidth: number;
    intersectionHeight: number;
};

export type {
    SectionData,
    RenderedSection,
    PageMetrics,
    ActiveSplit,
    DragSelection,
    DragTextRect,
    DragSelectionResult,
    SelectionRect,
    TextMatch,
}
