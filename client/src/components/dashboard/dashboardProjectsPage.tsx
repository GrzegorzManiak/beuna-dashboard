import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionSelector } from "@/components/SessionSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PropertyManagementType, PropertyStatus } from "@/api/properties";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { getSessionId } from "@/lib/sessionStorage";

type MenuItem = {
    id: string;
    label: string;
    active?: boolean;
};

type DashboardStatus = "Needs Review" | "Drafted" | "Onboarded";

const MAIN_MENU: MenuItem[] = [
    { id: "overview", label: "Overview" },
    { id: "portfolio", label: "Portfolio", active: true },
    { id: "leasing", label: "Leasing" },
    { id: "people", label: "People" },
    { id: "finances", label: "Finances" },
    { id: "documents", label: "Documents" },
];

const SUPPORT_MENU: MenuItem[] = [
    { id: "guide", label: "Users Guide" },
    { id: "faq", label: "FAQ" },
    { id: "support", label: "Contact Support" },
    { id: "settings", label: "Settings" },
];

function mapManagementTypeLabel(type: PropertyManagementType ){
    if (type === "WEG") return "WEG";
    if (type === "MV") return "MV";
    return "Unknown";
}

function mapManagementTypeDescription(type: PropertyManagementType ){
    if (type === "WEG") return "Condominium";
    if (type === "MV") return "Rental";
    return "Not set";
}

function resolveDashboardStatus(property: { managementType: PropertyManagementType; status: PropertyStatus }): DashboardStatus{
    if (property.status === "ACTIVE") return "Onboarded";
    if (property.managementType === "UNKNOWN") return "Needs Review";
    return "Drafted";
}

function mapStatusClassName(status: DashboardStatus ){
    if (status === "Onboarded") return "border-[#b7dfcf] bg-[#edf8f3] text-[#2f7e62]";
    if (status === "Drafted") return "border-[#d4ddd8] bg-[#f2f6f4] text-[#60726a]";
    return "border-amber-200 bg-amber-50 text-amber-700";
}

function mapRowActionLabel(status: DashboardStatus ){
    if (status === "Onboarded") return "View Property";
    return "Continue Onboard";
}

function mapRowActionClassName(status: DashboardStatus ){
    if (status === "Onboarded") return "h-8 rounded-full border border-[#b7dfcf] bg-[#edf8f3] px-4 py-5 font-semibold text-[#2f7e62] hover:bg-[#deefe7]";
    return "h-8 rounded-full border border-[#d9b38f] bg-[#f6eadf] px-4 py-5 font-semibold text-[#7f5a3a] hover:bg-[#efdcc8]";
}

function computeUnits(propertyNumber: number ){
    return (propertyNumber * 7) % 42 + 8;
}

function DashboardProjectsPage( ){
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const [searchValue, setSearchValue] = useState<string>("");
    const { data, error, isError, isLoading } = usePropertiesQuery(Boolean(sessionId));
    const properties = useMemo(() => data?.properties ?? [], [data]);

    const filteredProperties = useMemo(() => {
        const value = searchValue.trim().toLowerCase();
        if (!value) return properties;
        return properties.filter((property) => {
            const type = mapManagementTypeLabel(property.managementType).toLowerCase();
            return property.name.toLowerCase().includes(value)
                || `${property.propertyNumber}`.includes(value)
                || type.includes(value);
        });
    }, [properties, searchValue]);
    const totalBuildingCount = useMemo(
        () => properties.reduce((sum, property) => sum + property.buildingCount, 0),
        [properties],
    );

    useEffect(() => {
        function handleSessionChange(event: Event ){
            const detail = (event as CustomEvent<string | null>).detail ?? null;
            setSessionId(detail);
        }

        window.addEventListener("session-change", handleSessionChange);
        return () => window.removeEventListener("session-change", handleSessionChange);
    }, []);

    function handleCreateProjectClick( ){
        navigate("/new");
    }

    function handleOpenProjectClick(projectId: string ){
        navigate(`/project/${projectId}/onboarding`);
    }

    return (
        <main className="min-h-screen bg-[#f1f4f2] text-[#233129]">
            <div className="flex min-h-screen flex-col bg-[#f8faf9] lg:flex-row">
                <aside className="flex w-full flex-col border-b border-[#d4ddd8] p-5 lg:w-[268px] lg:border-b-0 lg:border-r lg:p-6">
                    <div className="pb-4">
                        <h2 className="text-2xl font-black tracking-tight text-[#1f2f26]">Buena</h2>
                    </div>

                    <div className="border-t border-[#d4ddd8] pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#60726a]">Quick Actions</p>
                        <Input
                            className="mt-2 h-10 border-[#d4ddd8] bg-white text-sm"
                            placeholder="Search"
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                        />
                    </div>

                    <div className="mt-5 border-t border-[#d4ddd8] pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#60726a]">Menu</p>
                        <div className="mt-2 flex flex-col gap-1">
                            {MAIN_MENU.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={
                                        item.active
                                            ? "h-10 rounded-xl border border-[#b7dfcf] bg-[#edf8f3] px-3 text-left text-sm font-semibold text-[#2f7e62]"
                                            : "h-10 rounded-xl border border-transparent px-3 text-left text-sm text-[#41544b]"
                                    }
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5 border-t border-[#d4ddd8] pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#60726a]">Help & Support</p>
                        <div className="mt-2 flex flex-col gap-1">
                            {SUPPORT_MENU.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="h-10 rounded-xl border border-transparent px-3 text-left text-sm text-[#41544b]"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 lg:mt-auto">
                        <SessionSelector className="border-[#d4ddd8] bg-white shadow-none" />
                    </div>
                </aside>

                <section className="flex-1 ">
                    <div className="p-5 md:p-6 lg:p-8 flex flex-col gap-4 border-b border-[#d4ddd8] pb-5 md:flex-row md:items-center md:justify-between bg-muted">
                        <h1 className="text-4xl font-black tracking-tight text-[#1f2f26]">Portfolio</h1>
                        <Button
                            type="button"
                            onClick={handleCreateProjectClick}
                            className="h-11 rounded-full bg-[#2f7e62] px-6 text-sm font-semibold text-white hover:bg-[#286d55]"
                        >
                            Add Property
                        </Button>
                    </div>

                    <div className="mt-5 rounded-xl border border-[#d4ddd8] bg-white m-5 md:m-6 lg:m-8">
                        <div className="flex flex-col gap-3 border-b border-[#d4ddd8] p-4 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm">
                                <span className="font-semibold text-[#1f2f26]">Properties</span>
                                <span className="ml-3 text-[#60726a]">Total {filteredProperties.length}</span>
                                <span className="ml-3 text-[#60726a]">Buildings {totalBuildingCount}</span>
                            </div>
                            <div className="md:w-72">
                                <Input
                                    className="h-10 w-full border-[#d4ddd8] bg-white text-sm"
                                    placeholder="Search properties"
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="hidden grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.7fr_0.8fr] border-b border-[#d4ddd8] bg-[#f2f6f4] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#60726a] md:grid">
                            <p>Property</p>
                            <p>Type</p>
                            <p>Status</p>
                            <p>Units</p>
                            <p>Action</p>
                        </div>

                        {!sessionId && (
                            <div className="p-4 text-sm text-[#60726a]">
                                Choose a session user to load properties.
                            </div>
                        )}

                        {sessionId && isLoading && (
                            <div className="p-3">
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="mt-2 rounded-lg border border-[#d4ddd8] bg-[#f2f6f4] p-4 first:mt-0">
                                        <div className="h-3 w-24 rounded-full bg-[#d0d8d3]" />
                                        <div className="mt-2 h-5 w-44 rounded-full bg-[#d0d8d3]" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {sessionId && isError && (
                            <div className="p-4 text-sm text-red-700">
                                {error?.message ?? "Failed to load properties."}
                            </div>
                        )}

                        {sessionId && !isLoading && !isError && filteredProperties.length === 0 && (
                            <div className="p-4">
                                <p className="text-sm text-[#41544b]">No properties match your current search.</p>
                                <Button
                                    type="button"
                                    onClick={handleCreateProjectClick}
                                    className="mt-3 h-11 rounded-full bg-[#2f7e62] px-6 text-sm font-semibold text-white hover:bg-[#286d55]"
                                >
                                    Add Property
                                </Button>
                            </div>
                        )}

                        {sessionId && !isLoading && !isError && filteredProperties.length > 0 && (
                            <div>
                                {filteredProperties.map((property) => {
                                    const dashboardStatus = resolveDashboardStatus(property);
                                    return (
                                        <div
                                            key={property.id}
                                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#d4ddd8] px-3 py-4 first:border-t-0 md:grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.7fr_0.8fr] md:px-4"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-md font-semibold text-[#1f2f26]">{property.name}</p>
                                                <p className="truncate text-xs text-[#60726a]">
                                                    Project #{property.propertyNumber} · {mapManagementTypeDescription(property.managementType)}
                                                </p>
                                            </div>

                                            <p className="hidden text-sm text-[#41544b] md:block">{mapManagementTypeLabel(property.managementType)}</p>

                                            <Badge className={`h-7 rounded-full border px-3 text-xs font-semibold ${mapStatusClassName(dashboardStatus)}`}>
                                                {dashboardStatus}
                                            </Badge>

                                            <p className="hidden text-sm text-[#41544b] md:block">{computeUnits(property.propertyNumber)}</p>

                                            <Button
                                                type="button"
                                                onClick={() => handleOpenProjectClick(property.id)}
                                                className={mapRowActionClassName(dashboardStatus)}
                                            >
                                                {mapRowActionLabel(dashboardStatus)}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

export {
    DashboardProjectsPage,
};
