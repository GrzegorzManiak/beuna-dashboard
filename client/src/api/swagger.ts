import { useMutation } from "@tanstack/react-query";

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
    const response = await fetch("/api/openapi.json");
    if (!response.ok) throw new Error(`Failed to load API spec (${response.status})`);
    const data = (await response.json()) as OpenApiSpec;
    return data;
}

function useSwaggerSpecMutation() {
    return useMutation<OpenApiSpec, Error, void>({
        mutationFn: fetchSwaggerSpec,
    });
}

export {
    fetchSwaggerSpec,
    useSwaggerSpecMutation,
    type OpenApiInfo,
    type OpenApiSpec,
};
