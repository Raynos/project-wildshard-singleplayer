/** A small durable breadcrumb for Nine Dragon's phone boot. A terminated WebContent process cannot run a final handler. */
import { captureBrowserError } from '../telemetry/browserErrors';
import type { ProgressView } from './plan';

declare const __BUILD_ID__: string;

const KEY = 'ws.nineBoot';
const RECENT_MS = 5 * 60_000;
type Status = 'in_progress' | 'ready' | 'planned' | 'handled_error' | 'context_lost' | 'pagehide';

interface Record {
  id: string;
  build: string;
  startedAt: number;
  updatedAt: number;
  stage: string;
  setup: number;
  download: number;
  visibility: string;
  status: Status;
}

let current: Record | null = null;
let previousLine = '';

function storage(): Storage | null { try { return localStorage; } catch { return null; } }
function read(key: string): Record | null {
  try {
    const value: unknown = JSON.parse(storage()?.getItem(key) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const o = value as Partial<Record>;
    if (typeof o.id !== 'string' || typeof o.build !== 'string' || typeof o.startedAt !== 'number' ||
      typeof o.updatedAt !== 'number' || typeof o.stage !== 'string' || typeof o.setup !== 'number' ||
      typeof o.download !== 'number' || typeof o.visibility !== 'string' || typeof o.status !== 'string') return null;
    return o as Record;
  } catch { return null; }
}
function write(key: string, value: Record): void { try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ } }
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
  const line = `Abrupt previous page: Nine Dragon ${stage} ${prior.setup}% setup / ${prior.download}% download (cause unknown)`;
  previousLine = line;
  // Consume before the asynchronous SDK import. A second restart cannot report this run twice.
  try { storage()?.removeItem(KEY); } catch { /* duplicate reporting is possible if storage is denied */ }
  captureBrowserError(new Error(`${line}; previous build ${prior.build}; visibility ${prior.visibility}`), {
    system: 'boot-abrupt', build: prior.build, shard: 'nine-dragon-stack', bootStage: prior.stage, fatal: false,
  });
}

/** Shown in the loader and the Loading & memory Debug row after a restart. */
export function previousNineBootLine(): string {
  return previousLine;
}

/** Persist only stage changes and coarse first-frame progress, never every boot-plan paint. */
export function recordNineBootProgress(view: ProgressView): void {
  if (current === null) return;
  if (current.status !== 'in_progress') return;
  const stage = view.done ? 'boot plan complete' : view.step;
  const setup = Math.floor(view.setup * 100);
  const download = Math.floor(view.download * 100);
  const firstFrameCheckpoint = stage === 'firstFrame' && Math.floor(setup / 5) > Math.floor(current.setup / 5);
  if (stage === current.stage && !firstFrameCheckpoint && !view.error) return;
  current = { ...current, stage, setup, download, updatedAt: Date.now(), visibility: document.visibilityState };
  write(KEY, current);
  if (view.error) update('handled_error');
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
