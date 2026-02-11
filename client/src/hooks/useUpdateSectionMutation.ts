import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

type UpdateSectionInput = {
    propertyId: string;
    sectionId: string;
    sectionType?: string;
    confidence?: number;
    state?: string;
    fields?: Record<string, unknown>;
    rawText?: string;
    headingText?: string;
    items?: unknown;
};

type UpdateSectionResponse = {
    section: {
        id: string;
        sectionIndex: number;
        headingText: string;
        rawText: string;
        textPosition: unknown;
        sectionType: string;
        confidence: number;
        renderable: boolean;
        state: string | null;
        fields: Record<string, unknown> | null;
        items: unknown;
    };
};

async function updateSection(input: UpdateSectionInput ){
    const { propertyId, sectionId, ...body } = input;

    const response = await apiFetch(
        `/api/properties/${propertyId}/sections/${encodeURIComponent(sectionId)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to update section (${response.status})`);
    }

    return (await response.json()) as UpdateSectionResponse;
}

function useUpdateSectionMutation( ){
    return useMutation<UpdateSectionResponse, Error, UpdateSectionInput>({
        mutationFn: updateSection,
    });
}

export {
    type UpdateSectionInput,
    type UpdateSectionResponse,
    useUpdateSectionMutation,
};
