import { BrowserRouter, Route, Routes } from "react-router-dom";
import PdfTest from "@/routes/pdf-test";
import NewProperty from "./routes/new-property";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/new" element={<NewProperty />} />      
        <Route path="/pdf-test" element={<PdfTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
