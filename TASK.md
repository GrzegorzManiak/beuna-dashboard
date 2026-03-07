## Master Prompt

You are a systems architect and product engineer.

Your job is not to extend the existing system. Your job is to **strip it down to its core purpose and rewire it for a new context**.

Do not preserve unnecessary structure. Remove complexity wherever possible.

Focus on the underlying problem being solved.

---

## Core Task

You are given a project description and seed data.

Your job is to:

1. Extract the **core problem the system solves**
2. Remove all unnecessary infrastructure or implementation assumptions
3. Rebuild the system around a **minimal architecture suitable for a hackathon prototype**

The output should be a **clean system design that implements the same idea in the simplest possible way**.

---

## Project Context

Property managers receive large volumes of messy communication from:

* tenants
* landlords
* contractors
* prospective tenants

Messages come through email and contain unstructured information.

The goal of the system is to help a property manager quickly understand:

* who the message is from
* what the issue is
* how urgent it is
* what action should be taken

Seed data is provided in `TASK.json`.

---

## System Direction

The current implementation scans PDFs and contains unnecessary backend complexity.

You must **rewrite the system so it works only on raw email text**.

The system should:

* take an email thread
* send the text to an LLM through OpenRouter
* extract a few structured fields

The extracted fields should include:

* sender_name
* sender_type (tenant, landlord, contractor, unknown)
* urgency
* detected_problems (an email may contain multiple)
* summary

---

## Workflow Model

The system uses a **traffic light status model**.

### Green

Information is complete and correctly identified.

### Orange

Information is partially complete but solvable automatically by the agent.

Example:
The tenant reports a problem but does not include the apartment number.

The agent can send an automated request for more information.

### Red

The system cannot proceed without human intervention.

---

## Inbox Concept

Create an **Inbox dashboard** where each email thread is displayed.

Each thread should show:

* the email conversation
* extracted structured data
* detected problems

On the right side panel there should be categorized sections such as:

* sender
* urgency
* problems
* summary

Each section has a status indicator (green / orange / red).

---

## Human-in-the-loop workflow

If the system cannot confidently proceed, the thread is escalated to a human.

The human interface allows:

* correcting extracted fields
* confirming classifications
* triggering workflows
* replying manually
* approving the AI response

Once all red blockers are resolved, a **Continue** button becomes available.

---

## Automation Concept

If a problem is identified and confidence is high, the system can trigger a workflow.

Examples:

* maintenance request
* contractor dispatch
* request more information
* acknowledge message

Outgoing emails are **mocked** for the hackathon but should contain realistic content.

All interactions should be saved to a local JSON file.

---

## Data Constraints

This is a hackathon prototype.

Do not use a database.

Use:

* `TASK.json` as seed data
* a second local JSON file for runtime state

---

## UI Behavior

Inbox view:

* list of email threads

Thread view:

* email chain on the left
* structured data panel on the right

Problem workflow view:

* ability to classify problems
* ability to add context
* ability to trigger automation

Multiple problems may exist in one email.
The system cannot proceed until all problems are at least orange.

---

## Output Format

Produce:

1. A simplified architecture
2. The core data structures
3. The minimal LLM extraction prompt
4. The inbox workflow logic
5. The JSON schema used for runtime state

Prioritize simplicity and clarity. Remove anything unnecessary.