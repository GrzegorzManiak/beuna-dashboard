import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

type OpenApiInfo = {
    title: string;
    version: string;
    description?: string;
};

type OpenApiSpec = {
    openapi: string;
    info: OpenApiInfo;
    paths: Record<string, unknown>;
    components?: Record<string, unknown>;
};

async function fetchSwaggerSpec(): Promise<OpenApiSpec> {
    const response = await apiFetch("/api/openapi.json");
    if (!response.ok) throw new Error(`Failed to load API spec (${response.status})`);
    return (await response.json()) as OpenApiSpec;
}

function useSwaggerSpecQuery() {
    return useQuery<OpenApiSpec, Error>({
        queryKey: ["swagger-spec"],
        queryFn: fetchSwaggerSpec,
    });
}

export {
    useSwaggerSpecQuery,
    type OpenApiInfo,
    type OpenApiSpec,
};
