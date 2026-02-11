import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

type DeleteSectionInput = {
    propertyId: string;
    sectionId: string;
};

async function deleteSection(input: DeleteSectionInput ){
    const response = await apiFetch(
        `/api/properties/${input.propertyId}/sections/${encodeURIComponent(input.sectionId)}`,
        { method: "DELETE" },
    );

    if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to delete section (${response.status})`);
    }
}

function useDeleteSectionMutation( ){
    return useMutation<void, Error, DeleteSectionInput>({
        mutationFn: deleteSection,
    });
}

export {
    type DeleteSectionInput,
    useDeleteSectionMutation,
};
