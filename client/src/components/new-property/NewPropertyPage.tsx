import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgressBar } from "./ProgressBar";
import { ApiStatus } from "./ApiStatus";
import { PropertyDetailsStep } from "./PropertyDetailsStep";
import { PropertyTypePicker } from "./PropertyTypePicker";
import { ProcessingStep } from "./ProcessingStep";
import { UnitsStep } from "./UnitsStep";
import { UploadDocumentStep } from "./UploadDocumentStep";

export function NewPropertyPage() {
    const [step, setStep] = useState<number>(3);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    function handleDocumentUpload() {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setStep(1);
        }, 2000);
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden">
            <ProgressBar currentStep={step} onStepClick={setStep} />
            <ApiStatus className="self-end pr-6 -mt-4" />

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
