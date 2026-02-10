import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { getResolvedPDFJS } from "unpdf";
import type { PdfTextItem } from "./types";

const require = createRequire(import.meta.url);

const getStandardFontDataUrl = () => {
    const pkgJsonPath = require.resolve("pdfjs-dist/package.json");
    const pdfjsDir = path.dirname(pkgJsonPath);
    return path.join(pdfjsDir, "standard_fonts/");
};

const extractTextItemsFromData = async (data: Uint8Array): Promise<PdfTextItem[]> => {
    const { getDocument } = await getResolvedPDFJS();
    const pdf = await getDocument({
        data,
        standardFontDataUrl: getStandardFontDataUrl(),
    }).promise;

    const items: PdfTextItem[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        for (const item of content.items) {
            if (!("str" in item)) continue;
            const raw = item.str ?? "";
            const text = String(raw);
            if (!text.trim()) continue;

            const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
            const fontSize = Math.hypot(transform[0], transform[1]);
            const x = transform[4] ?? 0;
            const yBottom = transform[5] ?? 0;
            // transform[5] is the text baseline measured from the page bottom.
            // Convert to top-origin by subtracting from viewport height, then
            // shift up by the glyph height so `y` is the top edge of the text
            // (not the baseline).  This matches how react-pdf's TextLayer
            // positions <span> elements via CSS transforms.
            const itemHeight = item.height ?? 0;
            const y = viewport.height - yBottom - itemHeight;

            items.push({
                page: pageNum,
                text,
                x,
                y,
                width: item.width ?? 0,
                height: item.height ?? 0,
                fontSize,
                fontName: item.fontName ?? "",
                hasEOL: Boolean(item.hasEOL),
            });
        }
    }

    return items;
};

async function extractPdfTextItems(pdfPath: string): Promise<PdfTextItem[]> {
    const buffer = await readFile(pdfPath);
    return extractTextItemsFromData(new Uint8Array(buffer));
}

async function extractPdfTextItemsFromBuffer(buffer: Buffer | Uint8Array): Promise<PdfTextItem[]> {
    const data = Buffer.isBuffer(buffer)
        ? new Uint8Array(buffer)
        : buffer instanceof Uint8Array
            ? buffer
            : new Uint8Array(buffer);
    return extractTextItemsFromData(data);
}

export {
    extractPdfTextItems,
    extractPdfTextItemsFromBuffer,
};
