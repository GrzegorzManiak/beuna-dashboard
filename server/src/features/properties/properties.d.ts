type UpdatePropertyBody = {
    name?: string;
    managementType?: "WEG" | "MV";
    addressStreet?: string | null;
    addressPostalCode?: string | null;
    addressCity?: string | null;
    managerId?: string;
    accountantId?: string;
    status?: "DRAFT" | "ACTIVE";
};

type PropertyIdParams = {
    propertyId: string;
};

type PropertySectionsStreamQuery = {
    sessionId?: string;
};

type SectionIdParams = {
    propertyId: string;
    sectionId: string;
};

type CreateSectionBody = {
    headingText?: string;
    rawText?: string;
    textPosition: unknown;
    sectionType?: string;
    confidence?: number;
    state?: string;
    fields?: Record<string, unknown>;
};

type UpdateSectionBody = {
    sectionType?: string;
    confidence?: number;
    state?: string;
    fields?: Record<string, unknown>;
    rawText?: string;
    headingText?: string;
    items?: unknown;
};

export {
    type CreateSectionBody,
    type PropertyIdParams,
    type PropertySectionsStreamQuery,
    type SectionIdParams,
    type UpdatePropertyBody,
    type UpdateSectionBody,
};
