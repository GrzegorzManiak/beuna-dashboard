type LlmMessage = {
    role: "system" | "user";
    content: string;
};

type JsonToolSchema = {
    name: string;
    description?: string;
    outputSchema: Record<string, unknown>;
};

type JsonToolResult<T> = {
    raw: string;
    parsed: T | null;
    elapsedMs: number;
};

type OpenRouterConfig = {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
};

const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 45_000;

const parseJson = (raw: string) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const stripped = trimmed.startsWith("```")
        ? trimmed.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "")
        : trimmed;
    try {
        return JSON.parse(stripped);
    } catch {
        const start = stripped.indexOf("{");
        const end = stripped.lastIndexOf("}");
        if (start < 0 || end <= start) return null;
        try {
            return JSON.parse(stripped.slice(start, end + 1));
        } catch {
            return null;
        }
    }
};

const resolveOpenRouterConfig = (): OpenRouterConfig => {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is required.");

    const model = process.env.OPENROUTER_MODEL?.trim();
    if (!model) throw new Error("OPENROUTER_MODEL is required.");

    const baseUrl = process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_URL;

    return {
        apiKey,
        baseUrl,
        model,
        timeoutMs: DEFAULT_TIMEOUT_MS,
    };
};

const buildResponseFormat = (tool: JsonToolSchema) => ({
    type: "json_schema",
    json_schema: {
        name: tool.name,
        strict: true,
        schema: tool.outputSchema,
    },
});

async function runJsonTool<T>(args: {
    tool: JsonToolSchema;
    messages: LlmMessage[];
    model?: string;
    timeoutMs?: number;
}): Promise<JsonToolResult<T>> {
    const config = resolveOpenRouterConfig();
    const model = args.model ?? config.model;
    const timeoutMs = args.timeoutMs ?? config.timeoutMs;
    const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: args.messages,
                response_format: buildResponseFormat(args.tool),
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`OpenRouter request failed (${response.status}): ${text}`);
        }

        const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = payload.choices?.[0]?.message?.content ?? "";
        const parsed = parseJson(raw) as T | null;
        return {
            raw,
            parsed,
            elapsedMs: Date.now() - start,
        };
    } finally {
        clearTimeout(timeout);
    }
}

export {
    runJsonTool,
    type LlmMessage,
    type JsonToolSchema,
    type JsonToolResult,
};
