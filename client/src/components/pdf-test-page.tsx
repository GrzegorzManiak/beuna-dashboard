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
  onRenderSuccess: (page: PDFPageProxy) => void;
};

function PageSlice({
  pageNumber,
  width,
  height,
  offset,
  onRenderSuccess,
}: PageSliceProps) {
  return (
    <div className="w-full overflow-hidden" style={{ height }}>
      <div style={{ transform: `translateY(-${offset}px)` }}>
        <Page pageNumber={pageNumber} width={width} onRenderSuccess={onRenderSuccess} />
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
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

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

    const ratio = Math.min(0.98, Math.max(0.02, y / height));
    const nextSplit = { page, ratio };

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

  const handlePageRender = (pageNumber: number) => (page: PDFPageProxy) => {
    const viewport = page.getViewport({ scale: 1 });
    const scale = pageWidth / viewport.width;
    const height = Math.round(viewport.height * scale);

    setPageHeights((current) => {
      if (current[pageNumber] === height) return current;
      return { ...current, [pageNumber]: height };
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
          <div className="rounded-xl bg-slate-950/40">
            <Document
              file="/test.pdf"
              onLoadSuccess={handleLoadSuccess}
              loading={<span className="text-sm text-slate-300">Loading PDF…</span>}
              error={<span className="text-sm text-rose-200">Failed to load PDF.</span>}
            >
              <div ref={pageContainerRef} className="flex w-full flex-col">
                {pages.map((page) => {
                  const height = pageHeights[page] ?? 0;
                  const isActiveSplit = split?.page === page && height > 0;
                  const splitY = isActiveSplit ? Math.round(height * split!.ratio) : 0;
                  const gapOpen = isActiveSplit && splitOpen;

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
        </section>
      </div>
    </div>
  );
}
