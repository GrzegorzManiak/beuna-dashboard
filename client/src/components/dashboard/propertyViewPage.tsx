import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionSelector } from "@/components/SessionSelector";
import { usePropertyQuery } from "@/hooks/usePropertyQuery";
import { usePropertySectionsQuery } from "@/hooks/usePropertySectionsQuery";
import { getSessionId } from "@/lib/sessionStorage";
import { ArrowLeft, Building2, Home, MapPin } from "lucide-react";

function PropertyViewPage() {
    const navigate = useNavigate();
    const { propertyId } = useParams();
    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const { data, isLoading, isError, error } = usePropertyQuery(propertyId, Boolean(sessionId));
    const { data: sectionsData } = usePropertySectionsQuery(propertyId, Boolean(sessionId));

    const property = data?.property;
    const sections = sectionsData?.sections ?? [];

    const buildingCount = sections.filter((s) => s.sectionType === "core.building").reduce((sum, s) => {
        return sum + (Array.isArray(s.items) && s.items.length > 0 ? s.items.length : 1);
    }, 0);

    const unitCount = sections.filter((s) => s.sectionType === "units.unit_block").reduce((sum, s) => {
        return sum + (Array.isArray(s.items) && s.items.length > 0 ? s.items.length : 1);
    }, 0);

    useEffect(() => {
        function handleSessionChange(event: Event) {
            const detail = (event as CustomEvent<string | null>).detail ?? null;
            setSessionId(detail);
        }
        window.addEventListener("session-change", handleSessionChange);
        return () => window.removeEventListener("session-change", handleSessionChange);
    }, []);

    // If property is still DRAFT, redirect to onboarding
    useEffect(() => {
        if (!property) return;
        if (property.status === "DRAFT") {
            navigate(`/project/${propertyId}/onboarding`, { replace: true });
        }
    }, [property, propertyId, navigate]);

    if (!sessionId) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50/50">
                <SessionSelector />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50/50">
                <p className="text-sm text-gray-500">Loading property…</p>
            </div>
        );
    }

    if (isError || !property) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50/50">
                <p className="text-sm text-red-600">{error?.message ?? "Property not found."}</p>
                <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    const address = [property.addressStreet, property.addressPostalCode, property.addressCity]
        .filter(Boolean)
        .join(", ");

    const typeLabel = property.managementType === "WEG" ? "Condominium (WEG)" : property.managementType === "MV" ? "Rental (MV)" : "Unknown";

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="mx-auto max-w-4xl px-4 py-8">
                <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Portfolio
                </button>

                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tight text-gray-900">{property.name}</h1>
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                Active
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Project #{property.propertyNumber} · {typeLabel}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                                <MapPin className="h-4 w-4" />
                                Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm font-medium text-gray-900">
                                {address || "No address set"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                                <Building2 className="h-4 w-4" />
                                Buildings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-gray-900">{buildingCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                                <Home className="h-4 w-4" />
                                Units
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-gray-900">{unitCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Property Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Management Type</span>
                                <span className="font-medium text-gray-900">{typeLabel}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Status</span>
                                <span className="font-medium text-emerald-700">Active</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Address</span>
                                <span className="font-medium text-gray-900">{address || "—"}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Buildings</span>
                                <span className="font-medium text-gray-900">{buildingCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Units</span>
                                <span className="font-medium text-gray-900">{unitCount}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export { PropertyViewPage };
