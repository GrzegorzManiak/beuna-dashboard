import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

type ExtractSectionFieldsInput = {
    propertyId: string;
    sectionId: string;
    rawText: string;
    sectionType: string;
    buildings?: Array<{ uuid: string; name: string }>;
};

type ExtractSectionFieldsResponse = {
    sectionId: string;
    fields: Record<string, string | number | boolean | null>;
    elapsedMs?: number;
    error?: string;
};

async function extractSectionFields(input: ExtractSectionFieldsInput): Promise<ExtractSectionFieldsResponse> {
    const body: Record<string, unknown> = { rawText: input.rawText, sectionType: input.sectionType };
    if (input.buildings && input.buildings.length > 0) body.buildings = input.buildings;

    const response = await apiFetch(
        `/api/properties/${input.propertyId}/sections/${encodeURIComponent(input.sectionId)}/extract`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        const payload = (await response.json()) as { error?: string } | null;
        return {
            sectionId: input.sectionId,
            fields: {},
            error: payload?.error ?? `Extraction failed (${response.status})`,
        };
    }

    return (await response.json()) as ExtractSectionFieldsResponse;
}

function useExtractSectionFieldsMutation() {
    return useMutation<ExtractSectionFieldsResponse, Error, ExtractSectionFieldsInput>({
        mutationFn: extractSectionFields,
    });
}

export {
    useExtractSectionFieldsMutation,
    type ExtractSectionFieldsInput,
    type ExtractSectionFieldsResponse,
};
