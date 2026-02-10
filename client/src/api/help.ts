import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

type ApiStatusInfo = {
    title: string;
    version: string;
    description?: string;
};

type ApiStatusResponse = {
    status: "ok";
    timestamp: number;
    api: ApiStatusInfo;
    docsUrl: string;
    openApiUrl: string;
};

async function fetchApiStatus(): Promise<ApiStatusResponse> {
    const response = await apiFetch("/api/help/apistatus");
    if (!response.ok) throw new Error(`Failed to load API status (${response.status})`);
    const data = (await response.json()) as ApiStatusResponse;
    return data;
}

function useApiStatusMutation() {
    return useMutation<ApiStatusResponse, Error, void>({
        mutationFn: fetchApiStatus,
    });
}

export {
    fetchApiStatus,
    useApiStatusMutation,
    type ApiStatusInfo,
    type ApiStatusResponse,
};
