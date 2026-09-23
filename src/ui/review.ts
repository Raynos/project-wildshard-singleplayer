// src/ui/review.ts — the review inbox's always-loaded half (project/archive/2026-09-22-feedback-inbox.md): the Settings REVIEW unlock, the
// Quick note switch, and sending a note (with an offline queue). The composer itself (quick bar, sheet, pen) is the lazy
// src/ui/Feedback.ts; the server is api/inbox.ts; notes come down with `pnpm inbox:pull`.
//
//   await unlockReview(pw)   → 'ok' | 'bad' | 'offline'    (POST { check: true }; a good password is remembered)
//   reviewUnlocked() / lockReview() / quickNote() / setQuickNote(on) / onReview(fn)   → the Settings REVIEW row + FEEDBACK tab
//   await sendNote({ note, category, context, screenshot })   → { id } | 'queued' | 'locked'
//   queuedCount() / flushQueue()   → a failed send waits in localStorage and retries on `online` and on the next send
//
// There is no query string: the feature ships to everyone and stays hidden until a reviewer types the password in Settings.
export type Category = 'bug' | 'art' | 'feel' | 'perf' | 'idea';
export const CATEGORIES: readonly Category[] = ['bug', 'art', 'feel', 'perf', 'idea'];
export type ContextValue = string | number | boolean | number[];
export interface NotePayload { note: string; category: Category; context: Record<string, ContextValue>; screenshot: string | null }
export interface StorageLike { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void }

const KEY = 'ws.review.v1';
const QUEUE_KEY = 'ws.review.queue.v1';
/** a queued note carries a ≤ 300 KB screenshot; localStorage holds ~5 MB, shared with the saves */
export const QUEUE_MAX = 6;
/** the native shells (Capacitor) have no same-origin /api: they post to production (CORS in api/inbox.ts) */
export const INBOX_URL = import.meta.env.MODE === 'native' ? 'https://wildshard-singleplayer.vercel.app/api/inbox' : '/api/inbox';

interface ReviewState { password: string | null; quick: boolean }

const storage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function loadState(s: StorageLike | null = storage()): ReviewState {
  try {
    const raw = s?.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Record<string, unknown>>;
      return { password: typeof v['password'] === 'string' && v['password'] ? v['password'] : null, quick: v['quick'] !== false };
    }
  } catch { /* private mode / bad JSON: locked */ }
  return { password: null, quick: true };
}

const state = loadState();
const listeners = new Set<() => void>();
function save(): void {
  try { storage()?.setItem(KEY, JSON.stringify(state)); } catch { /* not remembered this session */ }
  for (const fn of listeners) fn();
}

export function reviewUnlocked(): boolean { return state.password !== null; }
export function quickNote(): boolean { return state.password !== null && state.quick; }
export function setQuickNote(on: boolean): void { if (state.quick !== on) { state.quick = on; save(); } }
export function lockReview(): void { state.password = null; save(); }
/** fires on unlock / lock / the Quick note switch / the queue changing; returns an unsubscribe */
export function onReview(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

function post(body: Record<string, unknown>): Promise<Response> {
  return fetch(INBOX_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function unlockReview(password: string): Promise<'ok' | 'bad' | 'offline'> {
  const pw = password.trim();
  if (!pw) return 'bad';
  try {
    const res = await post({ password: pw, check: true });
    if (res.status === 401) return 'bad';
    if (!res.ok) return 'offline';
  } catch { return 'offline'; }
  state.password = pw;
  save();
  return 'ok';
}

// ── the offline queue ──
export function readQueue(s: StorageLike | null = storage()): NotePayload[] {
  try {
    const raw = s?.getItem(QUEUE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as NotePayload[]) : [];
  } catch { return []; }
}
/** keeps the newest QUEUE_MAX; when storage is full the screenshots go first, the words stay */
export function writeQueue(q: readonly NotePayload[], s: StorageLike | null = storage()): void {
  const kept = q.slice(-QUEUE_MAX);
  try {
    if (kept.length === 0) s?.removeItem(QUEUE_KEY); else s?.setItem(QUEUE_KEY, JSON.stringify(kept));
  } catch {
    try { s?.setItem(QUEUE_KEY, JSON.stringify(kept.map((n) => ({ note: n.note, category: n.category, context: n.context, screenshot: null })))); } catch { /* storage off: the note is lost */ }
  }
}
export function queuedCount(): number { return readQueue().length; }

/** 'sent' with the id, 'bad' = the password stopped working (locked again), 'retry' = offline / server trouble */
async function deliver(n: NotePayload, password: string): Promise<{ id: string } | 'bad' | 'retry'> {
  try {
    const res = await post({ password, ...n });
    if (res.status === 401) return 'bad';
    if (!res.ok) return 'retry';
    const body = (await res.json()) as { id?: unknown };
    return { id: typeof body.id === 'string' ? body.id : '' };
  } catch { return 'retry'; }
}

let flushing = false;
/** sends what is queued, oldest first; stops at the first failure. Returns how many went out. */
export async function flushQueue(): Promise<number> {
  const pw = state.password;
  if (flushing || pw === null) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (let q = readQueue(); q.length > 0; q = readQueue()) {
      const [head] = q;
      if (!head) break;
      const r = await deliver(head, pw);
      if (r === 'retry') break;
      if (r === 'bad') { lockReview(); break; }
      writeQueue(q.slice(1));
      sent++;
    }
  } finally { flushing = false; }
  if (sent > 0) for (const fn of listeners) fn();
  return sent;
}

export async function sendNote(n: NotePayload): Promise<{ id: string } | 'queued' | 'locked'> {
  const pw = state.password;
  if (pw === null) return 'locked';
  void flushQueue();
  const r = await deliver(n, pw);
  if (r === 'bad') { lockReview(); return 'locked'; }
  if (r === 'retry') { writeQueue([...readQueue(), n]); for (const fn of listeners) fn(); return 'queued'; }
  return r;
}

if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushQueue(); });
