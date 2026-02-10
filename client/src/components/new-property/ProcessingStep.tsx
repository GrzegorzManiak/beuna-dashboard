import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type ProcessingStepProps = {
    title?: string;
    description?: string;
    errorMessage?: string | null;
};

export function ProcessingStep({
    title = "Preparing your property",
    description = "We are extracting sections and classifying the document. This should only take a moment.",
    errorMessage,
}: ProcessingStepProps) {
    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Processing sections…</p>
                </div>
                {errorMessage ? (
                    <p className="mt-4 text-xs font-medium text-red-600">{errorMessage}</p>
                ) : null}
            </CardContent>
        </Card>
    );
}
