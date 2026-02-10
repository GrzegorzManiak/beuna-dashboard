import type { PdfSection } from "../raw/types";

/**
 * Section types following the revised architecture
 */
export type SectionType =
    | "core.property_overview"
    | "core.address"
    | "core.buildings"
    | "units.unit_blocks"
    | "weg.mea_declaration"
    | "weg.special_rights"
    | "weg.property_manager"
    | "weg.accountant"
    | "mv.owner_entity"
    | "unknown";

/**
 * A single item within an array-based section (buildings, units)
 */
export type SectionItem = {
    /** Unique identifier for this item */
    id: string;
    /** Raw text content of this specific item */
    rawText: string;
};

/**
 * Represents a processed section with its boundaries and metadata
 */
export type ProcessedSection = {
    /** Raw text content of the entire section */
    rawText: string;
    /** Heading or title for display */
    headingText: string;
    /** Section type identifier (matches UI tool types) */
    sectionType: SectionType;
    /** Confidence score (0-1) */
    confidence: number;
    /** Whether this section should be displayed in the UI */
    renderable: boolean;
    /** Text position data for highlighting */
    textPosition: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    /** 
     * For array-based sections (buildings, units), contains segmented items.
     * For single-object sections, this is undefined.
     */
    items?: SectionItem[];
};

/**
 * Interface for section processors that identify and extract specific section types
 */
export interface SectionProcessor {
    /** Unique identifier matching the section type */
    readonly sectionType: SectionType;
    
    /** Human-readable description of what this processor detects */
    readonly description: string;
    
    /** 
     * Whether this is an array-based section (buildings, units) or single object.
     * Array sections will have items[] populated.
     */
    readonly isArrayBased: boolean;
    
    /**
     * Determines if a given PDF section matches this processor's type
     * @param section The PDF section to analyze
     * @returns Confidence score (0-1) or null if definitely not a match
     */
    matches(section: PdfSection): Promise<number | null> | number | null;
    
    /**
     * Processes a PDF section and extracts a single processed section.
     * For array-based processors (buildings, units), the returned section
     * will have items[] populated with segmented blocks.
     * @param section The raw PDF section to process
     * @returns A single processed section (with optional items array)
     */
    process(section: PdfSection): Promise<ProcessedSection> | ProcessedSection;
}

/**
 * Result from classification pipeline
 */
export type ClassificationResult = {
    sectionId: string;
    processor: SectionProcessor;
    confidence: number;
};
