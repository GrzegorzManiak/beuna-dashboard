import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

type CreateSessionResponse = {
    sessionId: string;
};

type CreateSessionBody = {
    userId: string;
};

async function createSession(userId: string): Promise<CreateSessionResponse> {
    const response = await apiFetch("/api/sessions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId } satisfies CreateSessionBody),
    });

    if (!response.ok) {
        let message = `Failed to create session (${response.status})`;
        try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) message = payload.error;
        } catch {
            message = `Failed to create session (${response.status})`;
        }
        throw new Error(message);
    }

    const data = (await response.json()) as CreateSessionResponse;
    return data;
}

function useCreateSessionMutation() {
    return useMutation<CreateSessionResponse, Error, string>({
        mutationFn: createSession,
    });
}

export {
    createSession,
    useCreateSessionMutation,
    type CreateSessionResponse,
    type CreateSessionBody,
};
