import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewPropertyProgressBar } from "./newPropertyProgressBar";
import { NewPropertyUploadDocumentStage } from "./newPropertyUploadDocumentStage";
import { useCreatePropertyMutation } from "@/hooks/useCreatePropertyMutation";
import { SessionSelector } from "@/components/SessionSelector";
import { getSessionId } from "@/lib/sessionStorage";

export function NewPropertyUploadStage() {
    const navigate = useNavigate();
    const { mutateAsync, isPending } = useCreatePropertyMutation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function handleUpload(file: File): Promise<void> {
        setErrorMessage(null);
        if (!getSessionId()) {
            setErrorMessage("Session not ready. Please wait and try again.");
            return;
        }
        try {
            const response = await mutateAsync(file);
            navigate(`/project/${response.property.id}/onboarding`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            setErrorMessage(message);
        }
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden relative">
            <SessionSelector className="absolute left-6 top-6 z-20" />
            <NewPropertyProgressBar currentStep={0} onStepClick={() => undefined} />
            <div className="w-full flex justify-center px-4 relative">
                <NewPropertyUploadDocumentStage
                    onUpload={handleUpload}
                    isSubmitting={isPending}
                    errorMessage={errorMessage}
                />
            </div>
        </div>
    );
}
