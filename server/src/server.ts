import { loadState } from "./state";
import { loadAnalytics } from "./analytics";
import {
  handleGetThreads,
  handleGetThread,
  handleGetSent,
  handleGetDashboard,
  handleAnalyzeThread,
  handleAnalyzeAll,
  handleUpdateThread,
  handleThreadAction,
  handleApproveAction,
  handleResolveThread,
  handleReset,
} from "./routes";

// ── Initialize state on startup ──────────────────────────────────────
loadState();
loadAnalytics();
console.log("✓ State loaded");

// ── CORS headers ─────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function addCors(response: Response): Response {
  for (const [k, v] of Object.entries(CORS)) {
    response.headers.set(k, v);
  }
  return response;
}

// ── Route matching ───────────────────────────────────────────────────
type RouteParams = Record<string, string>;

function matchPath(
  pattern: string,
  pathname: string
): RouteParams | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: RouteParams = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const actual = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = actual;
    } else if (pp !== actual) {
      return null;
    }
  }
  return params;
}

// ── Server ───────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 5713;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { method, pathname } = { method: req.method, pathname: url.pathname };

    // CORS preflight
    if (method === "OPTIONS") {
      return addCors(new Response(null, { status: 204 }));
    }

    let response: Response;

    try {
      // ── Routes ─────────────────────────────────────────────────
      if (method === "GET" && pathname === "/threads") {
        response = handleGetThreads();
      }
      //
      else if (method === "GET" && pathname === "/sent") {
        response = handleGetSent();
      }
      //
      else if (method === "GET" && pathname === "/dashboard") {
        response = handleGetDashboard();
      }
      //
      else if (method === "GET" && matchPath("/threads/:id", pathname)) {
        const params = matchPath("/threads/:id", pathname)!;
        response = handleGetThread(params.id!);
      }
      //
      else if (method === "POST" && pathname === "/threads/analyze-all") {
        response = await handleAnalyzeAll();
      }
      //
      else if (method === "POST" && matchPath("/threads/:id/analyze", pathname)) {
        const params = matchPath("/threads/:id/analyze", pathname)!;
        response = await handleAnalyzeThread(params.id!);
      }
      //
      else if (method === "PATCH" && matchPath("/threads/:id", pathname)) {
        const params = matchPath("/threads/:id", pathname)!;
        const body = await req.json();
        response = await handleUpdateThread(params.id!, body);
      }
      //
      else if (method === "POST" && matchPath("/threads/:id/action", pathname)) {
        const params = matchPath("/threads/:id/action", pathname)!;
        const body = await req.json();
        response = await handleThreadAction(params.id!, body);
      }
      //
      else if (
        method === "POST" &&
        matchPath("/threads/:id/action/:actionId/approve", pathname)
      ) {
        const params = matchPath(
          "/threads/:id/action/:actionId/approve",
          pathname
        )!;
        response = handleApproveAction(params.id!, params.actionId!);
      }
      //
      else if (method === "POST" && matchPath("/threads/:id/resolve", pathname)) {
        const params = matchPath("/threads/:id/resolve", pathname)!;
        response = handleResolveThread(params.id!);
      }
      //
      else if (method === "POST" && pathname === "/reset") {
        response = handleReset();
      }
      //
      else if (method === "GET" && pathname === "/health") {
        response = new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      //
      else {
        response = new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Server error:", message);
      response = new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return addCors(response);
  },
});

console.log(`🚀 Server running on http://localhost:${PORT}`);
