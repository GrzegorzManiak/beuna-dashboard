import type { SectionType } from "@shared/section-types";

type PropertyManagementType = "UNKNOWN" | "WEG" | "MV";
type PropertyRelation = "MANAGER" | "ACCOUNTANT";

type PropertyStatus = "DRAFT" | "ACTIVE";

type PropertyDetail = {
    id: string;
    propertyNumber: number;
    name: string;
    managementType: PropertyManagementType;
    status: PropertyStatus;
    managerId: string | null;
    accountantId: string | null;
    addressStreet: string | null;
    addressPostalCode: string | null;
    addressCity: string | null;
};

type PropertySummary = {
    id: string;
    propertyNumber: number;
    name: string;
    managementType: PropertyManagementType;
    status: PropertyStatus;
    relation: PropertyRelation;
    buildingCount: number;
    unitCount: number;
    addressStreet: string | null;
    addressCity: string | null;
    createdAt: string;
};

type BasicDetailsField = {
    key: string;
    value: string | null;
};

type BasicDetailsExtract = {
    fields: BasicDetailsField[];
};

type PropertySectionItem = {
    id: string;
    rawText: string;
    sectionType?: string;
    state?: "valid" | "needs_review" | "unknown" | "conflict";
    confidence?: number;
    fields?: Record<string, string | number | boolean | null> | null;
    textPosition: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
};

type PropertySection = {
    id: string;
    sectionIndex: number;
    headingText: string;
    rawText: string;
    textPosition: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    sectionType: SectionType;
    confidence: number;
    renderable: boolean;
    reusable?: boolean;
    items?: PropertySectionItem[];
    state?: string | null;
    fields?: Record<string, string | number | boolean | null> | null;
};

export {
    type BasicDetailsExtract,
    type BasicDetailsField,
    type PropertyDetail,
    type PropertyManagementType,
    type PropertyRelation,
    type PropertySection,
    type PropertySectionItem,
    type PropertyStatus,
    type PropertySummary,
    type SectionType,
};
