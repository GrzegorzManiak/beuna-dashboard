import type { SectionType } from "@shared/section-types";

type PropertyManagementType = "UNKNOWN" | "WEG" | "MV";

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

type BasicDetailsField = {
    key: string;
    value: string | null;
    sourceText: string | null;
    sectionIndex: number | null;
    position: {
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
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
    reusable: boolean;
    items?: PropertySectionItem[];
};

export {
    type BasicDetailsExtract,
    type BasicDetailsField,
    type PropertyDetail,
    type PropertyManagementType,
    type PropertySection,
    type PropertySectionItem,
    type PropertyStatus,
    type SectionType,
};
