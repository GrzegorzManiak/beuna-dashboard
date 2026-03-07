import { Resend } from "resend";
import type { Extraction, Problem, SeedEmail, ThreadAction } from "../../shared/types";

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";
const CS_TO_EMAIL = process.env.CS_FORWARD_TO_EMAIL?.trim() ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
const INBOX_URL = process.env.APP_INBOX_URL?.trim() || "http://localhost:3000/inbox";

function getMissingEmailConfig(): string[] {
  const missing: string[] = [];
  if (!RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!CS_TO_EMAIL) missing.push("CS_FORWARD_TO_EMAIL");
  if (!RESEND_FROM_EMAIL) missing.push("RESEND_FROM_EMAIL");
  return missing;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLatestExternalEmail(emails: SeedEmail[]): SeedEmail | null {
  for (let i = emails.length - 1; i >= 0; i--) {
    const email = emails[i]!;
    const isInternal =
      email.from.type === "internal" || email.from.email.endsWith("@manageco.ie");
    if (!isInternal) return email;
  }
  return emails[emails.length - 1] ?? null;
}

function getProblemRows(
  extraction: Extraction | null,
  action: ThreadAction
): Array<{ title: string; status: string; description: string; next: string }> {
  if (!extraction) return [];

  const targetProblem = action.problem_id
    ? extraction.problems.find((problem) => problem.id === action.problem_id) ?? null
    : null;

  const selected =
    targetProblem ??
    extraction.problems.find((problem) => problem.status === "red") ??
    extraction.problems[0] ??
    null;

  const remainder = extraction.problems
    .filter((problem) => problem !== selected)
    .slice(0, 2);

  const list: Problem[] = selected ? [selected, ...remainder] : extraction.problems.slice(0, 3);
  return list.map((problem) => ({
    title: problem.title,
    status: problem.status.toUpperCase(),
    description: problem.description,
    next: problem.suggested_action ?? "Review and respond as needed.",
  }));
}

function buildEscalationHtml({
  threadId,
  propertyName,
  emails,
  extraction,
  action,
}: {
  threadId: string;
  propertyName: string;
  emails: SeedEmail[];
  extraction: Extraction | null;
  action: ThreadAction;
}): { subject: string; html: string; text: string } {
  const first = emails[0]!;
  const latest = getLatestExternalEmail(emails) ?? first;
  const problems = getProblemRows(extraction, action);
  const urgency = extraction?.urgency.value ?? "unknown";
  const summary = extraction?.summary.value ?? "No AI summary available yet.";

  const problemHtml =
    problems.length > 0
      ? problems
          .map(
            (problem) => `
            <tr>
              <td style="padding: 12px; border-top: 1px solid #232937; font-weight: 700; color: #f6fbff;">${escapeHtml(problem.title)}</td>
              <td style="padding: 12px; border-top: 1px solid #232937; color: #9ed5ff; font-weight: 700;">${escapeHtml(problem.status)}</td>
              <td style="padding: 12px; border-top: 1px solid #232937; color: #b4becf;">${escapeHtml(problem.description)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 0 12px 12px 12px; color: #aeb7c7; font-size: 12px;">
                Next step: ${escapeHtml(problem.next)}
              </td>
            </tr>
          `
          )
          .join("")
      : `
        <tr>
          <td colspan="3" style="padding: 12px; border-top: 1px solid #232937; color: #aeb7c7;">
            No extracted problems available.
          </td>
        </tr>
      `;

  const subject = `Dispatch CS Escalation: ${first.subject} (${propertyName})`;
  const safeSummary = escapeHtml(summary);
  const safeLatestSnippet = escapeHtml(latest.body.slice(0, 600));
  const safeActionDescription = escapeHtml(action.description);

  const html = `
  <div style="font-family: 'Menlo', 'Consolas', 'SFMono-Regular', monospace; background: #0b1018; color: #e7edf6; padding: 30px; border-radius: 8px;">
    <p style="color: #f0ff63; font-size: 12px; letter-spacing: 0.12em; margin: 0 0 14px;">DISPATCH / CS ESCALATION</p>
    <h2 style="font-size: 21px; line-height: 1.35; margin: 0 0 8px;">${escapeHtml(first.subject)}</h2>
    <p style="margin: 0 0 18px; color: #9eaac0; font-size: 13px;">Action: ${safeActionDescription}</p>

    <div style="background: rgba(255,255,255,0.04); border: 1px solid #283041; border-radius: 6px; padding: 14px; margin-bottom: 18px;">
      <p style="margin: 0 0 6px; font-size: 13px;"><strong style="color: #f4f7fb;">Thread:</strong> ${escapeHtml(threadId)}</p>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong style="color: #f4f7fb;">Property:</strong> ${escapeHtml(propertyName)}</p>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong style="color: #f4f7fb;">Urgency:</strong> ${escapeHtml(String(urgency).toUpperCase())}</p>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong style="color: #f4f7fb;">Sender:</strong> ${escapeHtml(first.from.name)} (${escapeHtml(first.from.email)})</p>
      <p style="margin: 0; font-size: 13px;"><strong style="color: #f4f7fb;">Latest inbound:</strong> ${escapeHtml(formatTimestamp(latest.timestamp))}</p>
    </div>

    <div style="background: rgba(158,213,255,0.08); border: 1px solid rgba(158,213,255,0.28); border-radius: 6px; padding: 14px; margin-bottom: 18px;">
      <p style="margin: 0 0 8px; color: #9ed5ff; font-size: 12px; letter-spacing: 0.08em;">AI SUMMARY</p>
      <p style="margin: 0; color: #dce3ef; font-size: 13px; line-height: 1.5;">${safeSummary}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; border: 1px solid #232937; border-radius: 6px; overflow: hidden; margin-bottom: 18px;">
      <thead>
        <tr style="background: rgba(255,255,255,0.02);">
          <th align="left" style="padding: 12px; color: #d4def0; font-size: 12px; letter-spacing: 0.08em;">PROBLEM</th>
          <th align="left" style="padding: 12px; color: #d4def0; font-size: 12px; letter-spacing: 0.08em;">STATUS</th>
          <th align="left" style="padding: 12px; color: #d4def0; font-size: 12px; letter-spacing: 0.08em;">DETAIL</th>
        </tr>
      </thead>
      <tbody>${problemHtml}</tbody>
    </table>

    <div style="background: rgba(255,255,255,0.04); border: 1px solid #283041; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px; color: #f4f7fb; font-size: 12px; letter-spacing: 0.08em;">LATEST MESSAGE SNIPPET</p>
      <p style="margin: 0; color: #b9c3d5; font-size: 12px; line-height: 1.5; white-space: pre-wrap;">${safeLatestSnippet}</p>
    </div>

    <a href="${escapeHtml(INBOX_URL)}"
       style="display: inline-block; background: #f0ff63; color: #0b1018; padding: 10px 18px; border-radius: 4px; font-weight: 700; font-size: 12px; text-decoration: none; letter-spacing: 0.03em;">
      Open Dispatch Inbox
    </a>
  </div>
  `;

  const text = [
    "DISPATCH / CS ESCALATION",
    `Subject: ${first.subject}`,
    `Thread: ${threadId}`,
    `Property: ${propertyName}`,
    `Urgency: ${urgency}`,
    `Sender: ${first.from.name} <${first.from.email}>`,
    `Latest inbound: ${formatTimestamp(latest.timestamp)}`,
    "",
    "Summary:",
    summary,
    "",
    "Problems:",
    ...problems.map(
      (problem, index) =>
        `${index + 1}. ${problem.title} [${problem.status}] - ${problem.description} | Next: ${problem.next}`
    ),
    "",
    "Latest message snippet:",
    latest.body.slice(0, 600),
    "",
    `Review: ${INBOX_URL}`,
  ].join("\n");

  return { subject, html, text };
}

export async function sendForwardToCustomerServiceEmail({
  threadId,
  action,
  emails,
  extraction,
  propertyName,
}: {
  threadId: string;
  action: ThreadAction;
  emails: SeedEmail[];
  extraction: Extraction | null;
  propertyName: string;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!emails.length) {
    return { ok: false, error: "Thread has no emails to send." };
  }

  const missingConfig = getMissingEmailConfig();
  if (missingConfig.length > 0) {
    return {
      ok: false,
      error: `Missing email config: ${missingConfig.join(", ")}`,
    };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);

    const { subject, html, text } = buildEscalationHtml({
      threadId,
      propertyName,
      emails,
      extraction,
      action,
    });

    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: CS_TO_EMAIL,
      subject,
      html,
      text,
    });

    const response = result as unknown as {
      id?: string;
      data?: { id?: string };
      error?: { message?: string } | string;
    };

    if (response.error) {
      const message =
        typeof response.error === "string"
          ? response.error
          : response.error.message ?? "Unknown Resend API error.";
      return { ok: false, error: message };
    }

    return { ok: true, id: response.id ?? response.data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
