import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFPageProxy } from "pdfjs-dist";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type PdfLoadSuccess = {
  numPages: number;
};

type SplitComponentProps = {
  label?: string;
};

const GAP_HEIGHT = 80;
const ANIMATION_MS = 500;
const PAGE_DIVIDER_HEIGHT = 1;
const SIDEBAR_CARD_HEIGHT = 72;
const SIDEBAR_CARD_GAP = 12;
const HIGHLIGHT_PADDING_RATIO = 0.03;
const HIGHLIGHT_MIN_PADDING = 1;
const COORDINATE_ORIGIN: "top-left" | "bottom-left" = "top-left";
const SOURCE_UNITS: "pt" | "mm" = "pt";
const SOURCE_Y_ORIGIN: "top" | "baseline" = "baseline";
const SOURCE_PAGE_SIZE: { width: number | null; height: number | null } = {
  width: null,
  height: null,
};
const SOURCE_OFFSET = { x: 0, y: 0 };
const SOURCE_SCALE = { x: 1, y: 1 };
const MM_TO_PT = 2.834645669;

type HighlightSource = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "heading" | "text" | "custom";
  sectionId: string;
};

type HighlightBox = HighlightSource;

type SectionPosition = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SectionData = {
  id: string;
  heading: string;
  sectionType: string;
  headingPosition: SectionPosition;
  text: string;
  textPosition: SectionPosition[];
  units: unknown[];
};

type PageMetrics = {
  originalWidth: number;
  originalHeight: number;
  scale: number;
  height: number;
};

type SidebarAnchor = {
  id: string;
  page: number;
  y: number;
  height: number;
  heading: string;
  sectionType: string;
};

type SidebarItem = SidebarAnchor & {
  targetTop: number;
  top: number;
};

type SectionEntry = SectionData & {
  key: string;
};

type CustomBookmark = {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  heading: string;
  sectionType: string;
};

type DragSelection = {
  page: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type PendingBookmark = {
  bookmark: CustomBookmark;
  textOverlaps: string[];
  nonTextOverlaps: string[];
  textById: Record<string, string>;
};

const SECTION_DATA: { sections: SectionData[] } = {
  sections: [
    {
      id: "section-01",
      heading: "TEILUNGSERKLÄRUNG",
      sectionType: "document_meta",
      headingPosition: {
        page: 1,
        x: 32.888724282515625 * 2.6,
        y: 44.10435300450001 * 5.67,
        width: 172.87064915344396,
        height: 16.804687851,
      },
      text: "",
      textPosition: [],
      units: [],
    },
    {
      id: "section-02",
      heading: "TEILUNGSERKLÄRUNG",
      sectionType: "document_meta",
      headingPosition: {
        page: 1,
        x: 32.888724282515625 * 8,
        y: 44.10435300450001 * 5.67,
        width: 172.87064915344396,
        height: 16.804687851,
      },
      text: "",
      textPosition: [],
      units: [],
    },
    {
      id: "section-13",
      heading: "gemäß § 8 Wohnungseigentumsgesetz (WEG)",
      sectionType: "unit_allocation",
      headingPosition: {
        page: 1,
        x: 33.301339386  * 2.6,
        y: 71.71205447399996 * 4.67,
        width: 147.31259445527067,
        height: 7.202009079000001,
      },
      text: "",
      textPosition: [],
      units: [],
    },
    {
      id: "section-24",
      heading: "I. Begründung von Wohnungs- und Teileigentum",
      sectionType: "unit_allocation",
      headingPosition: {
        page: 1,
        x: 32.888724282515625 * 2.6,
        y: 135.92996876175005 * 4.57,
        width: 356.764348306937,
        height: 12.804687851,
      },
      text: "",
      textPosition: [],
      units: [],
    },
  ],
};

const SECTION_ENTRIES: SectionEntry[] = SECTION_DATA.sections.map((section, index) => ({
  ...section,
  key: `${section.id}-${index}`,
}));
const BASE_SECTION_IDS = new Set(SECTION_ENTRIES.map((section) => section.key));

function adjustOverlaps(
  boxes: HighlightBox[],
  page: number,
  forcedPairs: Set<string>
): HighlightBox[] {
  const next = boxes.map((box) => ({ ...box }));
  next.sort((a, b) => a.y - b.y);

  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const firstBox = next[i];
      const secondBox = next[j];
      const pairKey = `${page}|${[firstBox.sectionId, secondBox.sectionId]
        .sort()
        .join("|")}`;
      const forceShrink = forcedPairs.has(pairKey);
      const xOverlap =
        Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
        Math.max(firstBox.x, secondBox.x);
      const yOverlap =
        Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
        Math.max(firstBox.y, secondBox.y);

      if (xOverlap <= 0 || yOverlap <= 0) continue;

      const centerAx = firstBox.x + firstBox.width / 2;
      const centerAy = firstBox.y + firstBox.height / 2;
      const centerBx = secondBox.x + secondBox.width / 2;
      const centerBy = secondBox.y + secondBox.height / 2;
      const dx = Math.abs(centerAx - centerBx);
      const dy = Math.abs(centerAy - centerBy);
      const nearY =
        Math.abs(firstBox.y - secondBox.y) <=
        Math.max(firstBox.height, secondBox.height) * 0.2;

      const axis = dx >= dy ? "horizontal" : "vertical";

      if (axis === "vertical") {
        if (nearY && !forceShrink) continue;
        const shrink = yOverlap / 2;
        const topBox = firstBox.y <= secondBox.y ? firstBox : secondBox;
        const bottomBox = topBox === firstBox ? secondBox : firstBox;
        topBox.height = Math.max(1, topBox.height - shrink);
        bottomBox.y += shrink;
        bottomBox.height = Math.max(1, bottomBox.height - shrink);
      } else {
        const shrink = xOverlap / 2;
        const leftBox = firstBox.x <= secondBox.x ? firstBox : secondBox;
        const rightBox = leftBox === firstBox ? secondBox : firstBox;
        leftBox.width = Math.max(1, leftBox.width - shrink);
        rightBox.x += shrink;
        rightBox.width = Math.max(1, rightBox.width - shrink);
      }
    }
  }

  return next;
}

function SplitComponent({ label = "Split" }: SplitComponentProps) {
  return (
    <div className="relative flex h-20 w-full items-center justify-center bg-primary/10">
      <div className="absolute inset-0 border-y border-border/70" />
      <div className="flex items-center gap-3">
        <div className="h-px w-16 bg-border" />
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
          {label}
        </span>
        <div className="h-px w-16 bg-border" />
      </div>
    </div>
  );
}

type PageSliceProps = {
  pageNumber: number;
  width: number;
  height: number;
  offset: number;
  slice: "top" | "bottom";
  highlights: HighlightBox[];
  onHighlightClick: (event: MouseEvent<HTMLDivElement>, highlight: HighlightBox) => void;
  onRenderSuccess: (page: PDFPageProxy) => void;
};

function PageSlice({
  pageNumber,
  width,
  height,
  offset,
  slice,
  highlights,
  onHighlightClick,
  onRenderSuccess,
}: PageSliceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [snappedHighlights, setSnappedHighlights] = useState(highlights);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !highlights.length) {
      setSnappedHighlights(highlights);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const spanRects = Array.from(container.querySelectorAll(".textLayer span"))
      .map((span) => {
        const rect = span.getBoundingClientRect();
        return {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((span) => span.width > 0 && span.height > 0);

    if (!spanRects.length) {
      setSnappedHighlights(highlights);
      return;
    }

    const next = highlights.map((box) => {
      const matches = spanRects.filter((span) => {
        const xOverlap =
          Math.min(box.x + box.width, span.left + span.width) -
          Math.max(box.x, span.left);
        const yOverlap =
          Math.min(box.y + box.height, span.top + span.height) -
          Math.max(box.y, span.top);
        return xOverlap > 0 && yOverlap > 0;
      });

      if (!matches.length) return box;

      const minLeft = Math.min(...matches.map((span) => span.left));
      const minTop = Math.min(...matches.map((span) => span.top));
      const maxRight = Math.max(...matches.map((span) => span.left + span.width));
      const maxBottom = Math.max(...matches.map((span) => span.top + span.height));
      const textWidth = Math.max(1, maxRight - minLeft);
      const textHeight = Math.max(1, maxBottom - minTop);
      const padX = Math.max(HIGHLIGHT_MIN_PADDING, textWidth * HIGHLIGHT_PADDING_RATIO);
      const padY = Math.max(HIGHLIGHT_MIN_PADDING, textHeight * HIGHLIGHT_PADDING_RATIO);

      let x = minLeft - padX;
      let y = minTop - padY;
      let w = textWidth + padX * 2;
      let h = textHeight + padY * 2;

      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;
      if (x < box.x) x = box.x;
      if (y < box.y) y = box.y;
      const right = Math.min(boxRight, x + w);
      const bottom = Math.min(boxBottom, y + h);
      w = Math.max(1, right - x);
      h = Math.max(1, bottom - y);

      return { ...box, x, y, width: w, height: h };
    });

    setSnappedHighlights(next);
  }, [highlights, width, height]);

  return (
    <div
      className="w-full overflow-hidden"
      data-page-number={pageNumber}
      data-slice={slice}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="relative"
        style={{ transform: `translateY(-${offset}px)` }}
      >
        <Page pageNumber={pageNumber} width={width} onRenderSuccess={onRenderSuccess} />
        <div className="absolute inset-0">
          {snappedHighlights.map((box) => (
            <div
              key={box.id}
              className={`absolute cursor-pointer rounded-[6px] border ${
                box.kind === "heading"
                  ? "border-emerald-400/60 bg-emerald-400/15"
                  : box.kind === "custom"
                    ? "border-primary/70 bg-primary/15"
                    : "border-emerald-300/40 bg-emerald-300/10"
              }`}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
              onClick={(event) => onHighlightClick(event, box)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PdfTestPage() {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(960);
  const [splitMode] = useState(false);
  const [split, setSplit] = useState<{ page: number; ratio: number } | null>(null);
  const [animateSplit] = useState(false);
  const [animateOnClick] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState(false);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [dragTextRects, setDragTextRects] = useState<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);
  const [customBookmarks, setCustomBookmarks] = useState<CustomBookmark[]>([]);
  const [hiddenSectionIds, setHiddenSectionIds] = useState<string[]>([]);
  const [pendingBookmark, setPendingBookmark] = useState<PendingBookmark | null>(null);
  const [overlapDialogOpen, setOverlapDialogOpen] = useState(false);
  const [forcedShrinkPairs, setForcedShrinkPairs] = useState<string[]>([]);
  const [pendingSplit, setPendingSplit] = useState<{ page: number; ratio: number } | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = pageContainerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(node.clientWidth);
      setPageWidth(nextWidth < 320 ? 320 : nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dragMode) setDragTextRects([]);
  }, [dragMode]);

  const handleLoadSuccess = ({ numPages: loadedPages }: PdfLoadSuccess) => {
    setNumPages(loadedPages);
  };

  const pages = useMemo(() => {
    if (numPages <= 0) return [];
    return Array.from({ length: numPages }, (_, index) => index + 1);
  }, [numPages]);

  const visibleSectionEntries = useMemo(() => {
    if (!hiddenSectionIds.length) return SECTION_ENTRIES;
    const hidden = new Set(hiddenSectionIds);
    return SECTION_ENTRIES.filter((section) => !hidden.has(section.key));
  }, [hiddenSectionIds]);

  const highlightSources = useMemo<HighlightSource[]>(() => {
    const sources: HighlightSource[] = [];

    visibleSectionEntries.forEach((section) => {
      sources.push({
        id: `${section.key}-heading`,
        sectionId: section.key,
        kind: "heading",
        ...section.headingPosition,
      });

      section.textPosition.forEach((position, index) => {
        sources.push({
          id: `${section.key}-text-${index}`,
          sectionId: section.key,
          kind: "text",
          ...position,
        });
      });
    });

    return sources;
  }, [visibleSectionEntries]);

  const forcedShrinkPairSet = useMemo(() => new Set(forcedShrinkPairs), [forcedShrinkPairs]);

  const highlightsByPage = useMemo(() => {
    const grouped: Record<number, HighlightBox[]> = {};
    const unitScale = SOURCE_UNITS === "mm" ? MM_TO_PT : 1;

    highlightSources.forEach((source) => {
      const metrics = pageMetrics[source.page];
      if (!metrics) return;

      const baseWidth =
        (SOURCE_PAGE_SIZE.width ?? metrics.originalWidth / unitScale) * unitScale;
      const baseHeight =
        (SOURCE_PAGE_SIZE.height ?? metrics.originalHeight / unitScale) * unitScale;
      const fitScaleX = metrics.originalWidth / baseWidth;
      const fitScaleY = metrics.originalHeight / baseHeight;

      const rawX = source.x + SOURCE_OFFSET.x;
      const rawY = source.y + SOURCE_OFFSET.y;
      const alignedY = SOURCE_Y_ORIGIN === "baseline" ? rawY - source.height : rawY;

      const sourceX = rawX * unitScale * SOURCE_SCALE.x;
      const sourceY = alignedY * unitScale * SOURCE_SCALE.y;
      const sourceWidth = source.width * unitScale * SOURCE_SCALE.x;
      const sourceHeight = source.height * unitScale * SOURCE_SCALE.y;

      const pdfX = sourceX * fitScaleX;
      const pdfY = sourceY * fitScaleY;
      const pdfWidth = sourceWidth * fitScaleX;
      const pdfHeight = sourceHeight * fitScaleY;

      const scaled = {
        ...source,
        x: pdfX * metrics.scale,
        y:
          COORDINATE_ORIGIN === "bottom-left"
            ? (metrics.originalHeight - pdfY - pdfHeight) * metrics.scale
            : pdfY * metrics.scale,
        width: pdfWidth * metrics.scale,
        height: pdfHeight * metrics.scale,
      };

      const padX = Math.max(HIGHLIGHT_MIN_PADDING, scaled.width * HIGHLIGHT_PADDING_RATIO);
      const padY = Math.max(HIGHLIGHT_MIN_PADDING, scaled.height * HIGHLIGHT_PADDING_RATIO);
      const padded = {
        ...scaled,
        x: scaled.x - padX,
        y: scaled.y - padY,
        width: scaled.width + padX * 2,
        height: scaled.height + padY * 2,
      };

      if (!grouped[source.page]) grouped[source.page] = [];
      grouped[source.page].push(padded);
    });

    customBookmarks.forEach((bookmark) => {
      const metrics = pageMetrics[bookmark.page];
      if (!metrics) return;

      const pageWidthPx = metrics.originalWidth * metrics.scale;
      const pageHeightPx = metrics.height;

      const scaled = {
        id: bookmark.id,
        sectionId: bookmark.id,
        kind: "custom" as const,
        page: bookmark.page,
        x: bookmark.xRatio * pageWidthPx,
        y: bookmark.yRatio * pageHeightPx,
        width: bookmark.widthRatio * pageWidthPx,
        height: bookmark.heightRatio * pageHeightPx,
      };

      const padX = Math.max(HIGHLIGHT_MIN_PADDING, scaled.width * HIGHLIGHT_PADDING_RATIO);
      const padY = Math.max(HIGHLIGHT_MIN_PADDING, scaled.height * HIGHLIGHT_PADDING_RATIO);
      const padded = {
        ...scaled,
        x: scaled.x - padX,
        y: scaled.y - padY,
        width: scaled.width + padX * 2,
        height: scaled.height + padY * 2,
      };

      if (!grouped[bookmark.page]) grouped[bookmark.page] = [];
      grouped[bookmark.page].push(padded);
    });

    Object.keys(grouped).forEach((page) => {
      const pageNumber = Number(page);
      grouped[pageNumber] = adjustOverlaps(
        grouped[pageNumber],
        pageNumber,
        forcedShrinkPairSet
      );
    });

    return grouped;
  }, [highlightSources, pageMetrics, customBookmarks, forcedShrinkPairSet]);

  const pageOffsets = useMemo(() => {
    const offsets: Record<number, number> = {};
    let currentOffset = 0;

    pages.forEach((page) => {
      offsets[page] = currentOffset;
      const height = pageMetrics[page]?.height ?? 0;
      const hasGap = splitOpen && split?.page === page;
      currentOffset += height + (hasGap ? GAP_HEIGHT : 0) + PAGE_DIVIDER_HEIGHT;
    });

    return offsets;
  }, [pages, pageMetrics, split, splitOpen]);

  const documentHeight = useMemo(() => {
    if (!pages.length) return 0;
    const lastPage = pages[pages.length - 1];
    const lastOffset = pageOffsets[lastPage] ?? 0;
    const lastHeight = pageMetrics[lastPage]?.height ?? 0;
    return lastOffset + lastHeight;
  }, [pageOffsets, pageMetrics, pages]);

  const sidebarAnchors = useMemo<SidebarAnchor[]>(() => {
    const anchors = visibleSectionEntries.flatMap((section) => {
      const page = section.headingPosition.page;
      const pageHighlights = highlightsByPage[page];
      if (!pageHighlights) return [];

      const headingHighlight = pageHighlights.find(
        (box) => box.sectionId === section.key && box.kind === "heading"
      );

      if (!headingHighlight) return [];

      return [
        {
          id: section.key,
          page,
          y: headingHighlight.y,
          height: headingHighlight.height,
          heading: section.heading,
          sectionType: section.sectionType,
        },
      ];
    });
    const customAnchors = customBookmarks
      .map((bookmark) => {
        const metrics = pageMetrics[bookmark.page];
        if (!metrics) return null;
        const pageHeightPx = metrics.height;

        return {
          id: bookmark.id,
          page: bookmark.page,
          y: bookmark.yRatio * pageHeightPx,
          height: bookmark.heightRatio * pageHeightPx,
          heading: bookmark.heading,
          sectionType: bookmark.sectionType,
        };
      })
      .filter((anchor): anchor is SidebarAnchor => Boolean(anchor));

    return [...anchors, ...customAnchors];
  }, [highlightsByPage, customBookmarks, pageMetrics, visibleSectionEntries]);

  const sidebarLayout = useMemo(() => {
    if (!sidebarAnchors.length) {
      return { items: [] as SidebarItem[], height: documentHeight };
    }

    const items = sidebarAnchors
      .map((anchor) => {
        const height = pageMetrics[anchor.page]?.height ?? 0;
        const splitY =
          split?.page === anchor.page && height > 0
            ? Math.round(height * split.ratio)
            : null;
        const localGap =
          splitOpen && splitY !== null && anchor.y >= splitY ? GAP_HEIGHT : 0;
        const targetTop =
          (pageOffsets[anchor.page] ?? 0) +
          anchor.y +
          localGap +
          anchor.height / 2;

        return {
          ...anchor,
          targetTop,
          top: targetTop,
        };
      })
      .sort((a, b) => a.targetTop - b.targetTop);

    const activeIndex =
      activeSectionId ? items.findIndex((item) => item.id === activeSectionId) : -1;

    if (activeIndex >= 0) {
      items[activeIndex].top = items[activeIndex].targetTop;

      for (let i = activeIndex - 1; i >= 0; i -= 1) {
        const nextTop = items[i + 1].top;
        const maxTop = nextTop - SIDEBAR_CARD_HEIGHT - SIDEBAR_CARD_GAP;
        items[i].top = Math.min(items[i].top, maxTop);
      }

      for (let i = activeIndex + 1; i < items.length; i += 1) {
        const prevTop = items[i - 1].top;
        const minTop = prevTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
        if (items[i].top < minTop) items[i].top = minTop;
      }
    } else {
      let lastTop = Number.NEGATIVE_INFINITY;
      items.forEach((item, index) => {
        if (index === 0) {
          lastTop = item.top;
          return;
        }

        const minTop = lastTop + SIDEBAR_CARD_HEIGHT + SIDEBAR_CARD_GAP;
        if (item.top < minTop) item.top = minTop;
        lastTop = item.top;
      });
    }

    const height =
      items.length > 0
        ? Math.max(documentHeight, items[items.length - 1].top + SIDEBAR_CARD_HEIGHT)
        : documentHeight;

    return { items, height };
  }, [
    sidebarAnchors,
    pageMetrics,
    pageOffsets,
    split,
    splitOpen,
    documentHeight,
    activeSectionId,
  ]);

  const sectionLabelById = useMemo(() => {
    const map = new Map<string, string>();
    SECTION_ENTRIES.forEach((section) => map.set(section.key, section.heading));
    customBookmarks.forEach((bookmark) => map.set(bookmark.id, bookmark.heading));
    return map;
  }, [customBookmarks]);

  const scrollToAnchor = (anchor: SidebarAnchor) => {
    const container = pdfScrollRef.current;
    if (!container) return;

    const pageHeight = pageMetrics[anchor.page]?.height ?? 0;
    const splitY =
      split?.page === anchor.page && pageHeight > 0
        ? Math.round(pageHeight * split.ratio)
        : null;
    const gapOffset =
      splitOpen && splitY !== null && anchor.y >= splitY ? GAP_HEIGHT : 0;

    const containerTop = container.getBoundingClientRect().top + window.scrollY;
    const anchorTop =
      (pageOffsets[anchor.page] ?? 0) + anchor.y + gapOffset + anchor.height / 2;
    const target = Math.max(0, containerTop + anchorTop - window.innerHeight / 2);

    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const scrollToPosition = (page: number, y: number, height: number) => {
    const container = pdfScrollRef.current;
    if (!container) return;

    const pageHeight = pageMetrics[page]?.height ?? 0;
    const splitY =
      split?.page === page && pageHeight > 0 ? Math.round(pageHeight * split.ratio) : null;
    const gapOffset =
      splitOpen && splitY !== null && y >= splitY ? GAP_HEIGHT : 0;

    const containerTop = container.getBoundingClientRect().top + window.scrollY;
    const anchorTop = (pageOffsets[page] ?? 0) + y + gapOffset + height / 2;
    const target = Math.max(0, containerTop + anchorTop - window.innerHeight / 2);

    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const getPageWidthPx = (page: number) => {
    const metrics = pageMetrics[page];
    if (!metrics) return null;
    return metrics.originalWidth * metrics.scale;
  };

  const getLocalYForPage = (page: number, yInContainer: number) => {
    const metrics = pageMetrics[page];
    if (!metrics) return null;
    const pageHeight = metrics.height;
    const offset = pageOffsets[page] ?? 0;
    let localY = yInContainer - offset;

    if (splitOpen && split?.page === page) {
      const splitY = Math.round(pageHeight * split.ratio);
      if (localY >= splitY && localY <= splitY + GAP_HEIGHT) {
        localY = splitY;
      } else if (localY > splitY + GAP_HEIGHT) {
        localY -= GAP_HEIGHT;
      }
    }

    return clamp(localY, 0, pageHeight);
  };

  const getContainerYFromLocal = (page: number, localY: number) => {
    const metrics = pageMetrics[page];
    if (!metrics) return null;
    const offset = pageOffsets[page] ?? 0;
    const pageHeight = metrics.height;
    let containerY = localY;

    if (splitOpen && split?.page === page) {
      const splitY = Math.round(pageHeight * split.ratio);
      if (localY >= splitY) containerY += GAP_HEIGHT;
    }

    return offset + containerY;
  };

  const resolvePageFromY = (yInContainer: number) => {
    for (const page of pages) {
      const metrics = pageMetrics[page];
      if (!metrics) continue;
      const offset = pageOffsets[page] ?? 0;
      const pageHeight = metrics.height;
      const totalHeight =
        pageHeight +
        (splitOpen && split?.page === page ? GAP_HEIGHT : 0);
      if (yInContainer >= offset && yInContainer <= offset + totalHeight) {
        return page;
      }
    }
    return null;
  };

  const getLocalPointForPage = (
    page: number,
    clientX: number,
    clientY: number
  ) => {
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
  };

  const getSelectionRect = (selection: DragSelection) => {
    const startTop = getContainerYFromLocal(selection.page, selection.startY);
    const endTop = getContainerYFromLocal(selection.page, selection.currentY);
    if (startTop === null || endTop === null) return null;

    const left = Math.min(selection.startX, selection.currentX);
    const top = Math.min(startTop, endTop);
    const width = Math.abs(selection.startX - selection.currentX);
    const height = Math.abs(startTop - endTop);
    const localCenterY = (selection.startY + selection.currentY) / 2;

    return { left, top, width, height, localCenterY };
  };

  const getSelectionSlice = (page: number, localCenterY: number) => {
    const pageHeight = pageMetrics[page]?.height ?? 0;
    if (!pageHeight) return "bottom";
    const splitY =
      split?.page === page && pageHeight > 0 ? Math.round(pageHeight * split.ratio) : null;
    if (splitY === null) return "bottom";
    return localCenterY >= splitY ? "bottom" : "top";
  };

  const shouldSelectWholeWords = () => {
    if (typeof window === "undefined") return true;
    const flag = (
      window as Window & { __PDF_SELECT_WHOLE_WORDS__?: boolean }
    ).__PDF_SELECT_WHOLE_WORDS__;
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

  const getSpansForRect = (
    page: number,
    rect: { left: number; top: number; width: number; height: number; localCenterY: number }
  ) => {
    const container = pageContainerRef.current;
    if (!container) return [];
    const slice = getSelectionSlice(page, rect.localCenterY);
    const spans = Array.from(
      container.querySelectorAll(
        `[data-page-number="${page}"][data-slice="${slice}"] .textLayer span`
      )
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
        const intersectionRight = Math.min(
          rect.left + rect.width,
          item.left + item.width
        );

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
            Math.min(item.text.length, Math.floor(startRatio * item.text.length))
          );
          endIndex = Math.max(
            startIndex,
            Math.min(item.text.length, Math.ceil(endRatio * item.text.length))
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
          ...item,
          intersectionLeft: highlightLeft,
          intersectionTop: item.top,
          intersectionWidth: finalWidth,
          intersectionHeight: item.height,
          textSlice,
        };
      });
  };

  const getSpansForSelection = (
    selection: DragSelection,
    rect: { left: number; top: number; width: number; height: number; localCenterY: number }
  ) => getSpansForRect(selection.page, rect);

  const normalizeWord = (word: string) => word.toLowerCase();

  const extractWords = (text: string) =>
    (text.match(/[A-Za-z0-9ÄÖÜäöüß]+/g) ?? []).map(normalizeWord);

  const getWordSetFromMatches = (
    matches: Array<{ textSlice: string }>
  ) => new Set(extractWords(matches.map((item) => item.textSlice).join(" ")));

  const hasWordOverlap = (a: Set<string>, b: Set<string>) => {
    for (const word of a) {
      if (b.has(word)) return true;
    }
    return false;
  };

  const getRectForHighlight = (page: number, box: HighlightBox) => {
    const top = getContainerYFromLocal(page, box.y);
    if (top === null) return null;
    return {
      left: box.x,
      top,
      width: box.width,
      height: box.height,
      localCenterY: box.y + box.height / 2,
    };
  };

  const buildTextFromRect = (
    page: number,
    rect: { left: number; top: number; width: number; height: number; localCenterY: number }
  ) => {
    const matches = getSpansForRect(page, rect);
    return matches
      .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
      .map((item) => item.textSlice)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const addForcedShrinkPairs = (page: number, id: string, overlapIds: string[]) => {
    if (!overlapIds.length) return;
    setForcedShrinkPairs((current) => {
      const next = new Set(current);
      overlapIds.forEach((other) => {
        const key = `${page}|${[id, other].sort().join("|")}`;
        next.add(key);
      });
      return Array.from(next);
    });
  };

  const addBookmark = (bookmark: CustomBookmark) => {
    setCustomBookmarks((current) => [...current, bookmark]);
    setActiveSectionId(bookmark.id);
  };

  const removeOverlaps = (overlapIds: string[]) => {
    if (!overlapIds.length) return;
    setCustomBookmarks((current) =>
      current.filter((bookmark) => !overlapIds.includes(bookmark.id))
    );
    setForcedShrinkPairs((current) =>
      current.filter((key) => {
        const [, idA, idB] = key.split("|");
        return !overlapIds.includes(idA) && !overlapIds.includes(idB);
      })
    );
    setHiddenSectionIds((current) => {
      const next = new Set(current);
      overlapIds.forEach((id) => {
        if (BASE_SECTION_IDS.has(id)) next.add(id);
      });
      return Array.from(next);
    });
    setActiveSectionId((current) =>
      current && overlapIds.includes(current) ? null : current
    );
  };

  const findOverlappingBookmarks = (
    page: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => {
    const boxes = (highlightsByPage[page] ?? []).filter(
      (box) => box.kind === "heading" || box.kind === "custom"
    );
    const overlaps = new Set<string>();

    boxes.forEach((box) => {
      const xOverlap =
        Math.min(rect.x + rect.width, box.x + box.width) -
        Math.max(rect.x, box.x);
      const yOverlap =
        Math.min(rect.y + rect.height, box.y + box.height) -
        Math.max(rect.y, box.y);
      if (xOverlap > 0 && yOverlap > 0) {
        overlaps.add(box.sectionId);
      }
    });

    return Array.from(overlaps);
  };

  const dragBox = (() => {
    if (!dragSelection) return null;
    const rect = getSelectionRect(dragSelection);
    if (!rect) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })();

  const applySplit = (page: number, ratio: number) => {
    const clampedRatio = Math.min(0.98, Math.max(0.02, ratio));
    const nextSplit = { page, ratio: clampedRatio };

    if (!split) {
      setSplit(nextSplit);
      if (!animateSplit || !animateOnClick) {
        setSplitOpen(true);
        return;
      }

      setSplitOpen(false);
      requestAnimationFrame(() => setSplitOpen(true));
      return;
    }

    if (!animateSplit || !animateOnClick) {
      setSplit(nextSplit);
      setSplitOpen(true);
      return;
    }

    setPendingSplit(nextSplit);
    setSplitOpen(false);
  };
  useEffect(() => {
    if (!split) {
      setSplitOpen(false);
      setPendingSplit(null);
      return;
    }

    if (!animateSplit) {
      setSplitOpen(true);
      return;
    }

    if (!animateOnClick) {
      setSplitOpen(true);
      return;
    }

    if (!splitOpen) return;
  }, [split, animateSplit, animateOnClick, splitOpen]);

  useEffect(() => {
    if (!pendingSplit) return;
    if (splitOpen) return;

    const timer = window.setTimeout(() => {
      setSplit(pendingSplit);
      setPendingSplit(null);
      if (!animateSplit) {
        setSplitOpen(true);
        return;
      }

      requestAnimationFrame(() => setSplitOpen(true));
    }, ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [pendingSplit, splitOpen, animateSplit]);

  const handleSplitClick = (
    page: number,
    height: number | undefined,
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (!splitMode) return;
    if (!height) return;

    const rect = event.currentTarget.getBoundingClientRect();
    let y = event.clientY - rect.top;
    const currentGap = split?.page === page && splitOpen ? GAP_HEIGHT : 0;

    if (split?.page === page) {
      const splitY = height * split.ratio;
      if (y >= splitY && y <= splitY + currentGap) return;
      if (y > splitY + currentGap) y -= currentGap;
    }

    applySplit(page, y / height);
  };

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
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
    const selection = {
      page,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    };
    setDragSelection(selection);
    const selectionRect = getSelectionRect(selection);
    if (!selectionRect) return;
    const matches = getSpansForSelection(selection, selectionRect);
    setDragTextRects(
      matches
        .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
        .map((item) => ({
          left: item.intersectionLeft,
          top: item.intersectionTop,
          width: item.intersectionWidth,
          height: item.intersectionHeight,
        }))
    );
  };

  const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragSelection) return;
    const point = getLocalPointForPage(
      dragSelection.page,
      event.clientX,
      event.clientY
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
    const matches = getSpansForSelection(nextSelection, rect);
    setDragTextRects(
      matches
        .filter((item) => item.intersectionWidth > 0 && item.intersectionHeight > 0)
        .map((item) => ({
          left: item.intersectionLeft,
          top: item.intersectionTop,
          width: item.intersectionWidth,
          height: item.intersectionHeight,
        }))
    );
  };

  const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragSelection) return;
    const point = getLocalPointForPage(
      dragSelection.page,
      event.clientX,
      event.clientY
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

    if (width < 8 || height < 8) return;

    const metrics = pageMetrics[dragSelection.page];
    if (!metrics) return;
    const pageWidthPx = getPageWidthPx(dragSelection.page);
    if (!pageWidthPx) return;

    const selection = {
      page: dragSelection.page,
      startX: dragSelection.startX,
      startY: dragSelection.startY,
      currentX: finalX,
      currentY: finalY,
    };
    const rect = getSelectionRect(selection);
    const matches = rect ? getSpansForSelection(selection, rect) : [];
    const selectedText = matches
      .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
      .map((item) => item.textSlice)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const selectionWords = getWordSetFromMatches(matches);

    console.info("[pdf-selection] rect", {
      page: dragSelection.page,
      x,
      y,
      width,
      height,
      xRatio: x / pageWidthPx,
      yRatio: y / metrics.height,
      widthRatio: width / pageWidthPx,
      heightRatio: height / metrics.height,
    });
    console.info("[pdf-selection] text", selectedText || "(no text)");

    const bookmark: CustomBookmark = {
      id: `custom-${Date.now()}`,
      page: dragSelection.page,
      xRatio: x / pageWidthPx,
      yRatio: y / metrics.height,
      widthRatio: width / pageWidthPx,
      heightRatio: height / metrics.height,
      heading: `Custom selection ${customBookmarks.length + 1}`,
      sectionType: "custom",
    };

    const overlapIds = findOverlappingBookmarks(dragSelection.page, {
      x,
      y,
      width,
      height,
    });

    if (overlapIds.length) {
      const pageBoxes = (highlightsByPage[dragSelection.page] ?? []).filter(
        (box) => box.kind === "heading" || box.kind === "custom"
      );
      const textOverlaps: string[] = [];
      const nonTextOverlaps: string[] = [];
      const textById: Record<string, string> = {};

      overlapIds.forEach((id) => {
        const box = pageBoxes.find((item) => item.sectionId === id);
        if (!box) return;
        const rect = getRectForHighlight(dragSelection.page, box);
        if (!rect) return;
        const overlapMatches = getSpansForRect(dragSelection.page, rect);
        const overlapWords = getWordSetFromMatches(overlapMatches);
        const hasOverlap =
          selectionWords.size > 0 &&
          overlapWords.size > 0 &&
          hasWordOverlap(selectionWords, overlapWords);

        if (hasOverlap) {
          textOverlaps.push(id);
          textById[id] = buildTextFromRect(dragSelection.page, rect);
        } else {
          nonTextOverlaps.push(id);
        }
      });

      if (nonTextOverlaps.length) {
        addForcedShrinkPairs(dragSelection.page, bookmark.id, nonTextOverlaps);
      }

      if (textOverlaps.length) {
        console.info("[pdf-selection] overlaps", textOverlaps);
        setPendingBookmark({
          bookmark,
          textOverlaps,
          nonTextOverlaps,
          textById,
        });
        setOverlapDialogOpen(true);
        return;
      }
    }

    addBookmark(bookmark);
  };

  const handleHighlightClick = (
    event: MouseEvent<HTMLDivElement>,
    highlight: HighlightBox
  ) => {
    event.stopPropagation();
    setActiveSectionId(highlight.sectionId);
    const pageHeight = pageMetrics[highlight.page]?.height ?? 0;
    if (!pageHeight) return;

    const targetY = highlight.y + highlight.height + 5;
    applySplit(highlight.page, targetY / pageHeight);

    if (animateSplit && animateOnClick) {
      window.setTimeout(
        () => scrollToPosition(highlight.page, highlight.y, highlight.height),
        ANIMATION_MS + 50
      );
      return;
    }

    scrollToPosition(highlight.page, highlight.y, highlight.height);
  };

  const handlePageRender = (pageNumber: number) => (page: PDFPageProxy) => {
    const viewport = page.getViewport({ scale: 1 });
    const scale = pageWidth / viewport.width;
    const height = Math.round(viewport.height * scale);

    setPageMetrics((current) => {
      const existing = current[pageNumber];
      if (
        existing &&
        existing.height === height &&
        Math.abs(existing.scale - scale) < 0.0001
      ) {
        return current;
      }

      return {
        ...current,
        [pageNumber]: {
          originalWidth: viewport.width,
          originalHeight: viewport.height,
          scale,
          height,
        },
      };
    });
  };

  const handleReplaceOverlap = () => {
    if (!pendingBookmark) return;
    removeOverlaps(pendingBookmark.textOverlaps);
    if (pendingBookmark.nonTextOverlaps.length) {
      addForcedShrinkPairs(
        pendingBookmark.bookmark.page,
        pendingBookmark.bookmark.id,
        pendingBookmark.nonTextOverlaps
      );
    }
    addBookmark(pendingBookmark.bookmark);
    setPendingBookmark(null);
    setOverlapDialogOpen(false);
  };

  const handleKeepBoth = () => {
    if (!pendingBookmark) return;
    if (pendingBookmark.nonTextOverlaps.length) {
      addForcedShrinkPairs(
        pendingBookmark.bookmark.page,
        pendingBookmark.bookmark.id,
        pendingBookmark.nonTextOverlaps
      );
    }
    addBookmark(pendingBookmark.bookmark);
    setPendingBookmark(null);
    setOverlapDialogOpen(false);
  };

  const handleCancelOverlap = () => {
    setPendingBookmark(null);
    setOverlapDialogOpen(false);
  };

  const { items: sidebarItems, height: sidebarHeight } = sidebarLayout;

  return (
    <div className="relative min-h-screen bg-background text-foreground before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-72 before:bg-[radial-gradient(80%_70%_at_0%_0%,_rgba(16,185,129,0.12)_0%,_transparent_70%)] before:content-['']">
      <div className="mx-auto flex w-full flex-col gap-8 px-6 py-10">
        <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
          <CardHeader className="relative overflow-hidden border-b border-border/60 pb-6">
            <div className="pointer-events-none absolute inset-0 z-0">
              <div className="absolute -top-10 right-12 h-32 w-32 rounded-full bg-emerald-200/40 blur-3xl" />
              <div className="absolute left-6 top-8 h-24 w-24 rounded-full bg-emerald-100/40 blur-3xl" />
            </div>
            <CardAction className="relative z-10">
              <Badge variant="outline" className="bg-background/70">
                Preview
              </Badge>
            </CardAction>
            <div className="relative z-10 space-y-2">
              <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                Document workflow
              </span>
              <CardTitle className="text-2xl">PDF segmentation review</CardTitle>
              <CardDescription>
                Keep the document immutable while applying precise, region-level review.
              </CardDescription>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {numPages > 0 ? `${numPages} pages` : "Loading pages"}
                </Badge>
                {split ? (
                  <Badge className="bg-primary/10 text-primary">
                    Split on page {split.page} at {Math.round(split.ratio * 100)}%
                  </Badge>
                ) : (
                  <Badge variant="outline">No split selected</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="grid lg:grid-cols-[280px_1fr]">
                <aside className="border-b border-border/60 bg-muted/20 lg:border-b-0 lg:border-r">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        Bookmarks
                      </span>
                      <Badge variant="outline">{sidebarItems.length} sections</Badge>
                    </div>
                    <div
                      className="relative mt-4"
                      style={{ height: sidebarHeight || "auto" }}
                    >
                      {sidebarItems.map((anchor) => {
                        const offset = anchor.top - anchor.targetTop;
                        const connectorTop = Math.min(anchor.top, anchor.targetTop);
                        const connectorHeight = Math.abs(offset);

                        return (
                          <div key={anchor.id}>
                            {connectorHeight > 1 ? (
                              <div
                                className="pointer-events-none absolute left-2 w-px bg-primary/20"
                                style={{ top: connectorTop, height: connectorHeight }}
                              />
                            ) : null}
                            <div
                              className="pointer-events-none absolute left-1.5 h-2 w-2 -translate-y-1/2 rounded-full bg-primary/70"
                              style={{ top: anchor.targetTop }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveSectionId(anchor.id);
                                const pageHeight = pageMetrics[anchor.page]?.height ?? 0;
                                if (!pageHeight) return;
                                const targetY = anchor.y + anchor.height + 5;
                                applySplit(anchor.page, targetY / pageHeight);
                                if (animateSplit && animateOnClick) {
                                  window.setTimeout(
                                    () => scrollToAnchor(anchor),
                                    ANIMATION_MS + 50
                                  );
                                  return;
                                }
                                scrollToAnchor(anchor);
                              }}
                              className="absolute left-0 right-0 z-10 h-auto -translate-y-1/2 flex-col items-start gap-2 rounded-xl border-border/70 bg-background/80 px-3 py-2 text-left text-xs text-foreground shadow-sm hover:bg-background"
                              style={{ top: anchor.top }}
                            >
                              <Badge
                                variant="secondary"
                                className="text-[10px] uppercase tracking-[0.22em]"
                              >
                                {anchor.sectionType}
                              </Badge>
                              <span className="line-clamp-2 text-sm font-medium text-foreground">
                                {anchor.heading}
                              </span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                <div className="relative flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
                    <span>Document viewport</span>
                    <span>Split mode {splitMode ? "enabled" : "disabled"}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={dragMode ? "default" : "outline"}
                    onClick={() => setDragMode((value) => !value)}
                    className="absolute right-4 top-4 z-20"
                  >
                    {dragMode ? "Drag active" : "Drag to add"}
                  </Button>
                  <div ref={pdfScrollRef} className="bg-muted/20">
                    <Document
                      file="/test.pdf"
                      onLoadSuccess={handleLoadSuccess}
                      loading={
                        <span className="text-sm text-muted-foreground">
                          Loading PDF…
                        </span>
                      }
                      error={
                        <span className="text-sm text-destructive">
                          Failed to load PDF.
                        </span>
                      }
                    >
                      <div className="px-4 pb-4">
                        <div className="relative">
                          <div ref={pageContainerRef} className="flex w-full flex-col">
                            {pages.map((page) => {
                              const height = pageMetrics[page]?.height ?? 0;
                              const isActiveSplit = split?.page === page && height > 0;
                              const splitY = isActiveSplit
                                ? Math.round(height * split!.ratio)
                                : 0;
                              const gapOpen = isActiveSplit && splitOpen;
                              const highlights = highlightsByPage[page] ?? [];

                              return (
                                <div
                                  key={`page-${page}`}
                                  className="w-full border-b border-border/60 last:border-b-0"
                                >
                                  <div
                                    className="relative w-full"
                                    onClick={(event) =>
                                      handleSplitClick(page, height, event)
                                    }
                                  >
                                    <div className="flex w-full flex-col">
                                    <PageSlice
                                      pageNumber={page}
                                      width={pageWidth}
                                      height={splitY}
                                      offset={0}
                                      slice="top"
                                      highlights={highlights}
                                      onHighlightClick={handleHighlightClick}
                                      onRenderSuccess={handlePageRender(page)}
                                    />
                                      <div
                                        className={`overflow-hidden ${
                                          animateSplit
                                            ? "transition-[height,opacity] duration-500 ease-out"
                                            : ""
                                        }`}
                                        style={{
                                          height: gapOpen ? GAP_HEIGHT : 0,
                                          opacity: gapOpen ? 1 : 0,
                                        }}
                                      >
                                        <SplitComponent />
                                      </div>
                                    <PageSlice
                                      pageNumber={page}
                                      width={pageWidth}
                                      height={Math.max(0, height - splitY)}
                                      offset={splitY}
                                      slice="bottom"
                                      highlights={highlights}
                                      onHighlightClick={handleHighlightClick}
                                      onRenderSuccess={handlePageRender(page)}
                                    />
                                    </div>
                                    {splitMode ? (
                                      <div className="pointer-events-none absolute inset-0 cursor-crosshair bg-transparent" />
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {dragMode ? (
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
                                  className="pointer-events-none absolute rounded-sm bg-primary/25 ring-1 ring-primary/20 mix-blend-multiply"
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
                                  className="absolute rounded-lg border border-primary/70 bg-primary/20 ring-1 ring-primary/30 mix-blend-multiply"
                                  style={{
                                    left: dragBox.left,
                                    top: dragBox.top,
                                    width: dragBox.width,
                                    height: dragBox.height,
                                  }}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Document>
                  </div>
                </div>
              </div>
            </div>
            <AlertDialog
              open={overlapDialogOpen && Boolean(pendingBookmark)}
              onOpenChange={(open) => {
                if (!open) handleCancelOverlap();
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Overlapping text detected</AlertDialogTitle>
                  <AlertDialogDescription>
                    This selection contains text that is already covered by another
                    bookmark. Keep both, or replace the old one with the new selection.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {pendingBookmark?.textOverlaps.length ? (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {pendingBookmark.textOverlaps.map((id, index) => (
                      <div key={`${id}-${index}`} className="space-y-1">
                        <div className="text-foreground">
                          {sectionLabelById.get(id) ?? id}
                        </div>
                        <div className="text-muted-foreground">
                          {pendingBookmark.textById[id] || "(no text detected)"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={handleKeepBoth}>
                    Keep both
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleReplaceOverlap}>
                    Replace old
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
