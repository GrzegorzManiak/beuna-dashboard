import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { SectionType } from "@shared/section-types";

type ClassifySectionInput = {
    propertyId: string;
    text: string;
    heading?: string;
};

type ClassifySectionResponse = {
    sectionType: SectionType;
    confidence: number;
    error?: string;
};

async function classifySection(input: ClassifySectionInput): Promise<ClassifySectionResponse> {
    const response = await apiFetch(`/api/properties/${input.propertyId}/classify-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.text, heading: input.heading ?? "" }),
    });

    if (!response.ok) {
        const payload = (await response.json()) as { error?: string } | null;
        return {
            sectionType: "unknown" as SectionType,
            confidence: 0,
            error: payload?.error ?? `Classification failed (${response.status})`,
        };
    }

    return (await response.json()) as ClassifySectionResponse;
}

function useClassifySectionMutation( ){
    return useMutation<ClassifySectionResponse, Error, ClassifySectionInput>({
        mutationFn: classifySection,
    });
}

export {
    type ClassifySectionInput,
    type ClassifySectionResponse,
    useClassifySectionMutation,
};
