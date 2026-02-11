import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NewPropertyProgressBar } from "./newPropertyProgressBar";
import { NewPropertyDetailsStage } from "./newPropertyDetailsStage";
import { NewPropertyTypePicker } from "./newPropertyTypePicker";
import { NewPropertyUnitsStage } from "./newPropertyUnitsStage";
import { NewPropertyProcessingStage } from "./newPropertyProcessingStage";
import { SessionSelector } from "@/components/SessionSelector";
import { usePropertyQuery } from "@/hooks/usePropertyQuery";
import { useUpdatePropertyMutation } from "@/hooks/useUpdatePropertyMutation";
import type { PropertyManagementType, PropertySection, BasicDetailsExtract } from "@/api/properties";
import { getSessionId } from "@/lib/sessionStorage";

type PropertyTypeSelection = "condo" | "rental";

function NewPropertyProjectOnboardingPage( ){
    const DEFAULT_PROPERTY_NAME = "Unnamed property";
    const STEP_UPLOAD = 0;
    const STEP_PROCESSING = 1;
    const STEP_PROPERTY_TYPE = 2;
    const STEP_DETAILS = 3;
    const STEP_UNITS = 4;
    const STEP_REVIEW = 5;

    const navigate = useNavigate();
    const { propertyId } = useParams();
    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const { data, isLoading, isError, error } = usePropertyQuery(propertyId, Boolean(sessionId));
    const { mutateAsync: updateProperty, isPending } = useUpdatePropertyMutation();
    const [step, setStep] = useState<number>(STEP_PROCESSING);
    const [selectedType, setSelectedType] = useState<PropertyTypeSelection | null>(null);
    const [propertyName, setPropertyName] = useState<string>("");
    const [street, setStreet] = useState<string>("");
    const [postalCode, setPostalCode] = useState<string>("");
    const [city, setCity] = useState<string>("");
    const [sections, setSections] = useState<PropertySection[]>([]);
    const [sectionsReady, setSectionsReady] = useState<boolean>(false);
    const [sectionsProcessing, setSectionsProcessing] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasHydrated, setHasHydrated] = useState<boolean>(false);
    const [basicDetails, setBasicDetails] = useState<BasicDetailsExtract | null>(null);
    const [prefilledFromExtract, setPrefilledFromExtract] = useState<boolean>(false);

    const property = data?.property;
    const selectedManagementType = selectedType ? mapSelectionToManagementType(selectedType) : null;
    const resolvedPropertyType =
        selectedManagementType
            ? selectedManagementType
            : property?.managementType === "MV"
                ? "MV"
                : "WEG";

    const toProgressIndex = useCallback((value: number): number => {
        if (value <= STEP_PROCESSING) return 0;
        if (value === STEP_PROPERTY_TYPE) return 1;
        if (value === STEP_DETAILS) return 2;
        if (value === STEP_UNITS) return 3;
        return 4;
    }, [STEP_DETAILS, STEP_PROCESSING, STEP_PROPERTY_TYPE, STEP_UNITS]);

    const fromProgressIndex = useCallback((index: number): number => {
        if (index <= 0) return STEP_UPLOAD;
        if (index === 1) return STEP_PROPERTY_TYPE;
        if (index === 2) return STEP_DETAILS;
        if (index === 3) return STEP_UNITS;
        return STEP_REVIEW;
    }, [STEP_DETAILS, STEP_PROPERTY_TYPE, STEP_REVIEW, STEP_UNITS]);

    const handleStepClick = useCallback((nextStep: number): void => {
        const nextInternal = fromProgressIndex(nextStep);
        if (nextInternal === STEP_UPLOAD) {
            navigate("/new");
            return;
        }
        if (!sectionsReady && nextInternal > STEP_PROCESSING) {
            setErrorMessage("Sections are still processing.");
            return;
        }
        setErrorMessage(null);
        setStep(nextInternal);
    }, [fromProgressIndex, navigate, sectionsReady, STEP_PROCESSING, STEP_UPLOAD]);

    function handleBackToUpload( ){
        navigate("/new");
    }

    useEffect(() => {
        setHasHydrated(false);
        setSections([]);
        setSectionsReady(false);
        setBasicDetails(null);
        setSectionsProcessing(false);
        setPrefilledFromExtract(false);
        setStep(STEP_PROCESSING);
    }, [propertyId, STEP_PROCESSING]);

    useEffect(() => {
        function handleSessionChange(event: Event ){
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

    useEffect(() => {
        if (!sections.length) return;
    }, [sections]);

    useEffect(() => {
        if (!basicDetails) return;
    }, [basicDetails]);

    useEffect(() => {
        if (!basicDetails) return;
        if (!property) return;
        if (prefilledFromExtract) return;

        const fields = new Map(basicDetails.fields.map((field) => [field.key, field]));
        const managementHint = fields.get("managementTypeHint")?.value ?? null;
        const nameValue = fields.get("propertyName")?.value ?? null;
        const streetValue = fields.get("street")?.value ?? null;
        const postalValue = fields.get("postalCode")?.value ?? null;
        const cityValue = fields.get("city")?.value ?? null;

        let didPrefill = false;

        if (!selectedType && property.managementType === "UNKNOWN") {
            if (managementHint === "WEG") {
                setSelectedType("condo");
                didPrefill = true;
            }
            if (managementHint === "MV") {
                setSelectedType("rental");
                didPrefill = true;
            }
        }

        if ((propertyName === "" || propertyName === DEFAULT_PROPERTY_NAME) && nameValue) {
            setPropertyName(nameValue);
            didPrefill = true;
        }

        if (!street && streetValue) {
            setStreet(streetValue);
            didPrefill = true;
        }

        if (!postalCode && postalValue) {
            setPostalCode(postalValue);
            didPrefill = true;
        }

        if (!city && cityValue) {
            setCity(cityValue);
            didPrefill = true;
        }

        if (didPrefill) setErrorMessage(null);
        setPrefilledFromExtract(true);
    }, [
        basicDetails,
        city,
        DEFAULT_PROPERTY_NAME,
        postalCode,
        prefilledFromExtract,
        property,
        propertyName,
        selectedType,
        street,
    ]);

    useEffect(() => {
        if (!propertyId) return;
        if (!sessionId) return;
        let isClosed = false;
        const baseUrl = window.location.origin.replace(/^http/, "ws");
        const params = new URLSearchParams({ sessionId });
        const socket = new WebSocket(`${baseUrl}/api/properties/${propertyId}/sections/stream?${params.toString()}`);

        socket.onmessage = (event) => {
            if (isClosed) return;
            try {
                const payload = JSON.parse(event.data) as {
                    status?: string;
                    sections?: PropertySection[];
                    basicDetails?: BasicDetailsExtract | null;
                    error?: string;
                };
                
                if (payload.error) {
                    setErrorMessage(payload.error);
                    return;
                }
                if (payload.status === "ready" && payload.sections) {
                    const visibleSections = payload.sections.filter(
                        (section) => section.renderable !== false || (section.items && section.items.length > 0)
                    );
                    setSections(visibleSections);
                    setSectionsReady(true);
                    setBasicDetails(payload.basicDetails ?? null);
                    setStep((current) => (current <= STEP_PROCESSING ? STEP_PROPERTY_TYPE : current));
                }
                if (payload.status === "processing") {
                    setSectionsProcessing(true);
                }
                if (payload.status === "update") {
                    if (payload.basicDetails) {
                        setBasicDetails(payload.basicDetails);
                    }
                    if (!payload.sections) {
                        return;
                    }
                    const visibleSections = payload.sections.filter(
                        (section) => section.renderable !== false || (section.items && section.items.length > 0)
                    );
                    setSections((prev) => {
                        const merged = mergeSections(prev, visibleSections);
                        return merged;
                    });
                }
                if (payload.status === "complete") {
                    setSectionsProcessing(false);
                    setSectionsReady(true);
                    if (payload.sections) {
                        const visibleSections = payload.sections.filter(
                            (section) => section.renderable !== false || (section.items && section.items.length > 0)
                        );
                        setSections(visibleSections);
                    }
                    if (payload.basicDetails) {
                        setBasicDetails(payload.basicDetails);
                    }
                    setStep((current) => (current <= STEP_PROCESSING ? STEP_PROPERTY_TYPE : current));
                    socket.close();
                }
            } catch {
                // parse failure — skip malformed WebSocket message
            }
        };

        socket.onerror = () => {
            if (isClosed) return;
            setErrorMessage("Failed to connect to section stream.");
            setSectionsProcessing(false);
        };

        socket.onclose = () => {
            isClosed = true;
            setSectionsProcessing(false);
        };

        return () => {
            isClosed = true;
            socket.close();
        };
    }, [propertyId, sessionId, STEP_PROCESSING, STEP_PROPERTY_TYPE]);

    if (!propertyId) {
return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50/50">
            <p className="text-sm text-gray-600">Project ID is missing.</p>
        </div>
    );
}


    async function handleTypeNext( ){
        if (!property) return;
        if (!propertyId) return;
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
        setStep(STEP_DETAILS);
    }

    async function handleDetailsNext( ){
        if (!property) return;
        if (!propertyId) return;
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
        setStep(STEP_UNITS);
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50/50 overflow-hidden relative">
            <SessionSelector className="absolute left-6 top-6 z-20" />
            <NewPropertyProgressBar currentStep={toProgressIndex(step)} onStepClick={handleStepClick} />

            <div className="w-full flex justify-center px-4 relative">
                {!sessionId && <p className="text-sm text-gray-600">Waiting for session...</p>}
                {sessionId && isLoading && <p className="text-sm text-gray-600">Loading project...</p>}
                {sessionId && isError && (
                    <p className="text-sm text-red-600">{error?.message ?? "Failed to load project."}</p>
                )}
                {sessionId && property && (
                    <AnimatePresence mode="wait">
                        {step === STEP_PROCESSING && (
                            <motion.div
                                key="step-processing"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full flex justify-center"
                            >
                                <NewPropertyProcessingStage errorMessage={errorMessage} />
                            </motion.div>
                        )}

                        {step === STEP_PROPERTY_TYPE && (
                            <motion.div
                                key="step-1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full flex justify-center"
                            >
                                <NewPropertyTypePicker
                                    onNext={handleTypeNext}
                                    onBack={handleBackToUpload}
                                    selectedType={selectedType}
                                    onSelect={setSelectedType}
                                    isSubmitting={isPending}
                                    errorMessage={errorMessage}
                                />
                            </motion.div>
                        )}

                        {step === STEP_DETAILS && (
                            <motion.div
                                key="step-2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full flex justify-center"
                            >
                                <NewPropertyDetailsStage
                                    onNext={handleDetailsNext}
                                    onBack={() => setStep(STEP_PROPERTY_TYPE)}
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

                        {step === STEP_UNITS && (
                            <motion.div
                                key="step-3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full flex justify-center"
                            >
                                <NewPropertyUnitsStage
                                    propertyId={propertyId}
                                    sections={sections}
                                    propertyType={resolvedPropertyType}
                                    sectionsProcessing={sectionsProcessing}
                                    onNext={() => setStep(STEP_UNITS + 1)}
                                    onBack={() => setStep(STEP_DETAILS)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

function mapManagementTypeToSelection(type: PropertyManagementType ){
    if (type === "WEG") return "condo";
    if (type === "MV") return "rental";
    return null;
}

function mapSelectionToManagementType(selection: PropertyTypeSelection ){
    return selection === "condo" ? "WEG" : "MV";
}

function mergeSections(existing: PropertySection[], incoming: PropertySection[] ){
    const map = new Map<string, PropertySection>();
    for (const section of existing) map.set(section.id, section);
    for (const section of incoming) map.set(section.id, section);
    return Array.from(map.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
}

export {
    NewPropertyProjectOnboardingPage,
};
