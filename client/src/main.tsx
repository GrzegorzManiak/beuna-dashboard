import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { App } from "./App";
import { QUERY_CLIENT } from "@/lib/queryClient";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={QUERY_CLIENT}>
            <App />
        </QueryClientProvider>
    </StrictMode>,
);
