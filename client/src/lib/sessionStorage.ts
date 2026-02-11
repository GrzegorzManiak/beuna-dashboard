const SESSION_ID_KEY = "beuna.sessionId";
const SESSION_USER_KEY = "beuna.sessionUserId";

function getSessionId(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SESSION_ID_KEY);
}

function setSessionId(value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_ID_KEY, value);
    window.dispatchEvent(new CustomEvent("session-change", { detail: value }));
}

function clearSessionId(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_ID_KEY);
    window.dispatchEvent(new CustomEvent("session-change", { detail: null }));
}

function getSessionUserId(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SESSION_USER_KEY);
}

function setSessionUserId(value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_USER_KEY, value);
}

function clearSessionUserId(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_USER_KEY);
}

export {
    getSessionId,
    setSessionId,
    clearSessionId,
    getSessionUserId,
    setSessionUserId,
    clearSessionUserId,
};
