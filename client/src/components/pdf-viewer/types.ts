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

type SectionType =
    | "core.property_overview"
    | "core.address"
    | "core.building"
    | "core.building_shared_features"
    | "units.unit_block"
    | "weg.special_rights_block"
    | "weg.mea_total_check"
    | "weg.administration_property_manager"
    | "weg.administration_accountant"
    | "mv.owner_entity_block"
    | "unknown";

type SectionState =
    | "valid"
    | "needs_review"
    | "conflict"
    | "processing"
    | "identifying"
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
};

type RenderedSection = {
    id: string;
    hasTopBorder: boolean;
    hasBottomBorder: boolean;
    style: CSSProperties;
    state?: SectionState;
    sectionType?: SectionType;
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
    SectionBox,
    SectionType,
    SectionState,
    SectionFieldValue,
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
