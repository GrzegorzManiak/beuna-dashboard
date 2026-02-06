type CreatePropertyBody = {
    name: string;
    managementType: "WEG" | "MV";
    managerId: string;
    accountantId: string;
};

type UpdatePropertyBody = {
    name?: string;
    managementType?: "WEG" | "MV";
    managerId?: string;
    accountantId?: string;
    status?: "DRAFT" | "ACTIVE";
};

type PropertyIdParams = {
    propertyId: string;
};

export {
    type CreatePropertyBody,
    type UpdatePropertyBody,
    type PropertyIdParams,
};
