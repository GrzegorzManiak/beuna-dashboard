import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NewPropertyUpload } from "@/routes/newProperty";
import { ProjectOnboarding } from "@/routes/projectOnboarding";

function App( ){
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/new" element={<NewPropertyUpload />} />
                <Route path="/project/:propertyId/onboarding" element={<ProjectOnboarding />} />
            </Routes>
        </BrowserRouter>
    );
}

export {
    App,
};
