import { describe, expect, test } from "bun:test";
import type { Extraction, Problem } from "../../../shared/types";
import { planHumanSupportEscalation } from "../routes";

function makeProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: "prob_1",
    title: "Lease dispute",
    description:
      "The resident is disputing a lease interpretation and is threatening formal action if the issue is not reviewed.",
    status: "red",
    category: "legal",
    suggested_action: "Escalate for legal review",
    requires_info: null,
    ...overrides,
  };
}

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    sender_name: { value: "Pat Murphy", status: "green", confidence: 0.94 },
    sender_type: { value: "tenant", status: "green", confidence: 0.91 },
    urgency: {
      value: "high",
      status: "green",
      confidence: 0.88,
      note: "Follow-up requested today.",
    },
    summary: {
      value: "The sender needs a policy decision and may involve legal follow-up.",
      status: "green",
      confidence: 0.9,
    },
    property: { value: "Graylings", status: "green", confidence: 0.93 },
    problems: [makeProblem()],
    source_spans: [],
    ...overrides,
  };
}

describe("planHumanSupportEscalation", () => {
  test("auto-approves high-confidence legal escalations", () => {
    const plan = planHumanSupportEscalation(makeExtraction());

    expect(plan.shouldCreate).toBe(true);
    expect(plan.shouldAutoApprove).toBe(true);
    expect(plan.problems).toHaveLength(1);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.86);
  });

  test("queues moderate compliance escalations for review", () => {
    const plan = planHumanSupportEscalation(
      makeExtraction({
        urgency: {
          value: "medium",
          status: "orange",
          confidence: 0.65,
          note: "No immediate deadline stated.",
        },
        summary: {
          value: "The sender reports a documentation issue that may need compliance review.",
          status: "orange",
          confidence: 0.72,
        },
        problems: [
          makeProblem({
            category: "compliance",
            suggested_action: null,
            description:
              "The resident says required documentation for a compliance request appears to be missing from the file.",
          }),
        ],
      })
    );

    expect(plan.shouldCreate).toBe(true);
    expect(plan.shouldAutoApprove).toBe(false);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.68);
    expect(plan.confidence).toBeLessThan(0.86);
  });

  test("skips low-confidence red issues that still need clarification", () => {
    const plan = planHumanSupportEscalation(
      makeExtraction({
        sender_name: { value: "Unknown", status: "orange", confidence: 0.35 },
        sender_type: { value: "unknown", status: "red", confidence: 0.24 },
        urgency: {
          value: "medium",
          status: "orange",
          confidence: 0.42,
          note: "The tone suggests concern but lacks a hard deadline.",
        },
        summary: {
          value: "The issue is unclear and the sender omitted key details.",
          status: "red",
          confidence: 0.38,
        },
        property: { value: "Unknown", status: "red", confidence: 0.18 },
        problems: [
          makeProblem({
            category: "other",
            suggested_action: null,
            requires_info: "Unit number, dates, and photos of the issue.",
            description: "The sender reports a problem but the details are incomplete.",
          }),
        ],
      })
    );

    expect(plan.shouldCreate).toBe(false);
    expect(plan.shouldAutoApprove).toBe(false);
    expect(plan.confidence).toBeLessThan(0.68);
    expect(plan.problems).toHaveLength(0);
  });
});
