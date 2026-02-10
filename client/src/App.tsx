import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NewProperty } from "@/routes/new-property";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/new" element={<NewProperty />} />
            </Routes>
        </BrowserRouter>
    );
}
