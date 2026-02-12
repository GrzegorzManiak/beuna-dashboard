import { getSessionId, setSessionId } from "@/lib/sessionStorage";

async function apiFetch(path: string, init?: RequestInit ){
    const headers = new Headers(init?.headers);
    const sessionId = getSessionId();
    if (sessionId) headers.set("x-session-id", sessionId);

    const response = await fetch(path, {
        ...init,
        headers,
    });

    if (!sessionId) {
        const nextSessionId = response.headers.get("x-session-id");
        if (nextSessionId) setSessionId(nextSessionId);
    }

    return response;
}

export {
    apiFetch,
};
