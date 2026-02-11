import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Dashboard } from "@/routes/dashboard";
import { NewPropertyUpload } from "@/routes/newProperty";
import { ProjectOnboarding } from "@/routes/projectOnboarding";
import { PropertyView } from "@/routes/propertyView";

function App( ){
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/new" element={<NewPropertyUpload />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/project/:propertyId" element={<PropertyView />} />
                <Route path="/project/:propertyId/onboarding/:stage?" element={<ProjectOnboarding />} />
            </Routes>
        </BrowserRouter>
    );
}

export {
    App,
};
