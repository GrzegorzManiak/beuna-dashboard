import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NewPropertyUpload } from "@/routes/new-property";
import { ProjectOnboarding } from "@/routes/project-onboarding";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/new" element={<NewPropertyUpload />} />
                <Route path="/project/:propertyId/onboarding" element={<ProjectOnboarding />} />
            </Routes>
        </BrowserRouter>
    );
}
