import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { PropertySummary } from "@/api/properties";

type ListPropertiesResponse = {
    properties: PropertySummary[];
};

async function fetchProperties( ){
    const response = await apiFetch("/api/properties");
    if (!response.ok) throw new Error(`Failed to load properties (${response.status})`);
    return (await response.json()) as ListPropertiesResponse;
}

function usePropertiesQuery(enabled = true ){
    return useQuery<ListPropertiesResponse, Error>({
        queryKey: ["properties"],
        queryFn: fetchProperties,
        enabled,
    });
}

export { type ListPropertiesResponse, usePropertiesQuery };
