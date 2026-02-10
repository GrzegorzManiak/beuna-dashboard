import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiStatus } from "./ApiStatus";
import { ProgressBar } from "./ProgressBar";
import { UploadDocumentStep } from "./UploadDocumentStep";
import { useCreatePropertyMutation } from "@/api/properties";
import { SessionSelector } from "@/components/SessionSelector";
import { getSessionId } from "@/lib/session-storage";

export function NewPropertyUploadPage() {
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
            <ProgressBar currentStep={0} onStepClick={() => undefined} />
            <ApiStatus className="self-end pr-6 -mt-4" />
            <div className="w-full flex justify-center px-4 relative">
                <UploadDocumentStep
                    onUpload={handleUpload}
                    isSubmitting={isPending}
                    errorMessage={errorMessage}
                />
            </div>
        </div>
    );
}
