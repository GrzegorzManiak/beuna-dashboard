type ReviewPanelTone = "success" | "warning" | "error";

type ReviewPanelPropertyDraft = {
    name: string;
    street: string;
    postalCode: string;
    city: string;
};

type ReviewPanelRowMeta = {
    id: string;
    parentSectionId: string;
    itemId: string | null;
};

type ReviewPanelBuildingRow = ReviewPanelRowMeta & {
    buildingUuid: string;
    buildingName: string;
    label: string;
    addressStreet: string;
    addressHouseNumber: string;
    addressPostalCode: string;
    addressCity: string;
    unitCount: number;
    totalArea: number;
    totalMea: number;
    buildYear: string;
    floors: string;
    notes: string;
};

type ReviewPanelUnitRow = ReviewPanelRowMeta & {
    unitNumber: string;
    unitType: string;
    buildingRef: string;
    buildingLabel: string;
    area: string;
    meaNumerator: string;
    specialRightsLabel: string;
    floor: string;
    entrance: string;
    rooms: string;
    description: string;
};

type ReviewPanelSpecialRightRow = ReviewPanelRowMeta & {
    unitRef: string;
    rightType: string;
    description: string;
    area: string;
};

type ReviewPanelAdministrationPerson = ReviewPanelRowMeta & {
    name: string;
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    roleLabel: string;
    notes: string;
};

type ReviewPanelIssue = {
    message: string;
    scrollToId?: string;
};

type ReviewPanelValidation = {
    tone: ReviewPanelTone;
    title: string;
    subtitle: string;
    hardIssues: ReviewPanelIssue[];
    softIssues: ReviewPanelIssue[];
    canCreate: boolean;
};

type ReviewPanelBuildingOption = {
    value: string;
    label: string;
};

export {
    type ReviewPanelAdministrationPerson,
    type ReviewPanelBuildingOption,
    type ReviewPanelBuildingRow,
    type ReviewPanelIssue,
    type ReviewPanelPropertyDraft,
    type ReviewPanelRowMeta,
    type ReviewPanelSpecialRightRow,
    type ReviewPanelTone,
    type ReviewPanelUnitRow,
    type ReviewPanelValidation,
};
