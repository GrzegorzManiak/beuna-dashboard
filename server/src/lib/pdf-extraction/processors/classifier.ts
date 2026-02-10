import type { PdfSection } from "../raw/types";
import type { ClassificationResult } from "./types";
import { getAllProcessors } from "./registry";

/**
 * Classify a single PDF section by finding the best matching processor
 */
export async function classifySection(section: PdfSection): Promise<ClassificationResult> {
    const processors = getAllProcessors();
    
    let bestMatch: ClassificationResult | null = null;
    let bestConfidence = 0;
    
    for (const processor of processors) {
        const confidence = await Promise.resolve(processor.matches(section));
        
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
        return {
            sectionId: section.id,
            processor: unknownProcessor,
            confidence: 0.1,
        };
    }
    
    return bestMatch;
}

/**
 * Classify multiple PDF sections in parallel
 */
export async function classifySections(
    sections: PdfSection[],
    concurrency: number = 10
): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < sections.length; i += concurrency) {
        const batch = sections.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map((section) => classifySection(section))
        );
        results.push(...batchResults);
    }
    
    return results;
}
