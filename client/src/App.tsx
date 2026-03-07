import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";
import { Inbox } from "@/components/Inbox";
import { Sent } from "@/components/Sent";
import { ThreadView } from "@/components/ThreadView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Inbox />} />
          <Route path="/sent" element={<Sent />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        <Route path="/thread/:threadId" element={<ThreadView />} />
      </Routes>
    </BrowserRouter>
  );
}

export { App };
