import type {
  Extraction,
  SeedEmail,
  Problem,
  TrafficLight,
  SenderType,
  UrgencyLevel,
  SourceSpan,
} from "../../shared/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (!key) {
    console.warn("⚠ OPENROUTER_API_KEY not set – LLM calls will fail");
  }
  return key;
}

// ── Format emails into text block ────────────────────────────────────
function formatEmails(emails: SeedEmail[]): string {
  return emails
    .map(
      (e, i) =>
        `--- Email ${i + 1} (id: ${e.id}) ---
From: ${e.from.name} <${e.from.email}>${e.from.unit ? ` (${e.from.unit})` : ""}${e.from.company ? ` [${e.from.company}]` : ""}
To: ${e.to}${e.cc ? `\nCC: ${e.cc}` : ""}
Date: ${e.timestamp}
Subject: ${e.subject}

${e.body}`
    )
    .join("\n\n");
}

// ── Build the analysis prompt ────────────────────────────────────────
function buildAnalysisPrompt(emails: SeedEmail[]): string {
  const emailText = formatEmails(emails);

  return `You are an AI assistant for a property management company. Analyze the following email thread and extract structured information.

EMAIL THREAD:
${emailText}

INSTRUCTIONS:
Extract the following fields from the email thread. For each field, assess your confidence (0.0-1.0) and assign a traffic light status:
- "green": information is clearly stated and complete
- "orange": information is partially available or inferred (could be auto-resolved by requesting more info)
- "red": information is missing or ambiguous and requires human judgment

Also extract "source_spans" — exact text snippets from the email bodies that support each extraction. These anchor the AI's reasoning back to the original text so a human reviewer can verify.

Return ONLY valid JSON matching this exact schema:

{
  "sender_name": { "value": "<name of primary sender>", "status": "<green|orange|red>", "confidence": <0-1> },
  "sender_type": { "value": "<tenant|landlord|contractor|prospect|internal|legal|system|external|unknown>", "status": "<green|orange|red>", "confidence": <0-1> },
  "urgency": { "value": "<critical|high|medium|low>", "status": "<green|orange|red>", "confidence": <0-1>, "note": "<brief reason>" },
  "summary": { "value": "<2-3 sentence summary of the thread>", "status": "<green|orange|red>", "confidence": <0-1> },
  "property": { "value": "<property name if identifiable>", "status": "<green|orange|red>", "confidence": <0-1> },
  "problems": [
    {
      "id": "<unique_id>",
      "title": "<short problem title>",
      "description": "<what the problem is>",
      "status": "<green|orange|red>",
      "category": "<maintenance|noise|legal|financial|safety|admin|lease|pest|security|compliance|other>",
      "suggested_action": "<what should be done, or null>",
      "requires_info": "<what info is missing, or null>"
    }
  ],
  "source_spans": [
    {
      "email_id": "<id of the email containing the text>",
      "text": "<exact text snippet from the email body — must be a verbatim substring>",
      "field": "<sender_name|sender_type|urgency|property|prob_1|prob_2|etc>",
      "label": "<short human label, e.g. 'Sender identified' or 'Water leak reported'>"
    }
  ]
}

RULES:
- The primary sender is the person who initiated the thread (first email).
- An email may contain MULTIPLE distinct problems. List each separately.
- Mark a problem "green" if all info needed to act is present.
- Mark a problem "orange" if the system could auto-request missing info (e.g. apartment number, contact details).
- Mark a problem "red" if human judgment is required (e.g. legal decisions, conflict resolution, ambiguous priority).
- Be conservative with "green" — only use it when you're truly confident.
- urgency "critical" = immediate safety/health risk or legal deadline. "high" = same-day response needed. "medium" = this week. "low" = informational.
- For source_spans: extract 5-15 spans. Each "text" MUST be a verbatim substring from an email body. Include spans for the sender name, each problem, urgency indicators, and property references.

Return ONLY the JSON object. No markdown, no explanation.`;
}

// ── Build the draft-email prompt ─────────────────────────────────────
function buildDraftEmailPrompt(
  emails: SeedEmail[],
  extraction: Extraction | null,
  actionType: string,
  problem: Problem | null
): string {
  const emailText = formatEmails(emails);
  const firstEmail = emails[0]!;
  const senderFirst = firstEmail.from.name.split(" ")[0];

  // Build context from extraction
  let extractionContext = "";
  if (extraction) {
    extractionContext = `
CURRENT ANALYSIS:
- Sender: ${extraction.sender_name.value} (${extraction.sender_type.value})
- Urgency: ${extraction.urgency.value}
- Property: ${extraction.property.value}
- Summary: ${extraction.summary.value}
- Problems: ${extraction.problems.map((p) => `[${p.status.toUpperCase()}] ${p.title}: ${p.description}`).join("\n  ")}`;
  }

  // Template scaffolds for each action type
  const templates: Record<string, string> = {
    acknowledge: `TEMPLATE SCAFFOLD (use as rough structure, adapt to the actual situation):
Dear ${senderFirst},

Thank you for contacting us regarding [specific issue from their email]. We have received your message and are actively looking into this.

[1-2 sentences showing you understand their specific concern]

We will follow up with you within [appropriate timeframe] with an update.

Best regards,
ManageCo Property Management`,

    request_info: `TEMPLATE SCAFFOLD (use as rough structure, adapt to the actual situation):
Dear ${senderFirst},

Thank you for reaching out about [specific issue]. To help us resolve this as quickly as possible, we need a few additional details:

${problem?.requires_info ? `- ${problem.requires_info}` : "- [specific info needed based on the context]"}

Once we have this information, we'll be able to [specific next step].

Best regards,
ManageCo Property Management`,

    maintenance_request: `TEMPLATE SCAFFOLD (use as rough structure, adapt to the actual situation):
Dear ${senderFirst},

Thank you for reporting [specific maintenance issue]. We have logged this as a maintenance request (Ref: MR-XXXX).

Our maintenance team will contact you within [timeframe] to arrange access and carry out the necessary work. [Any specific instructions based on urgency].

If this is an emergency, please call our 24-hour maintenance line at +353 1 XXX XXXX.

Best regards,
ManageCo Property Management`,

    escalate: `TEMPLATE SCAFFOLD (use as rough structure, adapt to the actual situation):
Dear ${senderFirst},

Thank you for your patience regarding [specific issue]. We understand this matter requires urgent attention.

We have escalated your case to our [senior management/legal team/relevant department] for immediate review. You can expect to hear from [appropriate person] within [timeframe].

Best regards,
ManageCo Property Management`,
  };

  const template = templates[actionType] ?? templates.acknowledge!;

  return `You are drafting an email response for ManageCo Property Management.

FULL EMAIL THREAD FOR CONTEXT:
${emailText}
${extractionContext}

${problem ? `SPECIFIC PROBLEM BEING ADDRESSED:
Title: ${problem.title}
Description: ${problem.description}
Status: ${problem.status}
Category: ${problem.category}
${problem.requires_info ? `Missing info: ${problem.requires_info}` : ""}
${problem.suggested_action ? `Suggested action: ${problem.suggested_action}` : ""}` : ""}

ACTION TYPE: ${actionType}

${template}

INSTRUCTIONS:
- Rewrite the template above into a polished, context-aware email response.
- Reference specific details from the email thread (dates, issues, names, unit numbers).
- Be professional, empathetic, and concise (under 150 words).
- Address the sender by their first name.
- DO NOT include a subject line or email headers.
- Sign off as "ManageCo Property Management".

Return ONLY the email body text.`;
}

// ── Call OpenRouter (generic) ────────────────────────────────────────
async function callLLM(
  prompt: string,
  temperature = 0.2,
  maxTokens = 2000
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Property Manager Inbox",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() ?? "";
}

// ── Analyze Thread ───────────────────────────────────────────────────
export async function analyzeThread(emails: SeedEmail[]): Promise<Extraction> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return createMockExtraction(emails);
  }

  const prompt = buildAnalysisPrompt(emails);
  const content = await callLLM(prompt, 0.1, 2000);

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonStr = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(jsonStr) as Extraction;

  // Ensure problem IDs are set
  if (parsed.problems) {
    parsed.problems.forEach((p, i) => {
      if (!p.id) p.id = `prob_${i + 1}`;
    });
  }

  // Validate source spans — only keep those that are actual substrings
  if (parsed.source_spans) {
    const allBodies = emails.map((e) => e.body).join("\n");
    parsed.source_spans = parsed.source_spans.filter(
      (span) => span.text && allBodies.includes(span.text)
    );
  }

  return parsed;
}

// ── Generate Draft Email ─────────────────────────────────────────────
export async function generateDraftEmail(
  emails: SeedEmail[],
  extraction: Extraction | null,
  actionType: string,
  problem: Problem | null
): Promise<string> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return createMockDraftEmail(emails, extraction, actionType, problem);
  }

  const prompt = buildDraftEmailPrompt(emails, extraction, actionType, problem);
  return await callLLM(prompt, 0.4, 500);
}

// ── Mock extraction for dev without API key ──────────────────────────
function createMockExtraction(emails: SeedEmail[]): Extraction {
  const first = emails[0]!;
  const senderType = (first.from.type ?? "unknown") as SenderType;

  // Infer urgency from subject/body keywords
  const text = `${first.subject} ${first.body}`.toLowerCase();
  let urgency: UrgencyLevel = "medium";
  let urgencyStatus: TrafficLight = "orange";
  if (
    text.includes("urgent") ||
    text.includes("emergency") ||
    text.includes("asap") ||
    text.includes("immediately")
  ) {
    urgency = "critical";
    urgencyStatus = "green";
  } else if (
    text.includes("today") ||
    text.includes("health") ||
    text.includes("safety")
  ) {
    urgency = "high";
    urgencyStatus = "green";
  } else if (
    text.includes("request") ||
    text.includes("inquiry") ||
    text.includes("question")
  ) {
    urgency = "low";
    urgencyStatus = "green";
  }

  const propertyId = first.from.property_id;
  const hasProperty = !!propertyId;

  // Build source spans from actual email text
  const sourceSpans: SourceSpan[] = [];

  // Find sender name in body or use the From line
  sourceSpans.push({
    email_id: first.id,
    text: first.from.name,
    field: "sender_name",
    label: `Sender: ${first.from.name}`,
  });

  // Find urgency keywords
  const urgencyKeywords = [
    "urgent", "emergency", "asap", "immediately", "today",
    "health", "safety", "dangerous", "critical", "leaking",
    "flooding", "broken", "damage", "hazard",
  ];
  for (const email of emails) {
    const bodyLower = email.body.toLowerCase();
    for (const kw of urgencyKeywords) {
      const idx = bodyLower.indexOf(kw);
      if (idx !== -1) {
        // Grab 2-5 words around the keyword for context
        const start = Math.max(0, email.body.lastIndexOf(" ", Math.max(0, idx - 15)) + 1);
        const endSpace = email.body.indexOf(" ", idx + kw.length + 10);
        const end = endSpace === -1 ? Math.min(email.body.length, idx + kw.length + 15) : endSpace;
        const snippet = email.body.substring(start, end).trim();
        if (snippet.length > 2 && email.body.includes(snippet)) {
          sourceSpans.push({
            email_id: email.id,
            text: snippet,
            field: "urgency",
            label: "Urgency indicator",
          });
        }
        break;
      }
    }
  }

  // Extract problem-related phrases
  const sentences = first.body.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
  if (sentences[0]) {
    const problemText = sentences[0]!.trim();
    if (first.body.includes(problemText)) {
      sourceSpans.push({
        email_id: first.id,
        text: problemText,
        field: "prob_1",
        label: "Primary issue",
      });
    }
  }
  // Also try to get a second problem-related sentence
  if (sentences[1]) {
    const s2 = sentences[1]!.trim();
    if (first.body.includes(s2) && s2 !== sentences[0]?.trim()) {
      sourceSpans.push({
        email_id: first.id,
        text: s2,
        field: "prob_1",
        label: "Issue details",
      });
    }
  }

  return {
    sender_name: {
      value: first.from.name,
      status: "green",
      confidence: 0.95,
    },
    sender_type: {
      value: senderType,
      status: senderType === "unknown" ? "red" : "green",
      confidence: senderType === "unknown" ? 0.3 : 0.9,
    },
    urgency: {
      value: urgency,
      status: urgencyStatus,
      confidence: 0.6,
      note: "Auto-classified based on keywords",
    },
    summary: {
      value: `${first.from.name} sent an email regarding: ${first.subject}`,
      status: "orange",
      confidence: 0.5,
    },
    property: {
      value: hasProperty ? propertyId! : "Unknown",
      status: hasProperty ? "green" : "red",
      confidence: hasProperty ? 0.9 : 0.1,
    },
    problems: [
      {
        id: "prob_1",
        title: first.subject.slice(0, 60),
        description: first.body.slice(0, 200) + "...",
        status: "orange",
        category: "other",
        suggested_action: "Review and respond to the email thread",
        requires_info: null,
      },
    ],
    source_spans: sourceSpans,
  };
}

// ── Mock draft email (context-aware) ─────────────────────────────────
function createMockDraftEmail(
  emails: SeedEmail[],
  extraction: Extraction | null,
  actionType: string,
  problem: Problem | null
): string {
  const first = emails[0]!;
  const firstName = first.from.name.split(" ")[0];
  const subject = first.subject;

  // Pull real context from the extraction
  const urgency = extraction?.urgency.value ?? "medium";
  const propertyName = extraction?.property.value ?? "your property";

  // Urgency-appropriate timeframe
  const timeframe =
    urgency === "critical"
      ? "within the hour"
      : urgency === "high"
        ? "within 24 hours"
        : "within 2-3 business days";

  if (actionType === "request_info") {
    const missingInfo =
      problem?.requires_info ?? "any additional details that would help us assist you";
    return `Dear ${firstName},

Thank you for reaching out regarding "${subject}". We want to make sure we address this properly for you at ${propertyName}.

To help us resolve this as quickly as possible, could you please provide us with:

• ${missingInfo}

Once we have this information, we'll be able to take the appropriate next steps ${timeframe}.

We appreciate your patience and cooperation.

Best regards,
ManageCo Property Management`;
  }

  if (actionType === "acknowledge") {
    return `Dear ${firstName},

Thank you for your email regarding "${subject}". We have received your message and our team is actively reviewing this matter.

${problem ? `We understand the concern about ${problem.title.toLowerCase()} and want to assure you this is being treated with ${urgency === "critical" ? "the highest" : urgency === "high" ? "high" : "appropriate"} priority.` : `We understand this is important and are treating it with ${urgency === "critical" ? "the highest" : urgency === "high" ? "high" : "appropriate"} priority.`}

You can expect an update from us ${timeframe}. In the meantime, if the situation changes or you have additional information, please don't hesitate to reply to this email.

Best regards,
ManageCo Property Management`;
  }

  if (actionType === "maintenance_request") {
    return `Dear ${firstName},

Thank you for reporting the issue at ${propertyName}. We have logged a maintenance request for "${problem?.title ?? subject}".

Our maintenance team will contact you ${timeframe} to arrange access and carry out the necessary work.${urgency === "critical" || urgency === "high" ? "\n\nGiven the urgency of this issue, we have flagged this as a priority case." : ""}

If this is an emergency that requires immediate attention, please call our 24-hour maintenance line at +353 1 XXX XXXX.

Best regards,
ManageCo Property Management`;
  }

  if (actionType === "escalate") {
    return `Dear ${firstName},

Thank you for your patience regarding "${subject}" at ${propertyName}. We understand this matter requires elevated attention.

We have escalated your case to our senior management team for immediate review. A senior team member will be in touch with you ${urgency === "critical" ? "within the hour" : "within 24 hours"} to discuss next steps.

${problem ? `We take the matter of ${problem.title.toLowerCase()} very seriously and are committed to reaching a satisfactory resolution.` : "We are committed to reaching a satisfactory resolution."}

Best regards,
ManageCo Property Management`;
  }

  return `Dear ${firstName},

Thank you for your email regarding "${subject}". We are reviewing your request and will respond ${timeframe}.

Best regards,
ManageCo Property Management`;
}
