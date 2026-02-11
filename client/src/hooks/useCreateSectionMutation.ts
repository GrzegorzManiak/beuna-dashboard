import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

type CreateSectionInput = {
    propertyId: string;
    headingText?: string;
    rawText?: string;
    textPosition: unknown;
    sectionType?: string;
    confidence?: number;
    state?: string;
    fields?: Record<string, unknown>;
};

type CreateSectionResponse = {
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

async function createSection(input: CreateSectionInput ){
    const { propertyId, ...body } = input;

    const response = await apiFetch(`/api/properties/${propertyId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to create section (${response.status})`);
    }

    return (await response.json()) as CreateSectionResponse;
}

function useCreateSectionMutation( ){
    return useMutation<CreateSectionResponse, Error, CreateSectionInput>({
        mutationFn: createSection,
    });
}

export {
    type CreateSectionInput,
    type CreateSectionResponse,
    useCreateSectionMutation,
};
