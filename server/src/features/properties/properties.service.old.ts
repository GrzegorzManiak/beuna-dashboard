import { prisma } from "@db";
import { createExpiringCache } from "../../lib/expiring-cache";
import {
    extractBasicDetails,
    extractSectionsFromBuffer,
    classifySections,
    extractBuildingBlocks,
    extractUnitBlocks,
    extractAdministrationBlocks,
    type BasicDetailsExtract,
    type ExtractSectionsResult,
} from "../../lib/pdf-extraction";

type DocumentCacheEntry = {
    data: Buffer;
    mimeType: string;
    name: string;
};

type HighlightPosition = {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

type DetailedSectionType =
    | "core.building"
    | "units.unit_block"
    | "weg.administration_property_manager"
    | "weg.administration_accountant";

type DetailedBlock = {
    blockText: string;
    sectionType: DetailedSectionType;
};

type StoredSection = {
    id: string;
    sectionIndex: number;
    headingText: string;
    rawText: string;
    textPosition: HighlightPosition[];
    sectionType: string;
    confidence: number;
    renderable: boolean;
    reusable: boolean;
};

type StartSectionTaskOptions = {
    awaitBasicDetails?: boolean;
    onBasicDetailsUpdated?: (basicDetails: BasicDetailsExtract | null) => void;
};

const PDF_CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PROPERTY_NAME = "Unnamed property";
const DEFAULT_DOCUMENT_NAME = "property.pdf";

const NON_REUSABLE_SECTION_TYPES = new Set<string>([
    "core.building",
    "core.building_shared_features",
    "units.unit_block",
    "weg.administration_property_manager",
    "weg.administration_accountant",
    "mv.owner_entity_block",
]);

const documentCache = createExpiringCache<DocumentCacheEntry>(PDF_CACHE_TTL_MS);
const sectionCache = createExpiringCache<ExtractSectionsResult>(PDF_CACHE_TTL_MS);
const sectionTasks = new Map<string, Promise<void>>();
const detailedSectionTasks = new Map<string, Promise<void>>();

const isReusableSection = (sectionType: string) =>
    !NON_REUSABLE_SECTION_TYPES.has(sectionType);

const resolveSectionType = (
    _section: ExtractSectionsResult["sections"][number],
    classifiedType: string | undefined,
): string => {
    return classifiedType ?? "unknown";
};

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
        },
    });
    return sections.map((section) => {
        if (section.sectionType === "weg.administration_block") {
            const sectionType = "weg.administration_property_manager";
            return { ...section, sectionType, reusable: isReusableSection(sectionType) } as StoredSection;
        }
        return { ...section, reusable: isReusableSection(section.sectionType) } as StoredSection;
    });
}

async function getBasicDetailsExtract(propertyId: string) {
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            basicDetailsExtract: true,
        },
    });
    return property?.basicDetailsExtract ?? null;
}

const startSectionTask = (propertyId: string, options: StartSectionTaskOptions = {}) => {
    const existing = sectionTasks.get(propertyId);
    if (existing) return existing;

    const task = (async () => {
        const awaitBasicDetails = options.awaitBasicDetails ?? true;
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: {
                documentData: true,
                basicDetailsExtract: true,
            },
        });

        if (!property?.documentData) throw new Error("Property document not found");

        const documentBuffer = Buffer.from(property.documentData);
        const sectionsResult = await getCachedSectionsResult(propertyId, documentBuffer);
        const existingSections = await getStoredSections(propertyId);
        const needsSections = existingSections.length === 0;
        const classification = await classifySections(sectionsResult.sections, 10);
        const classificationMap = new Map(
            classification.classifications.map((entry) => [entry.sectionId, entry]),
        );

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
            for (const [index, section] of sectionsResult.sections.entries()) {
                const classified = classificationMap.get(section.id);
                const sectionType = resolveSectionType(section, classified?.sectionType);
                await prisma.propertySection.updateMany({
                    where: {
                        propertyId,
                        sectionIndex: index,
                    },
                    data: {
                        textPosition: section.textPosition,
                        sectionType,
                        confidence: classified?.confidence ?? 0,
                    },
                });
            }
            await prisma.propertySection.updateMany({
                where: {
                    propertyId,
                    sectionType: "weg.administration_block",
                },
                data: {
                    sectionType: "weg.administration_property_manager",
                },
            });
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

        const rows = sectionsResult.sections.map((section, index) => {
            const classified = classificationMap.get(section.id);
            const sectionType = resolveSectionType(section, classified?.sectionType);
            return {
                propertyId,
                sectionIndex: index,
                headingText: section.heading.text,
                rawText: section.rawText,
                textPosition: section.textPosition,
                sectionType,
                confidence: classified?.confidence ?? 0,
                renderable: index !== 0,
            };
        });

        if (!rows.length) return;

        await prisma.propertySection.createMany({
            data: rows,
            skipDuplicates: true,
        });
        if (basicDetailsTask && awaitBasicDetails) {
            const extract = await basicDetailsTask;
            options.onBasicDetailsUpdated?.(extract ?? null);
        } else if (basicDetailsTask) {
            basicDetailsTask
                .then((extract) => options.onBasicDetailsUpdated?.(extract ?? null))
                .catch(() => null);
        }
    })().finally(() => {
        sectionTasks.delete(propertyId);
    });

    sectionTasks.set(propertyId, task);
    return task;
};

const buildSectionPositions = (lines: Array<{ page: number; x: number; y: number; width: number; height: number }>) => {
    const byPage = new Map<number, Array<{ page: number; x: number; y: number; width: number; height: number }>>();
    for (const line of lines) {
        if (!byPage.has(line.page)) byPage.set(line.page, []);
        byPage.get(line.page)!.push(line);
    }

    const positions: HighlightPosition[] = [];
    for (const [page, pageLines] of byPage.entries()) {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxRight = Number.NEGATIVE_INFINITY;
        let maxBottom = Number.NEGATIVE_INFINITY;

        for (const line of pageLines) {
            minX = Math.min(minX, line.x);
            minY = Math.min(minY, line.y);
            maxRight = Math.max(maxRight, line.x + line.width);
            maxBottom = Math.max(maxBottom, line.y + line.height);
        }

        if (Number.isFinite(minX) && Number.isFinite(minY)) {
            positions.push({
                page,
                x: minX,
                y: minY,
                width: Math.max(0, maxRight - minX),
                height: Math.max(0, maxBottom - minY),
            });
        }
    }

    return positions.sort((a, b) => a.page - b.page);
};

const normalizeForMatch = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const selectLinesForBlock = (
    section: ExtractSectionsResult["sections"][number],
    blockText: string,
) => {
    const normalizedBlock = normalizeForMatch(blockText);
    if (!normalizedBlock) return [];
    const tokens = normalizedBlock.split(" ").filter((token) => token.length > 1);

    return section.lines.filter((line) => {
        const normalizedLine = normalizeForMatch(line.text);
        if (!normalizedLine) return false;
        if (normalizedBlock.includes(normalizedLine)) return true;
        if (normalizedLine.includes(normalizedBlock)) return true;
        if (!tokens.length) return false;
        const tokenHits = tokens.filter((token) => normalizedLine.includes(token)).length;
        return tokenHits / tokens.length >= 0.5;
    });
};

const buildLineOffsets = (lines: ExtractSectionsResult["sections"][number]["lines"]) => {
    const offsets: number[] = [];
    let cursor = 0;
    for (const line of lines) {
        offsets.push(cursor);
        cursor += line.text.length + 1;
    }
    return offsets;
};

const findLineIndexForOffset = (offsets: number[], target: number) => {
    if (!offsets.length) return -1;
    let low = 0;
    let high = offsets.length - 1;
    let result = 0;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (offsets[mid] <= target) {
            result = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return result;
};

const findLineSpanByRawText = (
    section: ExtractSectionsResult["sections"][number],
    blockText: string,
    startCursor: number,
    lineOffsets: number[],
): { lines: ExtractSectionsResult["sections"][number]["lines"]; startIndex: number; endIndex: number; nextCursor: number } | null => {
    const rawText = section.rawText;
    if (!rawText) return null;
    const start = rawText.indexOf(blockText, startCursor);
    if (start < 0) return null;
    const end = start + blockText.length - 1;
    const startIndex = findLineIndexForOffset(lineOffsets, start);
    const endIndex = findLineIndexForOffset(lineOffsets, end);
    if (startIndex < 0 || endIndex < startIndex) return null;

    return {
        lines: section.lines.slice(startIndex, endIndex + 1),
        startIndex,
        endIndex,
        nextCursor: start + blockText.length,
    };
};

const selectLinesForUnitBlock = (
    section: ExtractSectionsResult["sections"][number],
    blockText: string,
): { lines: ExtractSectionsResult["sections"][number]["lines"]; startIndex: number; endIndex: number } | null => {
    const blockLines = blockText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    if (!blockLines.length) return null;

    const normalizedBlockLines = blockLines.map((line) => normalizeForMatch(line));
    let startIndex = -1;
    let lastIndex = -1;
    let cursor = 0;
    let matched = 0;

    for (const blockLine of normalizedBlockLines) {
        if (!blockLine) continue;
        let foundIndex = -1;
        for (let i = cursor; i < section.lines.length; i += 1) {
            const line = section.lines[i];
            if (!line) continue;
            const normalizedLine = normalizeForMatch(line.text);
            if (!normalizedLine) continue;
            if (normalizedLine.includes(blockLine) || blockLine.includes(normalizedLine)) {
                foundIndex = i;
                break;
            }
        }
        if (foundIndex < 0) continue;
        if (startIndex < 0) startIndex = foundIndex;
        lastIndex = foundIndex;
        cursor = foundIndex + 1;
        matched += 1;
    }

    if (startIndex < 0 || lastIndex < startIndex) return null;
    const matchRatio = matched / Math.max(normalizedBlockLines.length, 1);
    if (matchRatio < 0.5) return null;

    const lineSpan = lastIndex - startIndex + 1;
    if (lineSpan > normalizedBlockLines.length * 4) return null;

    return {
        lines: section.lines.slice(startIndex, lastIndex + 1),
        startIndex,
        endIndex: lastIndex,
    };
};

const buildLineSpanFromLines = (
    section: ExtractSectionsResult["sections"][number],
    lines: ExtractSectionsResult["sections"][number]["lines"],
): { startIndex: number; endIndex: number } | null => {
    if (!lines.length) return null;
    const indices = lines
        .map((line) => section.lines.indexOf(line))
        .filter((index) => index >= 0);
    if (!indices.length) return null;
    return {
        startIndex: Math.min(...indices),
        endIndex: Math.max(...indices),
    };
};

const extractBlocksFromSection = async (
    section: ExtractSectionsResult["sections"][number],
    type: DetailedSectionType,
): Promise<DetailedBlock[]> => {
    if (type === "core.building") {
        const blocks = await extractBuildingBlocks(section);
        return blocks.map((block) => ({ blockText: block.blockText, sectionType: "core.building" }));
    }
    if (type === "units.unit_block") {
        const blocks = await extractUnitBlocks(section);
        return blocks.map((block) => ({ blockText: block.blockText, sectionType: "units.unit_block" }));
    }

    const blocks = await extractAdministrationBlocks(section);
    return blocks.map((block) => ({
        blockText: block.blockText,
        sectionType: block.blockType === "accountant"
            ? "weg.administration_accountant"
            : "weg.administration_property_manager",
    }));
};

const persistExtractedBlocks = async (
    propertyId: string,
    baseSection: ExtractSectionsResult["sections"][number],
    blocks: DetailedBlock[],
    startingIndex: number,
    onSectionCreated?: (section: StoredSection) => void,
) => {
    let nextIndex = startingIndex;
    let lastUnitEndIndex: number | null = null;
    let unitRawCursor = 0;
    const lineOffsets = buildLineOffsets(baseSection.lines);

    for (const block of blocks) {
        const trimmed = block.blockText.trim();
        if (!trimmed) continue;
        let lines = selectLinesForBlock(baseSection, block.blockText);
        if (block.sectionType === "units.unit_block") {
            const rawSpan = findLineSpanByRawText(baseSection, trimmed, unitRawCursor, lineOffsets);
            if (rawSpan) {
                unitRawCursor = rawSpan.nextCursor;
                lastUnitEndIndex = Math.max(lastUnitEndIndex ?? -1, rawSpan.endIndex);
                lines = rawSpan.lines;
            } else {
                const unitSpan = selectLinesForUnitBlock(baseSection, block.blockText);
                if (unitSpan) {
                    if (lastUnitEndIndex !== null && unitSpan.startIndex <= lastUnitEndIndex) continue;
                    lastUnitEndIndex = unitSpan.endIndex;
                    lines = unitSpan.lines;
                } else {
                    const fallbackSpan = buildLineSpanFromLines(baseSection, lines);
                    if (!fallbackSpan) continue;
                    if (lastUnitEndIndex !== null && fallbackSpan.startIndex <= lastUnitEndIndex) continue;
                    lastUnitEndIndex = fallbackSpan.endIndex;
                }
            }
        }
        const positions = lines.length ? buildSectionPositions(lines) : baseSection.textPosition;
        const headingText = trimmed.split("\n")[0]?.trim() || trimmed.slice(0, 120);

        const created = await prisma.propertySection.create({
            data: {
                propertyId,
                sectionIndex: nextIndex,
                headingText,
                rawText: trimmed,
                textPosition: positions,
                sectionType: block.sectionType,
                confidence: 0.6,
                renderable: true,
            },
            select: {
                id: true,
                sectionIndex: true,
                headingText: true,
                rawText: true,
                textPosition: true,
                sectionType: true,
                confidence: true,
                renderable: true,
            },
        });
        nextIndex += 1;
        onSectionCreated?.({ ...created, reusable: isReusableSection(created.sectionType) });
    }

    return nextIndex;
};

const startDetailedSectionTask = (
    propertyId: string,
    onSectionCreated?: (section: StoredSection) => void,
) => {
    const existing = detailedSectionTasks.get(propertyId);
    if (existing) return existing;

    const task = (async () => {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { documentData: true },
        });

        if (!property?.documentData) return;

        const documentBuffer = Buffer.from(property.documentData);
        const sectionsResult = await getCachedSectionsResult(propertyId, documentBuffer);
        const rawCount = sectionsResult.sections.length;

        const baseSections = await prisma.propertySection.findMany({
            where: {
                propertyId,
                sectionIndex: { lt: rawCount },
                renderable: true,
                sectionType: {
                    in: [
                        "core.building",
                        "units.unit_block",
                        "weg.administration_property_manager",
                        "weg.administration_accountant",
                        "weg.administration_block",
                    ],
                },
            },
            select: {
                sectionIndex: true,
                sectionType: true,
            },
            orderBy: { sectionIndex: "asc" },
        });

        if (!baseSections.length) return;

        const maxIndexResult = await prisma.propertySection.aggregate({
            where: { propertyId },
            _max: { sectionIndex: true },
        });
        let nextIndex = Math.max(rawCount, (maxIndexResult._max.sectionIndex ?? -1) + 1);

        let administrationProcessed = false;
        for (const base of baseSections) {
            const section = sectionsResult.sections[base.sectionIndex];
            if (!section) continue;
            const baseType = base.sectionType === "weg.administration_block"
                ? "weg.administration_property_manager"
                : base.sectionType;
            if (
                (baseType === "weg.administration_property_manager" || baseType === "weg.administration_accountant")
                && administrationProcessed
            ) {
                await prisma.propertySection.updateMany({
                    where: {
                        propertyId,
                        sectionIndex: base.sectionIndex,
                    },
                    data: { renderable: false },
                });
                continue;
            }
            if (
                baseType !== "core.building"
                && baseType !== "units.unit_block"
                && baseType !== "weg.administration_property_manager"
                && baseType !== "weg.administration_accountant"
            ) {
                continue;
            }
            const blocks = await extractBlocksFromSection(section, baseType);
            if (!blocks.length) continue;
            if (baseType === "weg.administration_property_manager" || baseType === "weg.administration_accountant") {
                administrationProcessed = true;
            }
            nextIndex = await persistExtractedBlocks(
                propertyId,
                section,
                blocks,
                nextIndex,
                onSectionCreated,
            );
            await prisma.propertySection.updateMany({
                where: {
                    propertyId,
                    sectionIndex: base.sectionIndex,
                },
                data: { renderable: false },
            });
        }
    })().finally(() => {
        detailedSectionTasks.delete(propertyId);
    });

    detailedSectionTasks.set(propertyId, task);
    return task;
};

export {
    getPropertyDocument,
    getStoredSections,
    getBasicDetailsExtract,
    startSectionTask,
    startDetailedSectionTask,
    DEFAULT_PROPERTY_NAME,
    DEFAULT_DOCUMENT_NAME,
    PDF_CACHE_TTL_MS,
    type StartSectionTaskOptions,
    type StoredSection,
};
