import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Inbox } from "@/components/Inbox";
import { ThreadView } from "@/components/ThreadView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inbox />} />
        <Route path="/thread/:threadId" element={<ThreadView />} />
      </Routes>
    </BrowserRouter>
  );
}

export { App };
