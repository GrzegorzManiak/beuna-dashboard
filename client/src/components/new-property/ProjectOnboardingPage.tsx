import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ApiStatus } from "./ApiStatus";
import { ProgressBar } from "./ProgressBar";
import { PropertyDetailsStep } from "./PropertyDetailsStep";
import { PropertyTypePicker } from "./PropertyTypePicker";
import { UnitsStep } from "./UnitsStep";
import { SessionSelector } from "@/components/SessionSelector";
import { usePropertyQuery, useUpdatePropertyMutation } from "@/api/properties";
import type { PropertyManagementType } from "@/api/properties";
import { getSessionId } from "@/lib/session-storage";

type PropertyTypeSelection = "condo" | "rental";

export function ProjectOnboardingPage() {
    const navigate = useNavigate();
    const { propertyId } = useParams();
    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const { data, isLoading, isError, error } = usePropertyQuery(propertyId, Boolean(sessionId));
    const { mutateAsync: updateProperty, isPending } = useUpdatePropertyMutation();
    const [step, setStep] = useState<number>(1);
    const [selectedType, setSelectedType] = useState<PropertyTypeSelection | null>(null);
    const [propertyName, setPropertyName] = useState<string>("");
    const [street, setStreet] = useState<string>("");
    const [postalCode, setPostalCode] = useState<string>("");
    const [city, setCity] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasHydrated, setHasHydrated] = useState<boolean>(false);

    const property = data?.property;

    const handleStepClick = useCallback((nextStep: number): void => {
        if (nextStep === 0) {
            navigate("/new");
            return;
        }
        setErrorMessage(null);
        setStep(nextStep);
    }, [navigate]);

    function handleBackToUpload(): void {
        navigate("/new");
    }

    useEffect(() => {
        setHasHydrated(false);
    }, [propertyId]);

    useEffect(() => {
        function handleSessionChange(event: Event): void {
            const detail = (event as CustomEvent<string | null>).detail ?? null;
            setSessionId(detail);
        }

        window.addEventListener("session-change", handleSessionChange);
        return () => window.removeEventListener("session-change", handleSessionChange);
    }, []);

    useEffect(() => {
        if (!property) return;
        if (hasHydrated) return;
        setPropertyName(property.name ?? "");
        setSelectedType(mapManagementTypeToSelection(property.managementType));
        setStreet(property.addressStreet ?? "");
        setPostalCode(property.addressPostalCode ?? "");
        setCity(property.addressCity ?? "");
        setHasHydrated(true);
    }, [hasHydrated, property]);

    if (!propertyId) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50/50">
                <p className="text-sm text-gray-600">Project ID is missing.</p>
            </div>
        );
    }

    async function handleTypeNext(): Promise<void> {
        if (!property) return;
        setErrorMessage(null);
        if (!selectedType) {
            setErrorMessage("Select a property type.");
            return;
        }
        const nextType = mapSelectionToManagementType(selectedType);
        if (nextType !== property.managementType) {
            try {
                await updateProperty({ propertyId, updates: { managementType: nextType } });
            } catch (updateError) {
                const message = updateError instanceof Error ? updateError.message : "Failed to update property.";
                setErrorMessage(message);
                return;
            }
        }
        setStep(2);
    }

    async function handleDetailsNext(): Promise<void> {
        if (!property) return;
        setErrorMessage(null);
        const trimmedName = propertyName.trim();
        if (!trimmedName) {
            setErrorMessage("Property name is required.");
            return;
        }
        const trimmedStreet = street.trim();
        const trimmedPostalCode = postalCode.trim();
        const trimmedCity = city.trim();
        const hasChanges = trimmedName !== property.name
            || trimmedStreet !== (property.addressStreet ?? "")
            || trimmedPostalCode !== (property.addressPostalCode ?? "")
            || trimmedCity !== (property.addressCity ?? "");
        if (hasChanges) {
            try {
                await updateProperty({
                    propertyId,
                    updates: {
                        name: trimmedName,
                        addressStreet: trimmedStreet || null,
                        addressPostalCode: trimmedPostalCode || null,
                        addressCity: trimmedCity || null,
                    },
                });
            } catch (updateError) {
                const message = updateError instanceof Error ? updateError.message : "Failed to update property.";
                setErrorMessage(message);
                return;
            }
        }
        setStep(3);
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden relative">
            <SessionSelector className="absolute left-6 top-6 z-20" />
            <ProgressBar currentStep={step} onStepClick={handleStepClick} />
            <ApiStatus className="self-end pr-6 -mt-4" />

            <div className="w-full flex justify-center px-4 relative">
                {!sessionId && <p className="text-sm text-gray-600">Waiting for session...</p>}
                {sessionId && isLoading && <p className="text-sm text-gray-600">Loading project...</p>}
                {sessionId && isError && (
                    <p className="text-sm text-red-600">{error?.message ?? "Failed to load project."}</p>
                )}
                {sessionId && property && (
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
                                <PropertyTypePicker
                                    onNext={handleTypeNext}
                                    onBack={handleBackToUpload}
                                    selectedType={selectedType}
                                    onSelect={setSelectedType}
                                    isSubmitting={isPending}
                                    errorMessage={errorMessage}
                                />
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
                                <PropertyDetailsStep
                                    onNext={handleDetailsNext}
                                    onBack={() => setStep(1)}
                                    name={propertyName}
                                    onNameChange={setPropertyName}
                                    street={street}
                                    onStreetChange={setStreet}
                                    postalCode={postalCode}
                                    onPostalCodeChange={setPostalCode}
                                    city={city}
                                    onCityChange={setCity}
                                    isSubmitting={isPending}
                                    errorMessage={errorMessage}
                                />
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
                                <UnitsStep
                                    propertyId={propertyId}
                                    onNext={() => setStep(4)}
                                    onBack={() => setStep(2)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

function mapManagementTypeToSelection(type: PropertyManagementType): PropertyTypeSelection | null {
    if (type === "WEG") return "condo";
    if (type === "MV") return "rental";
    return null;
}

function mapSelectionToManagementType(selection: PropertyTypeSelection): PropertyManagementType {
    return selection === "condo" ? "WEG" : "MV";
}
