import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
    CheckCircle, 
    ClipboardList, 
    FileUp, 
    Grid, 
    Building,
    Upload
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const STEPS = [
    { label: "Upload Document", icon: FileUp },
    { label: "Property Type", icon: Building },
    { label: "Details", icon: ClipboardList },
    { label: "Units", icon: Grid },
    { label: "Review", icon: CheckCircle },
];

function ProgressBar({ currentStep }: { currentStep: number }) {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 mb-8">
            <div className="relative flex justify-between items-start">
                {/* Connecting Lines */}
                <div className="absolute top-5 left-0 w-full flex -z-10 px-10">
                    {STEPS.slice(0, -1).map((_, index) => {
                        const isCompleted = index < currentStep;
                        return (
                            <div
                                key={index}
                                className="flex-1 h-0.5 mt-0.5 relative"
                            >
                                {/* Background dashed line */}
                                <div className="absolute inset-x-0 top-0 h-0.5 border-t-2 border-dashed border-gray-200" />
                                
                                {/* Animated solid line */}
                                <motion.div 
                                    initial={{ width: "0%" }}
                                    animate={{ width: isCompleted ? "100%" : "0%" }}
                                    transition={{ duration: 0.5, ease: "easeInOut" }}
                                    className="absolute left-0 top-0 h-0.5 bg-emerald-500"
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Steps */}
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div key={index} className="flex flex-col items-center bg-transparent gap-2 w-30 relative">
                            <motion.div 
                                animate={{
                                    scale: isCurrent ? 1.1 : 1,
                                    borderColor: isCompleted || isCurrent ? (isCompleted ? "#10b981" : "#9ca3af") : "#e5e7eb",
                                    backgroundColor: isCompleted ? "#10b981" : isCurrent ? "#f3f4f6" : "#ffffff",
                                }}
                                transition={{ duration: 0.3 }}
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white z-10",
                                    isCompleted ? "text-white" : isCurrent ? "text-gray-900" : "text-gray-300"
                                )}>
                                <Icon className="w-5 h-5" />
                            </motion.div>
                            <motion.span 
                                animate={{
                                    color: isCompleted ? "#059669" : isCurrent ? "#111827" : "#9ca3af",
                                    fontWeight: isCurrent ? 600 : 500,
                                    y: isCurrent ? -2 : 0 
                                }}
                                className="text-xs font-medium text-center leading-tight w-full"
                            >
                                {step.label}
                            </motion.span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function UploadDocumentStep({ onNext }: { onNext: () => void }) {
    const [file, setFile] = useState<File | null>(null);

    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">
                    Upload Property Documents
                </CardTitle>
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
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    )}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className={cn(
                            "p-4 rounded-full mb-4 transition-colors",
                            file ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
                        )}>
                            <Upload className="w-8 h-8" />
                        </div>
                        {file ? (
                            <div className="text-center">
                                <p className="mb-1 text-lg font-bold text-emerald-700">
                                    {file.name}
                                </p>
                                <p className="text-sm text-emerald-600">
                                    Ready to process
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="mb-2 text-lg font-semibold text-gray-700">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-sm text-gray-500">
                                    PDF, DOCX, or Images (max. 10MB)
                                </p>
                            </div>
                        )}
                    </div>
                    <Input
                        id="dropzone-file"
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                setFile(e.target.files[0]);
                            }
                        }}
                    />
                </label>
            </CardContent>
            <CardFooter className="flex-col gap-2 bg-muted pt-4 pb-6 border-t mt-4">
                <Button
                    onClick={onNext}
                    className="w-full text-lg h-10"
                    disabled={!file}
                >
                    Continue
                </Button>
            </CardFooter>
        </Card>
    );
}

function PropertyTypePicker({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const [selectedType, setSelectedType] = useState<string | null>(null);


    return (<Card className="w-full pb-0 max-w-2xl">
        <CardHeader className="mb-2">
            <CardTitle className="font-black text-2xl">
                What kind of property is this?
            </CardTitle>
            <CardDescription>
                Choose how this property is legally managed. You can change this later.
            </CardDescription>

        </CardHeader>
        <CardContent className="flex flex-row gap-8">
            <CardAction className="w-full" onClick={() => setSelectedType("condo")}>
                <div className={cn(
                    "transition-all rounded-lg border-2 border-transparent cursor-pointer",
                    selectedType === "condo" ? "p-2 border-emerald-500 bg-emerald-50 rounded-lg" : " hover:border-gray-300"
                )}>
                    <AspectRatio ratio={1}>
                        <img src="https://buena-case-study.preview.buena.com/images/8e48b6e0-1c0b-4ccf-b809-b63eabbb67e9.png" alt="WEG (Condominium)" />
                    </AspectRatio>

                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <Label htmlFor="condo" className="text-lg font-bold text-foreground/95 text-center">
                            WEG - Condominium
                        </Label>
                        <p className="mt-1 px-2 text-sm text-gray-600 text-center leading-tight mb-1">
                            Shared ownership of common areas. Voting & ownership shares matter
                        </p>
                    </div>
                </div>
            </CardAction>

            <CardAction className="w-full" onClick={() => setSelectedType("rental")}>
                <div className={cn(
                    "transition-all rounded-lg border-2 border-transparent cursor-pointer",
                    selectedType === "rental" ? "p-2 border-emerald-500 bg-emerald-50 rounded-lg" : " hover:border-gray-300"
                )}>
                    <AspectRatio ratio={1}>
                        <img src="https://buena-case-study.preview.buena.com/images/76556c9e-f1e2-4496-9144-d261fce7f6d1.png" alt="WEG (Condominium)" />
                    </AspectRatio>

                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <Label htmlFor="condo" className="text-lg font-bold text-foreground/95 text-center">
                            MV - Rental
                        </Label>
                        <p className="mt-1 px-2 text-sm text-gray-600 text-center leading-tight mb-1">
                            Multiple rental units. No ownership shares or voting
                        </p>
                    </div>
                </div>
            </CardAction>

        </CardContent>
        <CardFooter className="flex gap-4 bg-muted pt-4 pb-6 border-t mt-2">
            <Button
                onClick={onBack}
                variant="ghost"
                className="text-lg h-10 px-10 cursor-pointer"
            >
                Back
            </Button>
            <Button
                onClick={onNext}
                type="submit"
                className="grow text-lg h-10 cursor-pointer"
                disabled={!selectedType}
            >
                Continue
            </Button>
        </CardFooter>
    </Card>
    );
}

function NewProperty() {
    const [step, setStep] = useState(0);

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden">
            <ProgressBar currentStep={step} />
            
            <div className="w-full flex justify-center px-4 relative">
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div
                            key="step-0"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <UploadDocumentStep onNext={() => setStep(1)} />
                        </motion.div>
                    )}
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <PropertyTypePicker onNext={() => setStep(2)} onBack={() => setStep(0)} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}export default NewProperty;