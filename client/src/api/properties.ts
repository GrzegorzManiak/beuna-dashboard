import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

type PropertyManagementType = "UNKNOWN" | "WEG" | "MV";

type PropertyStatus = "DRAFT" | "ACTIVE";

type PropertyDetail = {
    id: string;
    propertyNumber: number;
    name: string;
    managementType: PropertyManagementType;
    status: PropertyStatus;
    managerId: string;
    accountantId: string;
};

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

function useCreatePropertyMutation() {
    return useMutation<CreatePropertyResponse, Error, File>({
        mutationFn: createPropertyFromPdf,
    });
}

export {
    createPropertyFromPdf,
    useCreatePropertyMutation,
    type PropertyDetail,
    type PropertyManagementType,
    type PropertyStatus,
    type CreatePropertyResponse,
};
