/** A small durable breadcrumb for Nine Dragon's phone boot. A terminated WebContent process cannot run a final handler. */
import { captureBrowserError } from '../telemetry/browserErrors';
import { reportBootInterruption } from '../telemetry/bootInbox';
import type { ProgressView } from './plan';

declare const __BUILD_ID__: string;

const KEY = 'ws.nineBoot';
const RECENT_MS = 5 * 60_000;
const HISTORY_LIMIT = 32;
type Status = 'in_progress' | 'ready' | 'planned' | 'handled_error' | 'context_lost' | 'pagehide';
type Facts = Record<string, string | number | boolean | null>;
interface Checkpoint { atMs: number; operation: string; facts: Facts }

interface BootRecord {
  id: string;
  build: string;
  startedAt: number;
  updatedAt: number;
  stage: string;
  setup: number;
  download: number;
  visibility: string;
  status: Status;
  detail?: string;
  checkpoints?: Checkpoint[];
}

let current: BootRecord | null = null;
let previousLine = '';

function storage(): Storage | null { try { return localStorage; } catch { return null; } }
function read(key: string): BootRecord | null {
  try {
    const value: unknown = JSON.parse(storage()?.getItem(key) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const o = value as Partial<BootRecord>;
    if (typeof o.id !== 'string' || typeof o.build !== 'string' || typeof o.startedAt !== 'number' ||
      typeof o.updatedAt !== 'number' || typeof o.stage !== 'string' || typeof o.setup !== 'number' ||
      typeof o.download !== 'number' || typeof o.visibility !== 'string' || typeof o.status !== 'string') return null;
    // Older builds have neither detail nor checkpoints. Ignore malformed optional evidence.
    return { ...o as BootRecord, detail: typeof o.detail === 'string' ? o.detail.slice(0, 200) : '',
      checkpoints: Array.isArray(o.checkpoints) ? o.checkpoints.filter(validCheckpoint).slice(-HISTORY_LIMIT) : [] };
  } catch { return null; }
}
function validCheckpoint(value: unknown): value is Checkpoint {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<Checkpoint>;
  const facts: unknown = c.facts;
  return typeof c.atMs === 'number' && Number.isFinite(c.atMs) && typeof c.operation === 'string' &&
    typeof facts === 'object' && facts !== null && !Array.isArray(facts) &&
    Object.values(facts).every((v: unknown) => v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)));
}
function write(key: string, value: BootRecord): void { try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ } }
function update(status: Status): void {
  if (current?.status !== 'in_progress') return;
  current = { ...current, status, stage: status === 'ready' ? 'world ready' : current.stage, updatedAt: Date.now(), visibility: document.visibilityState };
  write(KEY, current);
}

/** Called by lastEnd on every new document, before its own boot can replace the old record. */
export function inspectPreviousNineBoot(): void {
  const prior = read(KEY);
  if (prior?.status !== 'in_progress') return;
  const age = Date.now() - prior.updatedAt;
  if (age < 0 || age > RECENT_MS) return;
  const stage = prior.stage.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const checkpoints = prior.checkpoints ?? [];
  const last = checkpoints.at(-1)?.operation ?? prior.detail ?? '';
  const line = `Abrupt previous page: Nine Dragon ${stage} ${prior.setup}% setup / ${prior.download}% download${last ? ` at ${last}` : ''} (cause unknown)`;
  previousLine = line;
  // Consume before the asynchronous SDK import. A second restart cannot report this run twice.
  try { storage()?.removeItem(KEY); } catch { /* duplicate reporting is possible if storage is denied */ }
  const error = new Error(`${line}; previous build ${prior.build}; visibility ${prior.visibility}`);
  const diagnostic = { previousBuild: prior.build, attempt: prior.id, detail: prior.detail ?? '', elapsedMs: prior.updatedAt - prior.startedAt, visibility: prior.visibility, checkpoints };
  reportBootInterruption(error, prior.build, JSON.stringify({ ...diagnostic, checkpoints: checkpoints.slice(-8) }));
  captureBrowserError(error, {
    system: 'boot-abrupt', build: prior.build, shard: 'nine-dragon-stack', bootStage: prior.stage, fatal: false,
    diagnostic,
  });
}

/** Shown in the loader and the Loading & memory Debug row after a restart. */
export function previousNineBootLine(): string {
  return previousLine;
}

/** The same bounded evidence also accompanies handled errors through the working first-party inbox. */
export function nineBootDiagnostic(): Record<string, unknown> {
  if (current === null) return {};
  return { attempt: current.id, previousBuild: current.build, stage: current.stage, detail: current.detail ?? '',
    elapsedMs: current.updatedAt - current.startedAt, status: current.status, checkpoints: current.checkpoints ?? [] };
}

/** Keep the server's 16 KiB request budget: newest operations matter most for a handled failure. */
export function nineBootDiagnosticJson(): string {
  if (current === null) return '';
  return JSON.stringify({ ...nineBootDiagnostic(), checkpoints: (current.checkpoints ?? []).slice(-8) });
}

/** Persist only stage changes and coarse first-frame progress, never every boot-plan paint. */
export function recordNineBootProgress(view: ProgressView): void {
  if (current === null) return;
  if (current.status !== 'in_progress') return;
  const stage = view.done ? 'boot plan complete' : view.step;
  const setup = Math.floor(view.setup * 100);
  const download = Math.floor(view.download * 100);
  const firstFrameCheckpoint = stage === 'firstFrame' && Math.floor(setup / 5) > Math.floor(current.setup / 5);
  const detail = view.detail.slice(0, 200);
  if (stage === current.stage && detail === current.detail && !firstFrameCheckpoint && !view.error) return;
  current = { ...current, stage, detail, setup, download, updatedAt: Date.now(), visibility: document.visibilityState };
  write(KEY, current);
  if (view.error) update('handled_error');
}

/** Synchronous, bounded evidence written BEFORE risky GPU work, surviving a process termination. */
export function recordNineBootCheckpoint(operation: string, facts: Facts = {}): void {
  if (current?.status !== 'in_progress') return;
  const now = Date.now();
  const checkpoint: Checkpoint = { atMs: now - current.startedAt, operation, facts };
  current = { ...current, updatedAt: now, checkpoints: [...(current.checkpoints ?? []), checkpoint].slice(-HISTORY_LIMIT) };
  write(KEY, current);
}

/** Begin once the Nine Dragon loader exists; the root title has no boot in progress. */
export function startNineBoot(): void {
  const now = Date.now();
  current = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, build: __BUILD_ID__, startedAt: now,
    updatedAt: now, stage: 'loader', setup: 0, download: 0, visibility: document.visibilityState, status: 'in_progress',
  };
  write(KEY, current);
  document.addEventListener('ws:ready', () => { update('ready'); }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (current?.status !== 'in_progress' && !(current?.status === 'pagehide' && document.visibilityState === 'visible')) return;
    current = { ...current, status: 'in_progress', updatedAt: Date.now(), visibility: document.visibilityState };
    write(KEY, current);
  });
  window.addEventListener('pagehide', () => { update('pagehide'); });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || current?.status !== 'pagehide') return;
    current = { ...current, status: 'in_progress', updatedAt: Date.now(), visibility: document.visibilityState };
    write(KEY, current);
  });
}

export function markNineBootPlanned(): void { update('planned'); }
export function markNineBootHandledError(): void { update('handled_error'); }
export function markNineBootContextLost(): void { update('context_lost'); }
