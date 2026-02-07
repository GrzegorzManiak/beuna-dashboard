import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PdfTestPage } from "@/components/pdf-test-page";
import { Final } from "@/components/final";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PdfTestPage />} />
        <Route path="/final" element={<Final />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
