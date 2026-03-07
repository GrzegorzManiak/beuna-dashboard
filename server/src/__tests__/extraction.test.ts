import { describe, test, expect } from "bun:test";
import { createMockExtraction } from "../llm";
import type { SeedEmail } from "../../../shared/types";

// ── Helpers ──────────────────────────────────────────────────────────
function makeEmail(overrides: Partial<SeedEmail> = {}): SeedEmail {
  return {
    id: "email_001",
    thread_id: "thread_001",
    thread_position: 1,
    timestamp: "2025-01-15T10:00:00Z",
    from: {
      name: "John Smith",
      email: "john.smith@gmail.com",
      type: "tenant",
      unit: "Apt 4B",
      property_id: "prop_riverside_manor",
    },
    to: "info@manageco.ie",
    subject: "Broken boiler in apartment",
    body: "Hi, I'm writing to report that the boiler in my apartment has stopped working.\n\nThe heating hasn't been functioning since last Tuesday and it's getting very cold. I've tried resetting it but nothing works.\n\nPlease can you send someone to look at it urgently?",
    attachments: [],
    read: false,
    ...overrides,
  };
}

// ── Sender Name Extraction ───────────────────────────────────────────
describe("sender name extraction", () => {
  test("extracts name from email sender", () => {
    const email = makeEmail({ from: { name: "Mary O'Brien", email: "mary@test.com", type: "tenant" } });
    const result = createMockExtraction([email]);
    expect(result.sender_name.value).toBe("Mary O'Brien");
    expect(result.sender_name.status).toBe("green");
    expect(result.sender_name.confidence).toBeGreaterThan(0.5);
  });

  test("creates source span for sender name when name appears in body", () => {
    const email = makeEmail({
      body: "Hi, this is John Smith from Apt 4B.\n\nI'm writing to report a broken boiler.",
    });
    const result = createMockExtraction([email]);
    const nameSpan = result.source_spans?.find((s) => s.field === "sender_name");
    expect(nameSpan).toBeDefined();
    expect(nameSpan!.text).toBe("John Smith");
    expect(nameSpan!.email_id).toBe("email_001");
  });
});

// ── Sender Type Extraction ───────────────────────────────────────────
describe("sender type extraction", () => {
  test("extracts tenant type from email metadata", () => {
    const email = makeEmail({ from: { name: "Test", email: "t@t.com", type: "tenant" } });
    const result = createMockExtraction([email]);
    expect(result.sender_type.value).toBe("tenant");
    expect(result.sender_type.status).toBe("green");
  });

  test("extracts landlord type", () => {
    const email = makeEmail({ from: { name: "Owner", email: "o@o.com", type: "landlord" } });
    const result = createMockExtraction([email]);
    expect(result.sender_type.value).toBe("landlord");
    expect(result.sender_type.status).toBe("green");
  });

  test("marks unknown sender type as red", () => {
    const email = makeEmail({ from: { name: "Unknown", email: "u@u.com", type: "unknown" } });
    const result = createMockExtraction([email]);
    expect(result.sender_type.value).toBe("unknown");
    expect(result.sender_type.status).toBe("red");
    expect(result.sender_type.confidence).toBeLessThan(0.5);
  });
});

// ── Urgency Extraction ───────────────────────────────────────────────
describe("urgency extraction", () => {
  test("detects critical urgency from 'urgent' keyword", () => {
    const email = makeEmail({
      subject: "URGENT: Water leak in apartment",
      body: "There is an urgent water leak flooding my kitchen. Please help immediately.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("critical");
    expect(result.urgency.status).toBe("green");
  });

  test("detects critical urgency from 'emergency' keyword", () => {
    const email = makeEmail({
      subject: "Emergency boiler failure",
      body: "The boiler has failed completely, emergency situation.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("critical");
  });

  test("detects high urgency from 'today' keyword", () => {
    const email = makeEmail({
      subject: "Need help today",
      body: "I need someone to come out today to fix the lock.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("high");
    expect(result.urgency.status).toBe("green");
  });

  test("detects high urgency from 'safety' keyword", () => {
    const email = makeEmail({
      subject: "Safety concern in hallway",
      body: "There is a safety hazard with the stairwell lighting.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("high");
  });

  test("detects low urgency from 'inquiry' keyword", () => {
    const email = makeEmail({
      subject: "General inquiry about lease",
      body: "I have an inquiry about renewing my lease next year.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("low");
  });

  test("defaults to medium urgency when no keywords found", () => {
    const email = makeEmail({
      subject: "Hello from apartment 4",
      body: "Just wanted to check on a few things about the building.",
    });
    const result = createMockExtraction([email]);
    expect(result.urgency.value).toBe("medium");
    expect(result.urgency.status).toBe("orange");
  });

  test("creates source span for urgency keyword", () => {
    const email = makeEmail({
      body: "The pipe is leaking badly and it's flooding the floor.",
    });
    const result = createMockExtraction([email]);
    const urgencySpan = result.source_spans?.find((s) => s.field === "urgency");
    expect(urgencySpan).toBeDefined();
    expect(urgencySpan!.text.toLowerCase()).toContain("leaking");
  });
});

// ── Property Extraction ──────────────────────────────────────────────
describe("property extraction", () => {
  test("extracts property_id from sender metadata", () => {
    const email = makeEmail({
      from: {
        name: "Test",
        email: "t@t.com",
        type: "tenant",
        property_id: "prop_oak_house",
      },
    });
    const result = createMockExtraction([email]);
    expect(result.property.value).toBe("prop_oak_house");
    expect(result.property.status).toBe("green");
  });

  test("marks unknown property as red when no property_id", () => {
    const email = makeEmail({
      from: { name: "Test", email: "t@t.com", type: "tenant" },
    });
    const result = createMockExtraction([email]);
    expect(result.property.value).toBe("Unknown");
    expect(result.property.status).toBe("red");
  });
});

// ── Problem Extraction ───────────────────────────────────────────────
describe("problem extraction", () => {
  test("creates at least one problem from email", () => {
    const email = makeEmail();
    const result = createMockExtraction([email]);
    expect(result.problems.length).toBeGreaterThanOrEqual(1);
  });

  test("problem title comes from subject", () => {
    const email = makeEmail({ subject: "Broken window in unit 7" });
    const result = createMockExtraction([email]);
    expect(result.problems[0]!.title).toContain("Broken window");
  });

  test("problem has valid id", () => {
    const email = makeEmail();
    const result = createMockExtraction([email]);
    expect(result.problems[0]!.id).toBe("prob_1");
  });

  test("problem has description from body", () => {
    const email = makeEmail({
      body: "The kitchen sink is completely blocked and water is backing up.",
    });
    const result = createMockExtraction([email]);
    expect(result.problems[0]!.description).toContain("kitchen sink");
  });

  test("problem has a category", () => {
    const email = makeEmail();
    const result = createMockExtraction([email]);
    expect(result.problems[0]!.category).toBeDefined();
    expect(result.problems[0]!.category.length).toBeGreaterThan(0);
  });
});

// ── Source Span Quality ──────────────────────────────────────────────
describe("source span extraction", () => {
  test("creates source spans for problem text", () => {
    const email = makeEmail();
    const result = createMockExtraction([email]);
    const probSpans = result.source_spans?.filter((s) => s.field === "prob_1") ?? [];
    expect(probSpans.length).toBeGreaterThan(0);
  });

  test("problem spans cover multi-line text (not just one sentence)", () => {
    const email = makeEmail({
      body: "Hi, I'm writing to report that the boiler has stopped working.\n\nThe heating hasn't been functioning since last Tuesday and it's getting very cold. I've tried resetting it but nothing works.\n\nPlease can you send someone urgently?",
    });
    const result = createMockExtraction([email]);
    const probSpans = result.source_spans?.filter((s) => s.field === "prob_1") ?? [];
    
    // Should have at least 2 spans (multiple paragraphs)
    expect(probSpans.length).toBeGreaterThanOrEqual(2);
    
    // First span should be the full first paragraph, not just one sentence
    const firstSpan = probSpans[0]!;
    expect(firstSpan.text.length).toBeGreaterThan(20);
  });

  test("all source spans reference text that exists in the email body", () => {
    const email = makeEmail({
      body: "Urgent: the kitchen ceiling is leaking water into the living room.\n\nThis started yesterday afternoon after heavy rain. There appears to be a crack in the roof above.\n\nI've placed buckets to catch the water but the damage is spreading.",
    });
    const result = createMockExtraction([email]);
    
    for (const span of result.source_spans ?? []) {
      const emailBody = email.body;
      expect(emailBody.includes(span.text)).toBe(true);
    }
  });

  test("source spans include email_id", () => {
    const email = makeEmail({ id: "email_test_123" });
    const result = createMockExtraction([email]);
    for (const span of result.source_spans ?? []) {
      expect(span.email_id).toBe("email_test_123");
    }
  });

  test("picks up additional context from other emails in thread", () => {
    const email1 = makeEmail({
      id: "email_001",
      body: "The boiler has broken down.\n\nPlease help.",
    });
    const email2 = makeEmail({
      id: "email_002",
      thread_position: 2,
      from: { name: "Tenant Follow", email: "tenant@test.com", type: "tenant" },
      body: "Following up on the boiler issue.\n\nIt's now been two days without heating and the temperature inside is dropping below 10°C.",
    });
    
    const result = createMockExtraction([email1, email2]);
    const allSpanEmails = new Set((result.source_spans ?? []).map((s) => s.email_id));
    
    // Should have spans from at least the first email
    expect(allSpanEmails.has("email_001")).toBe(true);
    // Should also pick up context from follow-up email
    expect(allSpanEmails.has("email_002")).toBe(true);
  });
});

// ── Summary Extraction ───────────────────────────────────────────────
describe("summary extraction", () => {
  test("generates summary with sender name and subject", () => {
    const email = makeEmail({
      from: { name: "Alice Brown", email: "alice@test.com", type: "tenant" },
      subject: "Noise complaint about unit above",
    });
    const result = createMockExtraction([email]);
    expect(result.summary.value).toContain("Alice Brown");
    expect(result.summary.value).toContain("Noise complaint");
  });
});
