import type { PdfSection } from "../raw/types";
import type { ClassificationContext, ClassificationResult } from "./types";
import { getAllProcessors } from "./registry";

/**
 * Returns `true` when the processor is allowed to run for the given
 * management type.  A processor with no scope (or scope "ANY") is
 * always allowed.
 */
function isScopeAllowed(
    processor: { readonly propertyTypeScope?: "WEG" | "MV" | "ANY" },
    managementType?: string,
): boolean {
    const scope = processor.propertyTypeScope;
    if (!scope || scope === "ANY") return true;
    // If we don't know the management type yet, allow everything
    if (!managementType || managementType === "UNKNOWN") return true;
    return scope === managementType;
}

/**
 * Classify a single PDF section by finding the best matching processor
 */
export async function classifySection(
    section: PdfSection,
    context: ClassificationContext = {},
): Promise<ClassificationResult> {
    const processors = getAllProcessors();
    
    console.log(`[CLASSIFIER] Classifying section ${section.id}:`, section.heading.text.substring(0, 50));
    
    let bestMatch: ClassificationResult | null = null;
    let bestConfidence = 0;
    
    for (const processor of processors) {
        // Skip processors that don't apply to this property type
        if (!isScopeAllowed(processor, context.managementType)) {
            continue;
        }

        const confidence = await Promise.resolve(processor.matches(section));
        
        if (confidence !== null && confidence > 0.1) {
            console.log(`[CLASSIFIER]   - ${processor.sectionType}: ${confidence.toFixed(3)}`);
        }
        
        if (confidence !== null && confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = {
                sectionId: section.id,
                processor,
                confidence,
            };
        }
    }
    
    // Should always have at least the unknown processor
    if (!bestMatch) {
        const unknownProcessor = processors[processors.length - 1];
        if (!unknownProcessor) {
            throw new Error("No processors registered");
        }
        console.log(`[CLASSIFIER]   ✓ Defaulting to: unknown`);
        return {
            sectionId: section.id,
            processor: unknownProcessor,
            confidence: 0.1,
        };
    }
    
    console.log(`[CLASSIFIER]   ✓ Best match: ${bestMatch.processor.sectionType} (${bestMatch.confidence.toFixed(3)})`);
    return bestMatch;
}

/**
 * Classify multiple PDF sections in parallel
 */
export async function classifySections(
    sections: PdfSection[],
    concurrency: number = 10,
    context: ClassificationContext = {},
): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < sections.length; i += concurrency) {
        const batch = sections.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map((section) => classifySection(section, context))
        );
        results.push(...batchResults);
    }
    
    return results;
}
