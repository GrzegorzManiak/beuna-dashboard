import type { SectionProcessor } from "./types";
import { CoreBuildingProcessor } from "./core-building";
import { UnitsBlockProcessor } from "./units-unit-block";
import { WegAdministrationCombinedProcessor } from "./weg-administration-combined";
import { WegPropertyManagerProcessor } from "./weg-administration";
import { WegAccountantProcessor } from "./weg-accountant";
import { CoreAddressProcessor } from "./core-address";
import { CorePropertyOverviewProcessor } from "./core-property-overview";
import { WegSpecialRightsProcessor } from "./weg-special-rights";
import { WegMeaDeclarationProcessor } from "./weg-mea-total";
import { MvOwnerEntityProcessor } from "./mv-owner-entity";
import { UnknownProcessor } from "./unknown";

/**
 * Central registry of all section processors
 * Processors are checked in order - more specific types should come first
 */
const PROCESSORS: SectionProcessor[] = [
    // Array-based sections (buildings, units) - check these first as they're more specific
    new CoreBuildingProcessor(),
    new UnitsBlockProcessor(),

    // WEG-specific sections (single objects)
    new WegMeaDeclarationProcessor(),
    new WegSpecialRightsProcessor(),
    // Combined admin processor must come BEFORE individual ones so a
    // section with both manager + accountant sub-blocks gets split.
    new WegAdministrationCombinedProcessor(),
    new WegPropertyManagerProcessor(),
    new WegAccountantProcessor(),

    // MV-specific sections
    new MvOwnerEntityProcessor(),

    // Core property sections (more generic, check later)
    new CoreAddressProcessor(),
    new CorePropertyOverviewProcessor(),

    // Fallback
    new UnknownProcessor(),
];

/**
 * Get all registered processors
 */
export function getAllProcessors(): ReadonlyArray<SectionProcessor> {
    return PROCESSORS;
}

/**
 * Get a processor by section type
 */
export function getProcessorByType(sectionType: string): SectionProcessor | undefined {
    return PROCESSORS.find((p) => p.sectionType === sectionType);
}

/**
 * Get array-based section types (buildings, units)
 */
export function getArrayBasedSectionTypes(): Set<string> {
    return new Set(
        PROCESSORS
            .filter((p) => p.isArrayBased)
            .map((p) => p.sectionType)
    );
}
