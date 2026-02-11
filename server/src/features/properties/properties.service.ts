import { prisma } from "@db";
import { createExpiringCache } from "../../lib/expiring-cache";
import {
    extractBasicDetails,
    extractSectionsFromBuffer,
    type BasicDetailsExtract,
    type ExtractSectionsResult,
} from "../../lib/pdf-extraction";
import {
    classifySections,
    getArrayBasedSectionTypes,
    type ProcessedSection,
    type SectionItem,
} from "../../lib/pdf-extraction/processors";
import { splitMeaDeclaration } from "../../lib/pdf-extraction/processors/base";
import type { PdfSection } from "../../lib/pdf-extraction/raw/types";

type DocumentCacheEntry = {
    data: Buffer;
    mimeType: string;
    name: string;
};

type StoredSection = {
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
    sectionType: string;
    confidence: number;
    renderable: boolean;
    items?: SectionItem[];
    state?: string | null;
    fields?: Record<string, unknown> | null;
};

type StartSectionTaskOptions = {
    awaitBasicDetails?: boolean;
    onBasicDetailsUpdated?: (basicDetails: BasicDetailsExtract | null) => void;
    onSectionProcessed?: (section: ProcessedSection, index: number, total: number) => void;
};

const PDF_CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PROPERTY_NAME = "Unnamed property";
const DEFAULT_DOCUMENT_NAME = "property.pdf";

const documentCache = createExpiringCache<DocumentCacheEntry>(PDF_CACHE_TTL_MS);
const sectionCache = createExpiringCache<ExtractSectionsResult>(PDF_CACHE_TTL_MS);
const sectionTasks = new Map<string, Promise<void>>();

const ARRAY_BASED_TYPES = getArrayBasedSectionTypes();

const isBasicDetailsEmpty = (extract: BasicDetailsExtract | null): boolean => {
    if (!extract || !Array.isArray(extract.fields)) return true;
    return extract.fields.every((field) => {
        if (!field || typeof field !== "object") return true;
        const value = typeof field.value === "string" ? field.value.trim() : null;
        const sourceText = typeof field.sourceText === "string" ? field.sourceText.trim() : null;
        const index = typeof field.sectionIndex === "number" ? field.sectionIndex : null;
        return !value && !sourceText && index === null;
    });
};

/**
 * Split MEA declarations from sections before classification
 * MEA declarations are often embedded in unit sections but need to be separate
 */
function splitMeaDeclarationsFromSections(sections: PdfSection[]): PdfSection[] {
    const result: PdfSection[] = [];
    let sectionIndex = 0;

    for (const section of sections) {
        const split = splitMeaDeclaration(section);
        for (const s of split) {
            result.push({
                ...s,
                id: s.id !== section.id ? s.id : section.id,
            });
        }
    }

    return result;
}

const getCachedSectionsResult = async (propertyId: string, documentData: Buffer) => {
    const cached = sectionCache.get(propertyId);
    if (cached) return cached;
    const result = await extractSectionsFromBuffer(documentData);
    sectionCache.set(propertyId, result);
    return result;
};

/**
 * Get property document from cache or database
 */
async function getPropertyDocument(propertyId: string): Promise<DocumentCacheEntry | null> {
    const cached = documentCache.get(propertyId);
    if (cached) return cached;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            documentName: true,
            documentMimeType: true,
            documentData: true,
        },
    });

    if (!property?.documentData) return null;

    const documentName = property.documentName ?? DEFAULT_DOCUMENT_NAME;
    const mimeType = property.documentMimeType ?? "application/pdf";
    const entry = {
        data: Buffer.from(property.documentData),
        mimeType,
        name: documentName,
    };

    documentCache.set(propertyId, entry);
    return entry;
}

/**
 * Get stored sections from database
 */
async function getStoredSections(propertyId: string): Promise<StoredSection[]> {
    const sections = await prisma.propertySection.findMany({
        where: { propertyId },
        orderBy: { sectionIndex: "asc" },
        select: {
            id: true,
            sectionIndex: true,
            headingText: true,
            rawText: true,
            textPosition: true,
            sectionType: true,
            confidence: true,
            renderable: true,
            items: true,
            state: true,
            fields: true,
        },
    });
    
    return sections.map((section) => ({
        ...section,
        textPosition: section.textPosition as Array<{
            page: number;
            x: number;
            y: number;
            width: number;
            height: number;
        }>,
        items: section.items as SectionItem[] | undefined,
        state: section.state ?? null,
        fields: section.fields as Record<string, unknown> | null,
    })) as StoredSection[];
}

/**
 * Get basic details extract from database
 */
async function getBasicDetailsExtract(propertyId: string) {
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            basicDetailsExtract: true,
        },
    });
    return property?.basicDetailsExtract ?? null;
}

/**
 * Start section extraction, classification, and processing task
 * This now handles everything in one pass since processors return complete sections
 */
const startSectionTask = (propertyId: string, options: StartSectionTaskOptions = {}) => {
    const existing = sectionTasks.get(propertyId);
    if (existing) {
        return existing;
    }

    const task = (async () => {
        const awaitBasicDetails = options.awaitBasicDetails ?? true;
        
        // Fetch property document
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
                documentData: true,
                basicDetailsExtract: true,
                managementType: true,
            },
        });

        if (!property?.documentData) {
            throw new Error("Property document not found");
        }

        const documentBuffer = Buffer.from(property.documentData);

        // Extract sections from PDF
        const sectionsResult = await getCachedSectionsResult(propertyId, documentBuffer);

        // Pre-process sections to split out MEA declarations
        const preProcessedSections = splitMeaDeclarationsFromSections(sectionsResult.sections);
        
        // Check if sections already exist
        const existingSections = await getStoredSections(propertyId);
        const needsSections = existingSections.length === 0;

        // Classify sections using new processor system (on pre-processed sections)
        const managementType = (property.managementType ?? "UNKNOWN") as "WEG" | "MV" | "UNKNOWN";
        const classifications = await classifySections(preProcessedSections, 10, { managementType });
        
        // Extract basic details if needed
        const basicDetailsExtract = property.basicDetailsExtract as BasicDetailsExtract | null;
        const shouldExtractBasicDetails = isBasicDetailsEmpty(basicDetailsExtract);

        const basicDetailsTask = shouldExtractBasicDetails
            ? (async () => {
                const basicDetails = await extractBasicDetails(sectionsResult.sections);

                await prisma.property.update({
                    where: { id: propertyId },
                    data: {
                        basicDetailsExtract: basicDetails.extract,
                        basicDetailsExtractedAt: new Date(),
                    },
                });
                return basicDetails.extract;
            })()
            : null;

        if (!needsSections) {
            // Sections already exist in the DB — nothing to do.
            // Basic details may still need extracting if they were missed previously.
            if (basicDetailsTask && awaitBasicDetails) {
                const extract = await basicDetailsTask;
                options.onBasicDetailsUpdated?.(extract ?? null);
            } else if (basicDetailsTask) {
                basicDetailsTask
                    .then((extract) => options.onBasicDetailsUpdated?.(extract ?? null))
                    .catch(() => null);
            }
            return;
        }

        // For new extractions, await basic details so we can create synthetic sections
        let finalBasicDetails: BasicDetailsExtract | null = basicDetailsExtract;
        if (basicDetailsTask) {
            finalBasicDetails = await basicDetailsTask;
            if (finalBasicDetails) {
                options.onBasicDetailsUpdated?.(finalBasicDetails);
            }
        }

        // Process each section through its matched processor
        // This will segment array-based sections (buildings, units) into items
        const processedSections: ProcessedSection[] = [];
        for (let i = 0; i < classifications.length; i++) {
            const classification = classifications[i];
            if (!classification) continue;


            const sectionIndex = preProcessedSections.findIndex(
                (s) => s.id === classification.sectionId
            );
            const rawSection = preProcessedSections[sectionIndex];
            if (!rawSection) {
                continue;
            }

            // Process the section (this may segment it into items for array-based types)
            const processed = await classification.processor.process(rawSection);

            const processedWithIndex = {
                ...processed,
                id: crypto.randomUUID(),
                // Preserve the section index for ordering
                _sectionIndex: sectionIndex,
            } as ProcessedSection & { _sectionIndex: number };

            processedSections.push(processedWithIndex);

            // Stream this section to client immediately
            if (options.onSectionProcessed) {
                options.onSectionProcessed(processedWithIndex, i, classifications.length);
            }
        }

        // Create synthetic sections for basic details that weren't found in the document
        // These will be added before processing completes
        const foundSectionTypes = new Set(processedSections.map(s => s.sectionType));
        const syntheticSections: ProcessedSection[] = [];

        // Check if we should create a property overview section
        if (!foundSectionTypes.has('core.property_overview') && finalBasicDetails) {
            // Check if we have basic details that would constitute a property overview
            const hasBasicInfo = finalBasicDetails.fields.some(f =>
                f.key === 'propertyName' && f.value
            ) || finalBasicDetails.fields.some(f =>
                f.key === 'propertyId' && f.value
            );

            if (hasBasicInfo) {
                const propertyName = finalBasicDetails.fields.find(f => f.key === 'propertyName')?.value;
                const propertyIdValue = finalBasicDetails.fields.find(f => f.key === 'propertyId')?.value;
                const managementType = finalBasicDetails.fields.find(f => f.key === 'managementTypeHint')?.value;

                const overviewText = [
                    propertyName && `Objektname: ${propertyName}`,
                    propertyIdValue && `Objektnummer: ${propertyIdValue}`,
                    managementType && `Verwaltungsform: ${managementType}`,
                ].filter(Boolean).join('\n');

                syntheticSections.push({
                    id: crypto.randomUUID(),
                    sectionType: 'core.property_overview',
                    confidence: 0.8,
                    headingText: 'Eigentumsverhältnisse',
                    rawText: overviewText,
                    renderable: true,
                    textPosition: [],
                    items: [],
                    _sectionIndex: -1, // Insert at the beginning
                } as ProcessedSection & { _sectionIndex: number });
            }
        }

        // Check if we should create an address section
        if (!foundSectionTypes.has('core.address') && finalBasicDetails) {
            const ADDRESS_KEYS = ['street', 'houseNumber', 'postalCode', 'city'];
            const hasAddress = finalBasicDetails.fields.some(f =>
                ADDRESS_KEYS.includes(f.key) && f.value
            );

            if (hasAddress) {
                const street = finalBasicDetails.fields.find(f => f.key === 'street')?.value;
                const houseNumber = finalBasicDetails.fields.find(f => f.key === 'houseNumber')?.value;
                const postalCode = finalBasicDetails.fields.find(f => f.key === 'postalCode')?.value;
                const city = finalBasicDetails.fields.find(f => f.key === 'city')?.value;

                const addressText = [
                    'Anschrift:',
                    street && houseNumber && `${street} ${houseNumber}`,
                    postalCode && city && `${postalCode} ${city}`,
                ].filter(Boolean).join('\n');

                // Gather ALL address field positions from basic details
                const addressPositions = finalBasicDetails.fields
                    .filter(f => ADDRESS_KEYS.includes(f.key) && f.position)
                    .map(f => f.position!);

                // If no field-level positions, fall back to the section's
                // textPosition where the address was extracted from.
                let textPosition = addressPositions;
                if (!textPosition.length) {
                    const addressSectionIndex = finalBasicDetails.fields.find(
                        f => ADDRESS_KEYS.includes(f.key) && f.sectionIndex !== null
                    )?.sectionIndex;
                    if (addressSectionIndex !== null && addressSectionIndex !== undefined) {
                        const sourceSection = preProcessedSections[addressSectionIndex] ?? sectionsResult.sections[addressSectionIndex];
                        if (sourceSection?.textPosition?.length) {
                            textPosition = sourceSection.textPosition;
                        }
                    }
                }


                syntheticSections.push({
                    id: crypto.randomUUID(),
                    sectionType: 'core.address',
                    confidence: 0.8,
                    headingText: 'Anschrift',
                    rawText: addressText,
                    renderable: true,
                    textPosition,
                    items: [],
                    _sectionIndex: -2, // Insert after property overview
                } as ProcessedSection & { _sectionIndex: number });
            }
        }

        // Add synthetic sections to processed sections
        const allProcessedSections = [...syntheticSections, ...processedSections];

        // Store processed sections in database
        const rows = allProcessedSections.map((processed, index) => {
            const sectionIndex = (processed as any)._sectionIndex ?? index;
            const items = processed.items || null;
            return {
                id: processed.id ?? crypto.randomUUID(),
                propertyId,
                sectionIndex,
                headingText: processed.headingText,
                rawText: processed.rawText,
                textPosition: processed.textPosition,
                sectionType: processed.sectionType,
                confidence: processed.confidence,
                renderable: processed.renderable !== false,
                items: items === null ? null : JSON.parse(JSON.stringify(items)),
            };
        });

        if (rows.length) {
            await prisma.propertySection.createMany({
                data: rows,
                skipDuplicates: true,
            });
        }
        
        if (basicDetailsTask && awaitBasicDetails) {
            const extract = await basicDetailsTask;
            options.onBasicDetailsUpdated?.(extract ?? null);
        } else if (basicDetailsTask) {
            // Even though we don't await, we should still get the result
            basicDetailsTask
                .then((extract) => {
                    options.onBasicDetailsUpdated?.(extract ?? null);
                })
                .catch((err) => {
                });
        } else {
        }
        
    })().finally(() => {
        sectionTasks.delete(propertyId);
    });

    sectionTasks.set(propertyId, task);
    return task;
};

export {
    getPropertyDocument,
    getStoredSections,
    getBasicDetailsExtract,
    startSectionTask,
    DEFAULT_PROPERTY_NAME,
    DEFAULT_DOCUMENT_NAME,
    PDF_CACHE_TTL_MS,
    type StartSectionTaskOptions,
    type StoredSection,
};
