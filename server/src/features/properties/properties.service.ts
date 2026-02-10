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
    console.log('[DEBUG] startSectionTask called for propertyId:', propertyId);
    const existing = sectionTasks.get(propertyId);
    if (existing) {
        console.log('[DEBUG] Returning existing task for propertyId:', propertyId);
        return existing;
    }

    const task = (async () => {
        console.log('[DEBUG] Starting new task for propertyId:', propertyId);
        const awaitBasicDetails = options.awaitBasicDetails ?? true;
        
        // Fetch property document
        console.log('[DEBUG] Fetching property document...');
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
                documentData: true,
                basicDetailsExtract: true,
            },
        });

        if (!property?.documentData) {
            console.log('[DEBUG] Property document not found');
            throw new Error("Property document not found");
        }

        const documentBuffer = Buffer.from(property.documentData);
        console.log('[DEBUG] Document buffer size:', documentBuffer.length);
        
        // Extract sections from PDF
        console.log('[DEBUG] Extracting sections from PDF...');
        const sectionsResult = await getCachedSectionsResult(propertyId, documentBuffer);
        console.log('[DEBUG] Extracted sections count:', sectionsResult.sections.length);
        
        // Check if sections already exist
        console.log('[DEBUG] Checking for existing sections...');
        const existingSections = await getStoredSections(propertyId);
        console.log('[DEBUG] Existing sections count:', existingSections.length);
        const needsSections = existingSections.length === 0;
        
        // Classify sections using new processor system
        console.log('[DEBUG] Classifying sections...');
        const classifications = await classifySections(sectionsResult.sections, 10);
        console.log('[DEBUG] Classifications count:', classifications.length);
        
        // Extract basic details if needed
        const basicDetailsExtract = property.basicDetailsExtract as BasicDetailsExtract | null;
        const shouldExtractBasicDetails = isBasicDetailsEmpty(basicDetailsExtract);
        console.log('[DEBUG] Should extract basic details:', shouldExtractBasicDetails);
        
        const basicDetailsTask = shouldExtractBasicDetails
            ? (async () => {
                console.log('[DEBUG] Starting basic details extraction...');
                const basicDetails = await extractBasicDetails(sectionsResult.sections);
                console.log('[DEBUG] Basic details extracted:', basicDetails.extract);
                
                await prisma.property.update({
                    where: { id: propertyId },
                    data: {
                        basicDetailsExtract: basicDetails.extract,
                        basicDetailsExtractedAt: new Date(),
                    },
                });
                console.log('[DEBUG] Basic details saved to database');
                return basicDetails.extract;
            })()
            : null;

        if (!needsSections) {
            // Sections already exist, just update classifications
            for (const classification of classifications) {
                const sectionIndex = sectionsResult.sections.findIndex(
                    (s) => s.id === classification.sectionId
                );
                if (sectionIndex < 0) continue;
                
                const section = sectionsResult.sections[sectionIndex];
                if (!section) continue;
                
                await prisma.propertySection.updateMany({
                    where: {
                        propertyId,
                        sectionIndex,
                    },
                    data: {
                        textPosition: section.textPosition,
                        sectionType: classification.processor.sectionType,
                        confidence: classification.confidence,
                    },
                });
            }
            
            // Hide first section (usually header/title page)
            await prisma.propertySection.updateMany({
                where: {
                    propertyId,
                    sectionIndex: 0,
                },
                data: {
                    renderable: false,
                },
            });
            
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

        // Process each section through its matched processor
        // This will segment array-based sections (buildings, units) into items
        console.log('[DEBUG] Processing sections through processors...');
        const processedSections: ProcessedSection[] = [];
        for (let i = 0; i < classifications.length; i++) {
            const classification = classifications[i];
            if (!classification) continue;
            
            console.log(`[DEBUG] Processing section ${i + 1}/${classifications.length}:`, classification.processor.sectionType);
            
            const sectionIndex = sectionsResult.sections.findIndex(
                (s) => s.id === classification.sectionId
            );
            const rawSection = sectionsResult.sections[sectionIndex];
            if (!rawSection) {
                console.log('[DEBUG] Raw section not found for classification:', classification.sectionId);
                continue;
            }
            
            // Process the section (this may segment it into items for array-based types)
            console.log('[DEBUG] Calling processor.process()...');
            const processed = await classification.processor.process(rawSection);
            console.log('[DEBUG] Processor returned:', processed.sectionType, 'items:', processed.items?.length ?? 0);
            
            const processedWithIndex = {
                ...processed,
                // Preserve the section index for ordering
                _sectionIndex: sectionIndex,
            } as ProcessedSection & { _sectionIndex: number };
            
            processedSections.push(processedWithIndex);
            
            // Stream this section to client immediately
            if (options.onSectionProcessed) {
                console.log('[DEBUG] Calling onSectionProcessed callback');
                options.onSectionProcessed(processedWithIndex, i, classifications.length);
            }
        }
        console.log('[DEBUG] All sections processed, count:', processedSections.length);

        // Store processed sections in database
        console.log('[DEBUG] Storing sections in database...');
        const rows = processedSections.map((processed, index) => {
            const sectionIndex = (processed as any)._sectionIndex ?? index;
            const items = processed.items || null;
            return {
                propertyId,
                sectionIndex,
                headingText: processed.headingText,
                rawText: processed.rawText,
                textPosition: processed.textPosition,
                sectionType: processed.sectionType,
                confidence: processed.confidence,
                renderable: index !== 0, // Hide first section (usually title page)
                items: items === null ? null : JSON.parse(JSON.stringify(items)),
            };
        });
        console.log('[DEBUG] Prepared', rows.length, 'rows for database');

        if (rows.length) {
            console.log('[DEBUG] Creating sections in database...');
            await prisma.propertySection.createMany({
                data: rows,
                skipDuplicates: true,
            });
            console.log('[DEBUG] Sections stored successfully');
        }
        
        console.log('[DEBUG] Waiting for basic details task...');
        if (basicDetailsTask && awaitBasicDetails) {
            console.log('[DEBUG] Awaiting basic details (awaitBasicDetails=true)');
            const extract = await basicDetailsTask;
            console.log('[DEBUG] Basic details task completed, calling callback');
            options.onBasicDetailsUpdated?.(extract ?? null);
        } else if (basicDetailsTask) {
            console.log('[DEBUG] Running basic details in background (awaitBasicDetails=false)');
            // Even though we don't await, we should still get the result
            basicDetailsTask
                .then((extract) => {
                    console.log('[DEBUG] Background basic details completed, calling callback');
                    options.onBasicDetailsUpdated?.(extract ?? null);
                })
                .catch((err) => {
                    console.log('[DEBUG] Basic details extraction failed:', err);
                });
        } else {
            console.log('[DEBUG] No basic details task to run');
        }
        
        console.log('[DEBUG] startSectionTask completing');
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
