import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PdfTestPage } from "@/components/pdf-test-page";
import { Final } from "@/components/final";
import { PdfViewer } from "./components/pdf-viewer/PdfViewer";


const mockSections = [
    // Simple Single Page Section
    {
        id: "section-1",
        textPosition: {
            page: [1],
            x: 100,
            y: 172,
            width: 200,
            height: 50,
        },
    },
    // Split Area Section (Spans across split)
    {
        id: "section-2",
        textPosition: {
            page: [1],
            x: 100,
            y: 450,
            width: 200,
            height: 50,
        },
    },
    // Multi-Page Section
    {
        id: "section-3",
        textPosition: {
            page: [1, 2],
            x: 300,
            y: 850,
            width: 200,
            height: 500,
        },
    },
    // Triple-Page Section
    {
        id: "section-4",
        textPosition: {
            page: [1, 2, 3],
            x: 550,
            y: 851,
            width: 50,
            height: 1100,
        },
    },
];


export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PdfTestPage />} />
        <Route path="/final" element={<Final />} />
        <Route path="/pdf-test" element={<PdfViewer pdfUrl="/test.pdf" pdfScale={0.7} sections={mockSections} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
