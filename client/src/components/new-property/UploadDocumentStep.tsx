import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

type UploadDocumentStepProps = {
    onUpload: (file: File) => Promise<void> | void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
};

export function UploadDocumentStep({ onUpload, isSubmitting = false, errorMessage }: UploadDocumentStepProps) {
    const [file, setFile] = useState<File | null>(null);

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const nextFile = event.target.files?.[0];
        if (!nextFile) return;
        setFile(nextFile);
    }

    function handleSubmit(): void {
        if (!file) return;
        void onUpload(file);
    }

    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">Upload Property Documents</CardTitle>
                <CardDescription>
                    Upload your declaration of division (Teilungserklärung) or rental overview.
                    We will automatically extract property details.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <label
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                        file
                            ? "border-emerald-500 bg-emerald-50/50"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
                    )}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div
                            className={cn(
                                "p-4 rounded-full mb-4 transition-colors",
                                file ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500",
                            )}
                        >
                            <Upload className="w-8 h-8" />
                        </div>
                        {file ? (
                            <div className="text-center">
                                <p className="mb-1 text-lg font-bold text-emerald-700">{file.name}</p>
                                <p className="text-sm text-emerald-600">Ready to process</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="mb-2 text-lg font-semibold text-gray-700">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-sm text-gray-500">PDF, DOCX, or Images (max. 10MB)</p>
                            </div>
                        )}
                    </div>
                    <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                </label>
            </CardContent>
            <CardFooter className="flex-col gap-2 bg-muted pt-4 pb-6 border-t mt-4">
                <Button onClick={handleSubmit} className="w-full text-lg h-10" disabled={!file || isSubmitting}>
                    {isSubmitting ? "Uploading..." : "Continue"}
                </Button>
                {errorMessage ? (
                    <p className="text-xs font-medium text-red-600">{errorMessage}</p>
                ) : null}
            </CardFooter>
        </Card>
    );
}
