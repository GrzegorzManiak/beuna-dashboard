import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ApiStatus } from "./ApiStatus";
import { ProgressBar } from "./ProgressBar";
import { PropertyDetailsStep } from "./PropertyDetailsStep";
import { PropertyTypePicker } from "./PropertyTypePicker";
import { UnitsStep } from "./UnitsStep";
import { SessionSelector } from "@/components/SessionSelector";

export function ProjectOnboardingPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<number>(1);

    function handleStepClick(nextStep: number): void {
        if (nextStep === 0) {
            navigate("/new");
            return;
        }
        setStep(nextStep);
    }

    function handleBackToUpload(): void {
        navigate("/new");
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden relative">
            <SessionSelector className="absolute left-6 top-6 z-20" />
            <ProgressBar currentStep={step} onStepClick={handleStepClick} />
            <ApiStatus className="self-end pr-6 -mt-4" />

            <div className="w-full flex justify-center px-4 relative">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex justify-center"
                        >
                            <PropertyTypePicker onNext={() => setStep(2)} onBack={handleBackToUpload} />
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
