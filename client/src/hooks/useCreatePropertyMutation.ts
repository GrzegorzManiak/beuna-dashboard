import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { PropertyDetail } from "@/api/properties";

type CreatePropertyResponse = {
    property: PropertyDetail;
};

async function createPropertyFromPdf(file: File): Promise<CreatePropertyResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiFetch("/api/properties", {
        method: "POST",
        body: formData,
    });

    if (response.ok) return (await response.json()) as CreatePropertyResponse;

    let message = `Failed to upload PDF (${response.status})`;
    try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
    } catch {
        message = `Failed to upload PDF (${response.status})`;
    }

    throw new Error(message);
}

function useCreatePropertyMutation() {
    return useMutation<CreatePropertyResponse, Error, File>({
        mutationFn: createPropertyFromPdf,
    });
}

export { useCreatePropertyMutation, type CreatePropertyResponse };
