import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { PropertyDetail, PropertyManagementType } from "@/api/properties";

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

async function updateProperty(input: UpdatePropertyInput): Promise<UpdatePropertyResponse> {
    const response = await apiFetch(`/api/properties/${input.propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

    return (await response.json()) as UpdatePropertyResponse;
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

export {
    useUpdatePropertyMutation,
    type UpdatePropertyBody,
    type UpdatePropertyResponse,
    type UpdatePropertyInput,
};
