import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

const DOCUMENT_CACHE_MS = 15 * 60 * 1000;

async function fetchPropertyDocument(propertyId: string ){
    const response = await apiFetch(`/api/properties/${propertyId}/document`);
    if (!response.ok) throw new Error(`Failed to load document (${response.status})`);
    return response.blob();
}

function usePropertyDocumentQuery(propertyId: string | undefined, enabled = true ){
    return useQuery<Blob, Error>({
        queryKey: ["property-document", propertyId],
        queryFn: () => fetchPropertyDocument(propertyId ?? ""),
        enabled: Boolean(propertyId) && enabled,
        staleTime: DOCUMENT_CACHE_MS,
        gcTime: DOCUMENT_CACHE_MS,
    });
}

export { usePropertyDocumentQuery };
