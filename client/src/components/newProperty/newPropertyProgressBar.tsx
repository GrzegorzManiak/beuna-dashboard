import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Building, CheckCircle, ClipboardList, FileUp, Grid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StepDefinition = {
    label: string;
    icon: LucideIcon;
};

type NewPropertyProgressBarProps = {
    currentStep: number;
    onStepClick: (step: number) => void;
};

const STEPS: StepDefinition[] = [
    { label: "Upload Document", icon: FileUp },
    { label: "Property Type", icon: Building },
    { label: "Basic Details", icon: ClipboardList },
    { label: "Sections", icon: Grid },
    { label: "Review", icon: CheckCircle },
];

function NewPropertyProgressBar({ currentStep, onStepClick }: NewPropertyProgressBarProps){
    return (
        <div className="w-full max-w-3xl mx-auto px-4 mb-8">
            <div className="relative flex justify-between items-start">
                <div className="absolute top-5 left-0 w-full flex -z-10 px-10">
                    {STEPS.slice(0, -1).map((_, index) => {
                        const isCompleted = index < currentStep;

                        return (
                            <div key={index} className="flex-1 h-0.5 mt-0.5 relative">
                                <div className="absolute inset-x-0 top-0 h-0.5 border-t-2 border-dashed border-gray-200" />
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

                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div
                            key={step.label}
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
                                    isCompleted ? "text-white" : isCurrent ? "text-gray-900" : "text-gray-300",
                                )}
                            >
                                <Icon className="w-5 h-5" />
                            </motion.div>
                            <motion.span
                                animate={{
                                    color: isCompleted ? "#059669" : isCurrent ? "#111827" : "#9ca3af",
                                    fontWeight: isCurrent ? 600 : 500,
                                    y: isCurrent ? -2 : 0,
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

export {
    NewPropertyProgressBar,
};
