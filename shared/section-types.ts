/**
 * Canonical section type identifiers, shared between client and server.
 *
 * Import via the `@shared/section-types` path alias configured in both
 * `client/tsconfig.app.json` and `server/tsconfig.json`.
 *
 * Adding a new section type?  Update the `SectionType` union below — both
 * the client and server will pick it up automatically.
 */

export type SectionType =
    | "core.property_overview"
    | "core.address"
    | "core.building"
    | "units.unit_block"
    | "weg.mea_declaration"
    | "weg.special_rights"
    | "weg.property_manager"
    | "weg.accountant"
    | "mv.owner_entity"
    | "unknown";

/**
 * Section types that are rendered as highlights / sidebar cards in the
 * PDF viewer.  Everything except `"unknown"`.
 */
export const RENDERABLE_SECTION_TYPES: readonly SectionType[] = [
    "core.property_overview",
    "core.address",
    "core.building",
    "units.unit_block",
    "weg.special_rights",
    "weg.mea_declaration",
    "weg.property_manager",
    "weg.accountant",
    "mv.owner_entity",
    "unknown"
] as const;
