import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { SectionType } from "@shared/section-types";

type PropertyManagementType = "UNKNOWN" | "WEG" | "MV";

type PropertyStatus = "DRAFT" | "ACTIVE";

type PropertyDetail = {
    id: string;
    propertyNumber: number;
    name: string;
    managementType: PropertyManagementType;
    status: PropertyStatus;
    managerId: string | null;
    accountantId: string | null;
    addressStreet: string | null;
    addressPostalCode: string | null;
    addressCity: string | null;
};

type PropertyDetail = {
    key: string;
    value: string | null;
    sourceText: string | null;
    sectionIndex: number | null;
    position: {
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
};

type BasicDetailsExtract = {
    fields: BasicDetailsField[];
};

type PropertySectionItem = {
    id: string;
    rawText: string;
    sectionType?: string;
    state?: "valid" | "needs_review" | "unknown" | "conflict";
    confidence?: number;
    textPosition: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
};

type PropertySection = {
    id: string;
    sectionIndex: number;
    headingText: string;
    rawText: string;
    textPosition: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    sectionType: SectionType;
    confidence: number;
    renderable: boolean;
    reusable: boolean;
    items?: PropertySectionItem[];
};

type CreatePropertyResponse = {
    property: PropertyDetail;
};

type GetPropertyResponse = {
    property: PropertyDetail;
};

type UpdatePropertyBody = {
    name?: string;
    managementType?: PropertyManagementType;
    addressStreet?: string | null;
    addressPostalCode?: string | null;
    addressCity?: string | null;
};

type UpdatePropertyResponse = {
    property: PropertyDetail;
};

type UpdatePropertyInput = {
    propertyId: string;
    updates: UpdatePropertyBody;
};

const DOCUMENT_CACHE_MS = 15 * 60 * 1000;

async function createPropertyFromPdf(file: File): Promise<CreatePropertyResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiFetch("/api/properties", {
        method: "POST",
        body: formData,
    });

    if (response.ok) {
        const data = (await response.json()) as CreatePropertyResponse;
        return data;
    }

    let message = `Failed to upload PDF (${response.status})`;
    try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
    } catch {
        message = `Failed to upload PDF (${response.status})`;
    }

    throw new Error(message);
}

async function fetchProperty(propertyId: string): Promise<GetPropertyResponse> {
    const response = await apiFetch(`/api/properties/${propertyId}`);
    if (!response.ok) throw new Error(`Failed to load property (${response.status})`);
    const data = (await response.json()) as GetPropertyResponse;
    return data;
}

async function updateProperty(input: UpdatePropertyInput): Promise<UpdatePropertyResponse> {
    const response = await apiFetch(`/api/properties/${input.propertyId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(input.updates),
    });

    if (!response.ok) {
        let message = `Failed to update property (${response.status})`;
        try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) message = payload.error;
        } catch {
            message = `Failed to update property (${response.status})`;
        }
        throw new Error(message);
    }

    const data = (await response.json()) as UpdatePropertyResponse;
    return data;
}

async function fetchPropertyDocument(propertyId: string): Promise<Blob> {
    const response = await apiFetch(`/api/properties/${propertyId}/document`);
    if (!response.ok) throw new Error(`Failed to load document (${response.status})`);
    return response.blob();
}

type ClassifySectionResponse = {
    sectionType: SectionType;
    confidence: number;
    error?: string;
};

type ExtractSectionFieldsResponse = {
    sectionId: string;
    fields: Record<string, string | number | boolean | null>;
    elapsedMs?: number;
    error?: string;
};

async function classifySection(propertyId: string, text: string, heading = ""): Promise<ClassifySectionResponse> {
    const response = await apiFetch(`/api/properties/${propertyId}/classify-section`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, heading }),
    });

    if (!response.ok) {
        const payload = (await response.json()) as { error?: string } | null;
        return {
            sectionType: "unknown",
            confidence: 0,
            error: payload?.error ?? `Classification failed (${response.status})`,
        };
    }

    const data = (await response.json()) as ClassifySectionResponse;
    return data;
}

async function extractSectionFields(
    propertyId: string,
    sectionId: string,
    rawText: string,
    sectionType: string,
    buildings?: Array<{ uuid: string; name: string }>,
): Promise<ExtractSectionFieldsResponse> {
    const body: Record<string, unknown> = { rawText, sectionType };
    if (buildings && buildings.length > 0) body.buildings = buildings;

    const response = await apiFetch(
        `/api/properties/${propertyId}/sections/${encodeURIComponent(sectionId)}/extract`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        const payload = (await response.json()) as { error?: string } | null;
        return {
            sectionId,
            fields: {},
            error: payload?.error ?? `Extraction failed (${response.status})`,
        };
    }

    return (await response.json()) as ExtractSectionFieldsResponse;
}

function useCreatePropertyMutation() {
    return useMutation<CreatePropertyResponse, Error, File>({
        mutationFn: createPropertyFromPdf,
    });
}

function usePropertyQuery(propertyId: string | undefined, enabled = true) {
    return useQuery<GetPropertyResponse, Error>({
        queryKey: ["property", propertyId],
        queryFn: () => fetchProperty(propertyId ?? ""),
        enabled: Boolean(propertyId) && enabled,
    });
}

function useUpdatePropertyMutation() {
    const queryClient = useQueryClient();

    return useMutation<UpdatePropertyResponse, Error, UpdatePropertyInput>({
        mutationFn: updateProperty,
        onSuccess: (data, variables) => {
            queryClient.setQueryData(["property", variables.propertyId], data);
        },
    });
}

function usePropertyDocumentQuery(propertyId: string | undefined, enabled = true) {
    return useQuery<Blob, Error>({
        queryKey: ["property-document", propertyId],
        queryFn: () => fetchPropertyDocument(propertyId ?? ""),
        enabled: Boolean(propertyId) && enabled,
        staleTime: DOCUMENT_CACHE_MS,
        gcTime: DOCUMENT_CACHE_MS,
    });
}

export {
    createPropertyFromPdf,
    useCreatePropertyMutation,
    fetchProperty,
    updateProperty,
    usePropertyQuery,
    useUpdatePropertyMutation,
    fetchPropertyDocument,
    usePropertyDocumentQuery,
    classifySection,
    extractSectionFields,
    type PropertyDetail,
    type PropertyManagementType,
    type PropertyStatus,
    type PropertySection,
    type SectionType,
    type BasicDetailsExtract,
    type BasicDetailsField,
    type ClassifySectionResponse,
    type ExtractSectionFieldsResponse,
    type CreatePropertyResponse,
    type GetPropertyResponse,
    type UpdatePropertyBody,
    type UpdatePropertyResponse,
    type UpdatePropertyInput,
};
