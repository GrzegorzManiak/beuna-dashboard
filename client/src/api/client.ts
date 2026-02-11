import { getSessionId } from "@/lib/sessionStorage";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const sessionId = getSessionId();
    if (sessionId) headers.set("x-session-id", sessionId);

    return fetch(path, {
        ...init,
        headers,
    });
}

export {
    apiFetch,
};
