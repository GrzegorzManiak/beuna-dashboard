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

export {
    type UpdatePropertyBody,
    type PropertyIdParams,
    type PropertySectionsStreamQuery,
};
