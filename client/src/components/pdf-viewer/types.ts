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
};

type RenderedSection = {
    id: string;
    hasTopBorder: boolean;
    hasBottomBorder: boolean;
    style: CSSProperties;
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

export type {
    SectionData,
    RenderedSection,
    PageMetrics,
    ActiveSplit,
}