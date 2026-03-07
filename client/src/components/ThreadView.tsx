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

  // Shared state: which extraction field is "active" (clicked in either panel)
  const [activeField, setActiveField] = useState<string | null>(null);

  // When a highlight in the email chain is clicked → activate that field in the extraction panel
  const handleSpanClick = useCallback((field: string) => {
    setActiveField(field);
    // Auto-clear after 3s so highlight doesn't stick forever
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  // When a field in the extraction panel is clicked → activate highlights in email chain
  const handleFieldClick = useCallback((field: string) => {
    setActiveField((prev) => (prev === field ? null : field));
    // Auto-clear after 3s
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground gap-2">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading thread...</span>
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <span className="text-sm">Thread not found</span>
      </div>
    );
  }

  const spans: SourceSpan[] = thread.state.extraction?.source_spans ?? [];

  return (
    <div className="h-screen flex">
      {/* Left: Email chain (60%) */}
      <div className="w-[60%] h-full overflow-hidden">
        <EmailChain
          emails={thread.emails}
          subject={thread.subject}
          spans={spans}
          activeField={activeField}
          onBack={() => navigate("/")}
          onSpanClick={handleSpanClick}
        />
      </div>

      {/* Right: Extraction panel (40%) */}
      <div className="w-[40%] h-full overflow-hidden">
        <ExtractionPanel
          thread={thread}
          activeField={activeField}
          onFieldClick={handleFieldClick}
        />
      </div>
    </div>
  );
}
