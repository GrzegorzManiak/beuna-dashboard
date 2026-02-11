import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { PropertyDetail } from "@/api/properties";

type GetPropertyResponse = {
    property: PropertyDetail;
};

async function fetchProperty(propertyId: string): Promise<GetPropertyResponse> {
    const response = await apiFetch(`/api/properties/${propertyId}`);
    if (!response.ok) throw new Error(`Failed to load property (${response.status})`);
    return (await response.json()) as GetPropertyResponse;
}

function usePropertyQuery(propertyId: string | undefined, enabled = true) {
    return useQuery<GetPropertyResponse, Error>({
        queryKey: ["property", propertyId],
        queryFn: () => fetchProperty(propertyId ?? ""),
        enabled: Boolean(propertyId) && enabled,
    });
}

export { usePropertyQuery, type GetPropertyResponse };
