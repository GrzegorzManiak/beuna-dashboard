import { runJsonTool, type JsonToolSchema, type LlmMessage } from "./client";
import type { PdfSection } from "../raw/types";

// --- Types ---

type AdministrationBlockType = "property_manager" | "accountant";

type AdministrationBlock = {
    blockType: AdministrationBlockType;
    blockText: string;
};

// --- Tool Definition ---

const ADMIN_BLOCK_TOOL: JsonToolSchema = {
    name: "extract_administration_blocks",
    description: "Splits an administration text section into two distinct role blocks.",
    outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            blocks: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        blockType: { 
                            type: "string", 
                            enum: ["property_manager", "accountant"],
                            description: "The role being described."
                        },
                        blockText: { 
                            type: "string",
                            description: "The verbatim text segment for this specific role only. Do not include text belonging to the other role."
                        },
                    },
                    required: ["blockType", "blockText"],
                },
            },
        },
        required: ["blocks"],
    },
};

// --- Prompt Engineering ---

const buildMessages = (section: PdfSection): LlmMessage[] => [
    {
        role: "system",
        content: `You are a text segmentation engine for German legal documents.

**YOUR TASK:** 
The user will provide a raw text block that contains TWO different roles merged together. You must physically split this text into two separate JSON objects.

**THE ROLES:**
1. **Property Manager** (starts with: "WEG-Verwalter", "Verwalter", "(1)")
2. **Accountant** (starts with: "Buchhaltung", "Abrechnung", "(2)")

**CRITICAL RULES:**
1. **STOPPING CRITERIA**: The 'property_manager' block MUST END exactly where the 'accountant' block begins.
2. **NO OVERLAP**: Do not include the Accountant's text inside the Property Manager's block.
3. **VERBATIM**: Copy the text exactly as it appears.

**EXAMPLE INPUT:**
"(1) WEG-Verwalter: Zum Verwalter ist Hans Müller bestellt. Er vertritt die WEG. (2) Buchhaltung: Die Abrechnung macht Firma RechnungsPro GmbH aus Berlin."

**CORRECT OUTPUT:**
[
  { "blockType": "property_manager", "blockText": "(1) WEG-Verwalter: Zum Verwalter ist Hans Müller bestellt. Er vertritt die WEG." },
  { "blockType": "accountant", "blockText": "(2) Buchhaltung: Die Abrechnung macht Firma RechnungsPro GmbH aus Berlin." }
]

**INCORRECT OUTPUT (DO NOT DO THIS):**
[
  { "blockType": "property_manager", "blockText": "(1) WEG-Verwalter: ... Er vertritt die WEG. (2) Buchhaltung: Die Abrechnung macht..." }
]
`
    },
    {
        role: "user",
        content: `SPLIT THIS TEXT:\n"""\n${section.rawText}\n"""`
    },
];

// --- Main Function ---

async function extractAdministrationBlocks(section: PdfSection): Promise<AdministrationBlock[]> {
    // 1. Check if we actually have text to process
    if (!section.rawText || section.rawText.trim().length < 5) return [];

    try {
        const result = await runJsonTool<{ blocks: AdministrationBlock[] }>({
            tool: ADMIN_BLOCK_TOOL,
            messages: buildMessages(section),
        });

        const blocks = result.parsed?.blocks ?? [];
        console.log("LLM Extraction Result:", blocks, "for section:", section.id, "with raw text:", section.rawText);

        // 2. Post-processing safety: Double check for emptiness
        return blocks
            .filter(b => b.blockText && b.blockText.trim().length > 0)
            .map(b => ({
                blockType: b.blockType,
                blockText: b.blockText.trim()
            }));

    } catch (error) {
        console.error("LLM Extraction Failed:", error);
        return [];
    }
}

export {
    extractAdministrationBlocks,
    type AdministrationBlock,
};