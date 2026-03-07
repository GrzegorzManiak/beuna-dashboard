import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AppState, ThreadState, SeedData, SeedEmail } from "../../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "../../state.json");
const TASK_PATH = join(__dirname, "../../TASK.json");

// ── Load seed data ───────────────────────────────────────────────────
let _seedData: SeedData | null = null;

export function getSeedData(): SeedData {
  if (!_seedData) {
    _seedData = JSON.parse(readFileSync(TASK_PATH, "utf-8")) as SeedData;
  }
  return _seedData;
}

// ── Group emails by thread ───────────────────────────────────────────
export function getEmailsByThread(): Map<string, SeedEmail[]> {
  const seed = getSeedData();
  const map = new Map<string, SeedEmail[]>();
  for (const email of seed.emails) {
    const existing = map.get(email.thread_id) ?? [];
    existing.push(email);
    map.set(email.thread_id, existing);
  }
  // Sort each thread by position
  for (const [, emails] of map) {
    emails.sort((a, b) => a.thread_position - b.thread_position);
  }
  return map;
}

// ── Property lookup ──────────────────────────────────────────────────
export function getPropertyName(propertyId: string | undefined): string {
  if (!propertyId) return "Unknown";
  const seed = getSeedData();
  const prop = seed.metadata.properties.find((p) => p.id === propertyId);
  return prop?.name ?? "Unknown";
}

// ── State management ─────────────────────────────────────────────────
let _state: AppState | null = null;

export function loadState(): AppState {
  if (_state) return _state;

  if (existsSync(STATE_PATH)) {
    _state = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as AppState;
  } else {
    _state = { threads: {}, last_updated: new Date().toISOString() };
    // Initialize thread states for all threads
    const threadMap = getEmailsByThread();
    for (const threadId of threadMap.keys()) {
      _state.threads[threadId] = createDefaultThreadState(threadId);
    }
    saveState();
  }
  return _state;
}

export function saveState(): void {
  if (!_state) return;
  _state.last_updated = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(_state, null, 2));
}

export function getThreadState(threadId: string): ThreadState {
  const state = loadState();
  if (!state.threads[threadId]) {
    state.threads[threadId] = createDefaultThreadState(threadId);
    saveState();
  }
  return state.threads[threadId]!;
}

export function updateThreadState(
  threadId: string,
  updater: (state: ThreadState) => void
): ThreadState {
  const state = loadState();
  if (!state.threads[threadId]) {
    state.threads[threadId] = createDefaultThreadState(threadId);
  }
  updater(state.threads[threadId]!);
  saveState();
  return state.threads[threadId]!;
}

function createDefaultThreadState(threadId: string): ThreadState {
  return {
    thread_id: threadId,
    status: "pending",
    extraction: null,
    actions: [],
    human_notes: "",
  };
}

export function resetState(): void {
  _state = { threads: {}, last_updated: new Date().toISOString() };
  const threadMap = getEmailsByThread();
  for (const threadId of threadMap.keys()) {
    _state.threads[threadId] = createDefaultThreadState(threadId);
  }
  saveState();
}
