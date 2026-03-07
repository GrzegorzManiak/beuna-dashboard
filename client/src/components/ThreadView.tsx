import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { EmailChain } from "@/components/EmailChain";
import { ExtractionPanel } from "@/components/ExtractionPanel";
import { useThreadQuery } from "@/hooks/useThreads";
import type { SourceSpan } from "@shared/types";

export function ThreadView() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { data: thread, isLoading, isError } = useThreadQuery(threadId);

  const [activeField, setActiveField] = useState<string | null>(null);

  const handleSpanClick = useCallback((field: string) => {
    setActiveField(field);
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  const handleFieldClick = useCallback((field: string) => {
    setActiveField((prev) => (prev === field ? null : field));
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <span className="text-xs">Thread not found</span>
      </div>
    );
  }

  const spans: SourceSpan[] = thread.state.extraction?.source_spans ?? [];

  return (
    <div className="h-screen flex">
      {/* Left: Email chain — takes remaining space */}
      <div className="flex-1 h-full overflow-hidden border-r border-border">
        <EmailChain
          emails={thread.emails}
          subject={thread.subject}
          spans={spans}
          activeField={activeField}
          actions={thread.state.actions}
          onBack={() => navigate("/")}
          onSpanClick={handleSpanClick}
        />
      </div>

      {/* Right: Extraction panel — fixed 380px */}
      <div className="w-[380px] h-full overflow-hidden shrink-0">
        <ExtractionPanel
          thread={thread}
          activeField={activeField}
          onFieldClick={handleFieldClick}
        />
      </div>
    </div>
  );
}
