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
    Upload,
    Loader2
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { PdfViewer, Checklist } from "@/components/pdf-viewer";
import type { SectionData } from "@/components/pdf-viewer";
import { mockSections } from "./pdf-test";

const STEPS = [
    { label: "Upload Document", icon: FileUp },
    { label: "Property Type", icon: Building },
    { label: "Details", icon: ClipboardList },
    { label: "Units", icon: Grid },
    { label: "Review", icon: CheckCircle },
];

function ProgressBar({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: number) => void }) {
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
                        <div 
                            key={index} 
                            onClick={() => onStepClick(index)}
                            className="flex flex-col items-center bg-transparent gap-2 w-30 relative cursor-pointer"
                        >
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
        <CardContent className="flex flex-row gap-8 h-full">
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

function PropertyDetailsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const [buildings, setBuildings] = useState(2);
    const [usage, setUsage] = useState("residential");

    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">
                    Property details
                </CardTitle>
                <CardDescription>
                    We’ve filled in what we could from your documents.
                    Please confirm the basics - You'll have a chance to review everything before finalizing.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-7">
                
                {/* Property Name */}
                <div className="space-y-2">
                    <Label htmlFor="propertyName">Property name</Label>
            
                    <Input 
                        className="p-5"
                        id="propertyName" 
                        defaultValue="Sunset Apartments" 
                        placeholder="e.g. Sunset Apartments" 
                    />
                </div>

                {/* Primary Address */}
                <div className="space-y-2">
                    <Label>Registered property address</Label>
                    <Input 
                        defaultValue="Main Street 123"
                        placeholder="Street" 
                        className="mb-2 p-5"
                    />
                    <div className="flex gap-2">
                        <Input 
                            defaultValue="10115"
                            placeholder="Postcode" 
                            className="w-1/3 p-5"
                        />
                        <Input 
                            defaultValue="Berlin"
                            placeholder="City" 
                            className="w-2/3 p-5"
                        />
                    </div>
                </div>
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
                    className="grow text-lg h-10 cursor-pointer"
                >
                    Continue
                </Button>
            </CardFooter>
        </Card>
    );
}

function UnitsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const [sections, setSections] = useState<SectionData[]>(mockSections);
    const [propertyType] = useState<"WEG" | "MV">("WEG");

    return (
        <div className=" flex gap-4">
            <div className=" max-h-[80vh] overflow-y-scroll">
                <PdfViewer
                    pdfUrl="/test.pdf"
                    pdfScale={1}
                    sections={sections}
                    onSectionAdd={(newSection) => {
                        setSections((prev) => [...prev, newSection]);
                    }}
                    onSectionUpdate={(sectionId, updates) => {
                        setSections((prev) =>
                            prev.map((section) =>
                                section.id === sectionId ? { ...section, ...updates } : section,
                            ),
                        );
                    }}
                    onSectionDelete={(sectionId) => {
                        setSections((prev) => prev.filter((section) => section.id !== sectionId));
                    }}
                />
            </div>
            <div className="w-80 shrink-0 overflow-auto">
                <Checklist sections={sections} propertyType={propertyType} />
            </div>
        </div>
        // <Card className="w-full h-[80vh] max-w-8xl flex flex-col p-0 overflow-hidden">
      
        //     <CardFooter className="flex gap-4 bg-white pt-4 pb-6 border-t z-10 shrink-0">
        //         <Button
        //             onClick={onBack}
        //             variant="ghost"
        //             className="text-lg h-10 px-10 cursor-pointer"
        //         >
        //             Back
        //         </Button>
        //         <div className="grow" />
        //          <Button
        //             onClick={onNext}
        //             className="text-lg h-10 cursor-pointer px-8"
        //         >
        //             Review & Finish
        //         </Button>
        //     </CardFooter>
        // </Card>
    );
}

function ProcessingStep() {
    return (
        <Card className="w-full pb-0 max-w-2xl h-120">
            <CardContent className="flex flex-col items-center justify-center py-12 h-full">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="mb-6"
                >
                    <Loader2 className="w-12 h-12 text-emerald-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Document</h3>
                <p className="text-gray-500 text-center max-w-sm">
                    We are extracting property details from your uploaded document. This will just take a moment.
                </p>
            </CardContent>
        </Card>
    );
}

function NewProperty() {
    const [step, setStep] = useState(3);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDocumentUpload = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setStep(1);
        }, 2000);
    };

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden">
            <ProgressBar currentStep={step} onStepClick={setStep} />
            
            <div className="w-full flex justify-center px-4 relative">
                <AnimatePresence mode="wait">
                    {step === 0 && !isProcessing && (
                        <motion.div
                            key="step-0-upload"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <UploadDocumentStep onNext={handleDocumentUpload} />
                        </motion.div>
                    )}
                    
                    {step === 0 && isProcessing && (
                        <motion.div
                            key="step-0-processing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <ProcessingStep />
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

                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <PropertyDetailsStep onNext={() => setStep(3)} onBack={() => setStep(1)} />
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step-3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <UnitsStep onNext={() => setStep(4)} onBack={() => setStep(2)} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default NewProperty;
