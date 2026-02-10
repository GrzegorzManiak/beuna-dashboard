type PdfTextItem = {
    page: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontName: string;
    hasEOL: boolean;
};

type PdfLine = {
    id: number;
    page: number;
    text: string;
    tokens: string[];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontName: string;
    bold: boolean;
};

type Position = {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

type PdfSection = {
    id: string;
    heading: PdfLine;
    lines: PdfLine[];
    rawText: string;
    textPosition: Position[];
};

export {
    type PdfTextItem,
    type PdfLine,
    type Position,
    type PdfSection,
};
