import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionSelector } from "@/components/SessionSelector";
import { usePropertyQuery } from "@/hooks/usePropertyQuery";
import { usePropertySectionsQuery } from "@/hooks/usePropertySectionsQuery";
import { getSessionId } from "@/lib/sessionStorage";
import { ArrowLeft, Building2, Home, MapPin } from "lucide-react";
import { ReviewPanelSection } from "@/components/newProperty/reviewPanel/reviewPanelSection";
import { ReviewPanelOwnershipCard } from "@/components/newProperty/reviewPanel/reviewPanelOwnershipCard";
import type { PropertySection, PropertySectionItem } from "@/api/properties";

/* ── Data-extraction helpers (mirrored from review panel) ── */

type SectionFields = Record<string, string | number | boolean | null>;

type SectionEntry = {
    id: string;
    fields: SectionFields;
};

function toFields(value: PropertySection["fields"] | PropertySectionItem["fields"]): SectionFields {
    if (!value || typeof value !== "object") return {} as SectionFields;
    return value as SectionFields;
}

function str(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function num(value: string | number | boolean | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function collectEntries(sections: PropertySection[], sectionType: string): SectionEntry[] {
    const result: SectionEntry[] = [];
    for (const section of sections) {
        const hasItems = Array.isArray(section.items) && section.items.length > 0;
        if (section.sectionType === sectionType && !hasItems) {
            result.push({ id: section.id, fields: toFields(section.fields) });
        }
        if (!hasItems) continue;
        for (let i = 0; i < section.items!.length; i++) {
            const item = section.items![i];
            if (!item) continue;
            const resolved = item.sectionType ?? section.sectionType;
            if (resolved !== sectionType) continue;
            result.push({ id: item.id ?? `${section.id}-${i}`, fields: toFields(item.fields) });
        }
    }
    return result;
}

const EM = "—";
function fmtNum(v: number) {
    if (v === 0) return EM;
    return v % 1 === 0 ? String(v) : v.toFixed(2);
}

function fmtAddress(street: string, houseNumber: string, postalCode: string, city: string) {
    const line1 = [street.trim(), houseNumber.trim()].filter(Boolean).join(" ");
    const line2 = [postalCode.trim(), city.trim()].filter(Boolean).join(" ");
    return [line1, line2].filter(Boolean).join(", ") || EM;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
    apartment: "Apartment",
    office: "Office",
    parking: "Parking",
    garden: "Garden",
    storage: "Storage",
    other: "Other",
};

const RIGHT_TYPE_LABELS: Record<string, string> = {
    terrace: "Terrace",
    roofTerrace: "Roof terrace",
    garden: "Garden",
    parkingAccess: "Parking access",
    mixed: "Mixed",
    other: "Other",
};

/* ── Component ── */

function PropertyViewPage() {
    const navigate = useNavigate();
    const { propertyId } = useParams();
    const [sessionId, setSessionId] = useState<string | null>(getSessionId());
    const { data, isLoading, isError, error } = usePropertyQuery(propertyId, Boolean(sessionId));
    const { data: sectionsData } = usePropertySectionsQuery(propertyId, Boolean(sessionId));

    const property = data?.property;
    const sections = useMemo(() => sectionsData?.sections ?? [], [sectionsData]);

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

    /* ── Derived data ── */

    const buildingEntries = useMemo(() => collectEntries(sections, "core.building"), [sections]);
    const unitEntries = useMemo(() => collectEntries(sections, "units.unit_block"), [sections]);
    const specialRightsEntries = useMemo(() => collectEntries(sections, "weg.special_rights"), [sections]);
    const managerEntries = useMemo(() => collectEntries(sections, "weg.property_manager"), [sections]);
    const accountantEntries = useMemo(() => collectEntries(sections, "weg.accountant"), [sections]);
    const meaEntries = useMemo(() => collectEntries(sections, "weg.mea_declaration"), [sections]);

    const propertyType: "WEG" | "MV" = property?.managementType === "MV" ? "MV" : "WEG";

    const buildingRows = useMemo(() => {
        return buildingEntries.map((e) => {
            const uuid = str(e.fields.buildingUuid).trim() || e.id;
            const matching = unitEntries.filter((u) => str(u.fields.buildingRef).trim() === uuid);
            let totalArea = 0;
            let totalMea = 0;
            for (const u of matching) {
                const a = parseFloat(str(u.fields.area));
                const m = parseFloat(str(u.fields.meaNumerator));
                if (Number.isFinite(a)) totalArea += a;
                if (Number.isFinite(m)) totalMea += m;
            }
            return {
                id: e.id,
                uuid,
                name: str(e.fields.buildingName),
                label: str(e.fields.label),
                street: str(e.fields.addressStreet),
                houseNumber: str(e.fields.addressHouseNumber),
                postalCode: str(e.fields.addressPostalCode),
                city: str(e.fields.addressCity),
                unitCount: matching.length,
                totalArea,
                totalMea,
                floors: str(e.fields.floors),
                buildYear: str(e.fields.buildYear),
            };
        });
    }, [buildingEntries, unitEntries]);

    const buildingLabelByUuid = useMemo(() => {
        const map = new Map<string, string>();
        for (const b of buildingRows) {
            map.set(b.uuid, b.name.trim() || b.label.trim() || "Unnamed building");
        }
        return map;
    }, [buildingRows]);

    const specialRightsByUnit = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const e of specialRightsEntries) {
            const ref = str(e.fields.unitRef).trim();
            if (!ref) continue;
            const desc = str(e.fields.description).trim();
            const rt = str(e.fields.rightType).trim();
            const label = desc || rt || "Special right";
            map.set(ref, [...(map.get(ref) ?? []), label]);
        }
        return map;
    }, [specialRightsEntries]);

    const unitRows = useMemo(() => {
        return unitEntries.map((e) => {
            const buildingRef = str(e.fields.buildingRef).trim();
            const unitNumber = str(e.fields.unitNumber).trim();
            const unitKey = unitNumber || str(e.fields.label).trim();
            const sr = unitKey ? specialRightsByUnit.get(unitKey) ?? [] : [];
            return {
                id: e.id,
                unitNumber,
                unitType: str(e.fields.unitType).trim(),
                buildingRef,
                buildingLabel: buildingLabelByUuid.get(buildingRef) ?? "Unassigned",
                area: str(e.fields.area).trim(),
                meaNumerator: str(e.fields.meaNumerator).trim(),
                specialRightsLabel: sr.join(", "),
                floor: str(e.fields.floor).trim(),
                rooms: str(e.fields.rooms).trim(),
                description: str(e.fields.description).trim(),
            };
        });
    }, [unitEntries, buildingLabelByUuid, specialRightsByUnit]);

    const groupedUnits = useMemo(() => {
        const groups = new Map<string, typeof unitRows>();
        const unassigned: typeof unitRows = [];
        for (const row of unitRows) {
            if (!row.buildingRef) {
                unassigned.push(row);
                continue;
            }
            const list = groups.get(row.buildingRef) ?? [];
            list.push(row);
            groups.set(row.buildingRef, list);
        }
        const sorted = Array.from(groups.entries()).sort((a, b) => {
            const la = buildingLabelByUuid.get(a[0]) ?? "";
            const lb = buildingLabelByUuid.get(b[0]) ?? "";
            return la.localeCompare(lb);
        });
        return { sorted, unassigned };
    }, [unitRows, buildingLabelByUuid]);

    const specialRightsRows = useMemo(() => {
        return specialRightsEntries.map((e) => ({
            id: e.id,
            unitRef: str(e.fields.unitRef),
            rightType: str(e.fields.rightType),
            description: str(e.fields.description),
            area: str(e.fields.area),
        }));
    }, [specialRightsEntries]);

    const managerPerson = useMemo(() => {
        const e = managerEntries[0];
        if (!e) return null;
        return { name: str(e.fields.managerName), street: str(e.fields.addressStreet), houseNumber: str(e.fields.addressHouseNumber), postalCode: str(e.fields.addressPostalCode), city: str(e.fields.addressCity), notes: str(e.fields.notes) };
    }, [managerEntries]);

    const accountantPerson = useMemo(() => {
        const e = accountantEntries[0];
        if (!e) return null;
        return { name: str(e.fields.accountantName), street: str(e.fields.addressStreet), houseNumber: str(e.fields.addressHouseNumber), postalCode: str(e.fields.addressPostalCode), city: str(e.fields.addressCity), notes: str(e.fields.notes) };
    }, [accountantEntries]);

    const totalMea = useMemo(() => {
        if (propertyType !== "WEG") return null;
        const e = meaEntries[0];
        if (!e) return null;
        return num(e.fields.totalMea);
    }, [meaEntries, propertyType]);

    const allocatedMea = useMemo(() => {
        if (propertyType !== "WEG") return 0;
        return unitRows.reduce((sum, u) => sum + (num(u.meaNumerator) ?? 0), 0);
    }, [propertyType, unitRows]);

    /* ── Guards ── */

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

    /* ── Render helpers for unit rows ── */
    const renderUnitHeader = () => (
        <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Area</th>
                {propertyType === "WEG" && <th className="px-3 py-2">MEA</th>}
                <th className="px-3 py-2">Floor</th>
                <th className="px-3 py-2">Rooms</th>
                <th className="px-3 py-2">Special Rights</th>
            </tr>
        </thead>
    );

    const renderUnitRow = (row: (typeof unitRows)[number]) => (
        <tr key={row.id} className="odd:bg-muted/10">
            <td className="px-3 py-2 text-sm font-medium text-gray-900">{row.unitNumber || EM}</td>
            <td className="px-3 py-2 text-sm text-gray-700">{UNIT_TYPE_LABELS[row.unitType] ?? (row.unitType || EM)}</td>
            <td className="px-3 py-2 text-sm text-gray-700">{row.area || EM}</td>
            {propertyType === "WEG" && <td className="px-3 py-2 text-sm text-gray-700">{row.meaNumerator || EM}</td>}
            <td className="px-3 py-2 text-sm text-gray-700">{row.floor || EM}</td>
            <td className="px-3 py-2 text-sm text-gray-700">{row.rooms || EM}</td>
            <td className="px-3 py-2 text-sm text-gray-600">{row.specialRightsLabel || EM}</td>
        </tr>
    );

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Back button */}
                <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Portfolio
                </button>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-gray-900">{property.name}</h1>
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        Project #{property.propertyNumber} · {typeLabel}
                    </p>
                </div>

                {/* Summary cards */}
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Address</p>
                            <p className="truncate text-sm font-medium text-gray-900">{address || "No address set"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Buildings</p>
                            <p className="text-lg font-bold text-gray-900">{buildingRows.length}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <Home className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Units</p>
                            <p className="text-lg font-bold text-gray-900">{unitRows.length}</p>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    {/* Buildings */}
                    <ReviewPanelSection title="Buildings" subtitle={`${buildingRows.length} building(s)`}>
                        {buildingRows.length === 0 ? (
                            <p className="text-sm text-gray-500">No buildings detected.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <th className="px-3 py-2">Building</th>
                                            <th className="px-3 py-2">Address</th>
                                            <th className="px-3 py-2 text-right">Floors</th>
                                            <th className="px-3 py-2 text-right">Units</th>
                                            <th className="px-3 py-2 text-right">Total Area</th>
                                            {propertyType === "WEG" && <th className="px-3 py-2 text-right">Total MEA</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {buildingRows.map((row) => (
                                            <tr key={row.id} className="odd:bg-muted/10">
                                                <td className="px-3 py-2 text-sm text-gray-900">
                                                    <span className="font-semibold">{row.name || "Unnamed building"}</span>
                                                    {row.label ? <span className="ml-1 text-gray-500">({row.label})</span> : null}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-gray-600">{fmtAddress(row.street, row.houseNumber, row.postalCode, row.city)}</td>
                                                <td className="px-3 py-2 text-right text-sm text-gray-700">{row.floors.trim() || EM}</td>
                                                <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">{row.unitCount}</td>
                                                <td className="px-3 py-2 text-right text-sm text-gray-700">{fmtNum(row.totalArea)}</td>
                                                {propertyType === "WEG" && <td className="px-3 py-2 text-right text-sm text-gray-700">{fmtNum(row.totalMea)}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </ReviewPanelSection>

                    {/* Units */}
                    <ReviewPanelSection title="Units" subtitle={`${unitRows.length} unit(s)`}>
                        {unitRows.length === 0 ? (
                            <p className="text-sm text-gray-500">No units detected.</p>
                        ) : (
                            <div className="space-y-4">
                                {groupedUnits.sorted.map(([buildingUuid, units]) => (
                                    <div key={buildingUuid}>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {buildingLabelByUuid.get(buildingUuid) ?? "Unknown building"}
                                        </p>
                                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                {renderUnitHeader()}
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {units.map(renderUnitRow)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}

                                {groupedUnits.unassigned.length > 0 && (
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
                                            Unassigned
                                        </p>
                                        <div className="overflow-x-auto rounded-lg border border-amber-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                {renderUnitHeader()}
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {groupedUnits.unassigned.map(renderUnitRow)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ReviewPanelSection>

                    {/* Ownership Structure (WEG only) */}
                    {propertyType === "WEG" && (
                        <ReviewPanelSection title="Ownership Structure" subtitle="MEA / Voting">
                            <ReviewPanelOwnershipCard
                                totalMea={totalMea}
                                allocatedMea={allocatedMea}
                                propertyType={propertyType}
                            />
                        </ReviewPanelSection>
                    )}

                    {/* Special Rights */}
                    <ReviewPanelSection title="Special Rights" subtitle={`${specialRightsRows.length} right(s)`}>
                        {specialRightsRows.length === 0 ? (
                            <p className="text-sm text-gray-500">No special rights detected.</p>
                        ) : (
                            <div className="space-y-2">
                                {specialRightsRows.map((row) => (
                                    <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-3">
                                        <div className="grid gap-2 sm:grid-cols-[140px_180px_minmax(0,1fr)] sm:items-center">
                                            <div className="px-2 py-1">
                                                <p className="text-sm font-semibold text-gray-900">Unit {row.unitRef || "—"}</p>
                                            </div>
                                            <div className="px-2 py-1">
                                                <p className="text-sm text-gray-700">
                                                    {RIGHT_TYPE_LABELS[row.rightType.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())] ?? (row.rightType || EM)}
                                                </p>
                                            </div>
                                            <div className="px-2 py-1">
                                                <p className="text-sm text-gray-600">{row.description || EM}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReviewPanelSection>

                    {/* Administration */}
                    <ReviewPanelSection title="Administration">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Property Manager</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{managerPerson?.name || "Not detected"}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {managerPerson ? fmtAddress(managerPerson.street, managerPerson.houseNumber, managerPerson.postalCode, managerPerson.city) : "Not detected"}
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Accountant</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{accountantPerson?.name || "Not detected"}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {accountantPerson ? fmtAddress(accountantPerson.street, accountantPerson.houseNumber, accountantPerson.postalCode, accountantPerson.city) : "Not detected"}
                                </p>
                            </div>
                        </div>
                    </ReviewPanelSection>
                </div>
            </div>
        </div>
    );
}

export { PropertyViewPage };
