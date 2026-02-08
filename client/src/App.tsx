import { BrowserRouter, Route, Routes } from "react-router-dom";
import PdfTest from "@/routes/pdf-test";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PdfTest />} />
        <Route path="/pdf-test" element={<PdfTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
