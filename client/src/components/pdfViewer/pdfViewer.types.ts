import type { SectionType } from "@shared/section-types";
import type { CSSProperties } from "react";

type SectionBox = {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

type SectionPosition = {
    page: Array<number>;
    x: number;
    y: number;
    width: number;
    height: number;
    boxes?: SectionBox[];
};

type SectionState =
    | "valid"
    | "needs_review"
    | "conflict"
    | "processing"
    | "identifying"
    | "error"
    | "unknown";

type SectionFieldValue = string | number | boolean | null;

type SectionData = {
    id: string;
    textPosition: SectionPosition;
    state?: SectionState;
    sectionType?: SectionType;
    subtype?: string;
    propertyTypeScope?: "WEG" | "MV" | "ANY";
    fields?: Record<string, SectionFieldValue>;
    reusable?: boolean;
    /** Raw text from the PDF section, used for LLM field extraction. */
    rawText?: string;
};

type RenderedSection = {
    id: string;
    hasTopBorder: boolean;
    hasBottomBorder: boolean;
    style: CSSProperties;
    state?: SectionState;
    sectionType?: SectionType;
    /** True when state is needs_review but some required fields are still missing. */
    isPartial?: boolean;
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
    startPage: number;
    endPage: number;
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
    startPage: number;
    endPage: number;
    boxes: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    text: string;
    heading: string;
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
    ActiveSplit,
    DragSelection,
    DragSelectionResult,
    DragTextRect,
    PageMetrics,
    RenderedSection,
    SectionBox,
    SectionData,
    SectionFieldValue,
    SectionState,
    SectionType,
    SelectionRect,
    TextMatch,
}
