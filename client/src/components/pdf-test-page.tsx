import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFPageProxy } from "pdfjs-dist";

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
const HIGHLIGHT_PADDING = 2;
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
  kind: "heading" | "text";
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

const SECTION_DATA: { sections: SectionData[] } = {
  sections: [
    {
      id: "section-0",
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
      id: "section-1",
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
      id: "section-2",
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

function adjustOverlaps(boxes: HighlightBox[]): HighlightBox[] {
  const next = boxes.map((box) => ({ ...box }));
  next.sort((a, b) => a.y - b.y);

  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const topBox = next[i];
      const bottomBox = next[j];
      const overlapStart = Math.max(topBox.y, bottomBox.y);
      const overlapEnd = Math.min(topBox.y + topBox.height, bottomBox.y + bottomBox.height);
      const overlap = overlapEnd - overlapStart;

      if (overlap <= 0) continue;

      const shrink = overlap / 2;
      topBox.height = Math.max(1, topBox.height - shrink);
      bottomBox.y += shrink;
      bottomBox.height = Math.max(1, bottomBox.height - shrink);
    }
  }

  return next;
}

function SplitComponent({ label = "Split" }: SplitComponentProps) {
  return (
    <div className="relative flex h-20 w-full items-center justify-center bg-emerald-500/10">
      <div className="absolute inset-0 border-y border-emerald-200/30" />
      <div className="flex items-center gap-3">
        <div className="h-px w-16 bg-emerald-200/70" />
        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
          {label}
        </span>
        <div className="h-px w-16 bg-emerald-200/70" />
      </div>
    </div>
  );
}

type PageSliceProps = {
  pageNumber: number;
  width: number;
  height: number;
  offset: number;
  highlights: HighlightBox[];
  onRenderSuccess: (page: PDFPageProxy) => void;
};

function PageSlice({
  pageNumber,
  width,
  height,
  offset,
  highlights,
  onRenderSuccess,
}: PageSliceProps) {
  return (
    <div className="w-full overflow-hidden" style={{ height }}>
      <div className="relative" style={{ transform: `translateY(-${offset}px)` }}>
        <Page pageNumber={pageNumber} width={width} onRenderSuccess={onRenderSuccess} />
        <div className="pointer-events-none absolute inset-0">
          {highlights.map((box) => (
            <div
              key={box.id}
              className={`absolute rounded-[6px] border ${
                box.kind === "heading"
                  ? "border-amber-200/70 bg-amber-200/20"
                  : "border-sky-200/70 bg-sky-200/15"
              }`}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
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
  const [splitMode, setSplitMode] = useState(false);
  const [split, setSplit] = useState<{ page: number; ratio: number } | null>(null);
  const [animateSplit, setAnimateSplit] = useState(true);
  const [animateOnClick, setAnimateOnClick] = useState(true);
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

  const handleLoadSuccess = ({ numPages: loadedPages }: PdfLoadSuccess) => {
    setNumPages(loadedPages);
  };

  const pages = useMemo(() => {
    if (numPages <= 0) return [];
    return Array.from({ length: numPages }, (_, index) => index + 1);
  }, [numPages]);

  const highlightSources = useMemo<HighlightSource[]>(() => {
    const sources: HighlightSource[] = [];

    SECTION_DATA.sections.forEach((section) => {
      sources.push({
        id: `${section.id}-heading`,
        sectionId: section.id,
        kind: "heading",
        ...section.headingPosition,
      });

      section.textPosition.forEach((position, index) => {
        sources.push({
          id: `${section.id}-text-${index}`,
          sectionId: section.id,
          kind: "text",
          ...position,
        });
      });
    });

    return sources;
  }, []);

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

      const padded = {
        ...scaled,
        x: scaled.x - HIGHLIGHT_PADDING,
        y: scaled.y - HIGHLIGHT_PADDING,
        width: scaled.width + HIGHLIGHT_PADDING * 2,
        height: scaled.height + HIGHLIGHT_PADDING * 2,
      };

      if (!grouped[source.page]) grouped[source.page] = [];
      grouped[source.page].push(padded);
    });

    Object.keys(grouped).forEach((page) => {
      const pageNumber = Number(page);
      grouped[pageNumber] = adjustOverlaps(grouped[pageNumber]);
    });

    return grouped;
  }, [highlightSources, pageMetrics]);

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
    return SECTION_DATA.sections.flatMap((section) => {
      const page = section.headingPosition.page;
      const pageHighlights = highlightsByPage[page];
      if (!pageHighlights) return [];

      const headingHighlight = pageHighlights.find(
        (box) => box.sectionId === section.id && box.kind === "heading"
      );

      if (!headingHighlight) return [];

      return [
        {
          id: section.id,
          page,
          y: headingHighlight.y,
          height: headingHighlight.height,
          heading: section.heading,
          sectionType: section.sectionType,
        },
      ];
    });
  }, [highlightsByPage]);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_45%,_#020617_100%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Pdf Test
          </span>
          <h1 className="text-3xl font-semibold">React PDF Preview</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Rendering <span className="font-semibold text-slate-200">test.pdf</span> from
            the public folder.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 pt-4 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSplitMode((value) => !value)}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition"
              >
                {splitMode ? "Exit Split Mode" : "Split Mode"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingSplit(null);
                  setSplit(null);
                  setSplitOpen(false);
                }}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!split}
              >
                Clear Split
              </button>
              <button
                type="button"
                onClick={() => setAnimateSplit((value) => !value)}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition"
              >
                {animateSplit ? "Animation On" : "Animation Off"}
              </button>
              <button
                type="button"
                onClick={() => setAnimateOnClick((value) => !value)}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition"
              >
                {animateOnClick ? "Animate Every Click" : "Animate Once"}
              </button>
            </div>
            <div className="text-right">
              <div>{numPages > 0 ? `${numPages} pages` : "Loading document..."}</div>
              {split ? (
                <div className="text-xs text-emerald-200">
                  Split: page {split.page} at {Math.round(split.ratio * 100)}%
                </div>
              ) : null}
            </div>
          </div>
          <p className="mb-4 px-4 text-xs text-slate-400">
            {splitMode
              ? "Click anywhere on a page to set a horizontal split. We keep the PDF immutable and store only the split coordinates."
              : "Enable split mode to drop a single horizontal split line."}
          </p>
          <div className="flex gap-6 px-4 pb-6">
            <aside className="w-64">
              <div
                className="relative"
                style={{ height: documentHeight || "auto" }}
              >
                {sidebarAnchors.map((anchor) => {
                  const height = pageMetrics[anchor.page]?.height ?? 0;
                  const splitY =
                    split?.page === anchor.page && height > 0
                      ? Math.round(height * split.ratio)
                      : null;
                  const localGap =
                    splitOpen && splitY !== null && anchor.y >= splitY ? GAP_HEIGHT : 0;
                  const top =
                    (pageOffsets[anchor.page] ?? 0) +
                    anchor.y +
                    localGap +
                    anchor.height / 2;

                  return (
                    <button
                      key={anchor.id}
                      type="button"
                      onClick={() => {
                        const pageHeight = pageMetrics[anchor.page]?.height ?? 0;
                        if (!pageHeight) return;
                        const targetY = anchor.y + anchor.height + 5;
                        applySplit(anchor.page, targetY / pageHeight);
                        if (animateSplit && animateOnClick) {
                          window.setTimeout(() => scrollToAnchor(anchor), ANIMATION_MS + 50);
                          return;
                        }
                        scrollToAnchor(anchor);
                      }}
                      className="absolute left-0 right-0 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.35)] transition hover:border-emerald-300/40 hover:text-white"
                      style={{ top }}
                    >
                      <span className="text-[10px] uppercase tracking-[0.22em] text-emerald-200">
                        {anchor.sectionType}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-slate-100">
                        {anchor.heading}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div ref={pdfScrollRef} className="flex-1 rounded-xl bg-slate-950/40">
              <Document
                file="/test.pdf"
                onLoadSuccess={handleLoadSuccess}
                loading={<span className="text-sm text-slate-300">Loading PDF…</span>}
                error={<span className="text-sm text-rose-200">Failed to load PDF.</span>}
              >
                <div ref={pageContainerRef} className="flex w-full flex-col">
                {pages.map((page) => {
                    const height = pageMetrics[page]?.height ?? 0;
                    const isActiveSplit = split?.page === page && height > 0;
                    const splitY = isActiveSplit ? Math.round(height * split!.ratio) : 0;
                    const gapOpen = isActiveSplit && splitOpen;
                    const highlights = highlightsByPage[page] ?? [];

                    return (
                      <div
                        key={`page-${page}`}
                      className="w-full border-b border-white/10 last:border-b-0"
                    >
                      <div
                        className="relative w-full"
                        onClick={(event) => handleSplitClick(page, height, event)}
                      >
                          <div className="flex w-full flex-col">
                            <PageSlice
                              pageNumber={page}
                              width={pageWidth}
                              height={splitY}
                              offset={0}
                              highlights={highlights}
                              onRenderSuccess={handlePageRender(page)}
                            />
                            <div
                              className={`overflow-hidden ${
                                animateSplit ? "transition-[height,opacity] duration-500 ease-out" : ""
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
                              highlights={highlights}
                              onRenderSuccess={handlePageRender(page)}
                            />
                          </div>
                          {splitMode ? (
                            <div className="absolute inset-0 cursor-crosshair bg-transparent" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Document>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
