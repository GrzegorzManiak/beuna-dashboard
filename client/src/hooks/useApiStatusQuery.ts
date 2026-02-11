import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

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
    return (await response.json()) as ApiStatusResponse;
}

function useApiStatusQuery() {
    return useQuery<ApiStatusResponse, Error>({
        queryKey: ["api-status"],
        queryFn: fetchApiStatus,
    });
}

export {
    useApiStatusQuery,
    type ApiStatusInfo,
    type ApiStatusResponse,
};
