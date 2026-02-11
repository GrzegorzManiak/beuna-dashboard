import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { PropertySection } from "@/api/properties";

type GetPropertySectionsResponse = {
    sections: PropertySection[];
};

async function fetchPropertySections(propertyId: string) {
    const response = await apiFetch(`/api/properties/${propertyId}/sections`);
    if (!response.ok) throw new Error(`Failed to load sections (${response.status})`);
    return (await response.json()) as GetPropertySectionsResponse;
}

function usePropertySectionsQuery(propertyId: string | undefined, enabled = true) {
    return useQuery<GetPropertySectionsResponse, Error>({
        queryKey: ["property-sections", propertyId],
        queryFn: () => fetchPropertySections(propertyId ?? ""),
        enabled: Boolean(propertyId) && enabled,
    });
}

export { type GetPropertySectionsResponse, usePropertySectionsQuery };
