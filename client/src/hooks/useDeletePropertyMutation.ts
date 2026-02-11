import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

async function deleteProperty(propertyId: string) {
    const response = await apiFetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(`Failed to delete property (${response.status})`);
    }
}

function useDeletePropertyMutation() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: deleteProperty,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["properties"] });
        },
    });
}

export { useDeletePropertyMutation };
