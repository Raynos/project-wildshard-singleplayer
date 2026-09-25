/**
 * Fault isolation (E133, audit fix 5 / FINISH-LINE S2): one system that throws must not freeze the whole game.
 *
 * Game.ts wraps every registered system (input, each fixed phase, update, late) in a `GameSystem` and calls it inside
 * one try/catch. A throw lands in `recordFault`, which decides:
 *
 *   'retry'  — log it (the first time, with its stack), report it, run the system again next frame
 *   'off'    — it threw FAULT_STREAK frames in a row, or FAULT_BURST times inside FAULT_WINDOW_MS: switch that one
 *              system off; everything else keeps running and the frame keeps rendering
 *   'fatal'  — the same trip on a CORE system (the render, the sky, the physics step, the player's step): the game
 *              cannot go on without it, so the loop stops and the fatal modal goes up (src/ui/ErrorModal.ts)
 *
 * Nothing here allocates while nothing throws: the per-system counters are plain numbers, and the burst ring is only
 * created on a system's first fault. Listeners (the reporter and the modal) hear every fault through `onFault`.
 *
 * The GAME-NORMALIZATION plan's SystemRegistry (`add({ id, phase, run })`) slots over this unchanged: its `id` is
 * this `label`, and each phase list becomes a list of `GameSystem`s.
 */

/** frames in a row that throw before a system is switched off */
export const FAULT_STREAK = 3;
/** throws inside FAULT_WINDOW_MS before a system is switched off, frames in a row or not */
export const FAULT_BURST = 5;
export const FAULT_WINDOW_MS = 10_000;

export type FaultVerdict = 'retry' | 'off' | 'fatal';

export interface GameSystem<F> {
  readonly fn: F;
  /** what a report calls it: the registration's label, else the function's name, else `<phase>#<n>` */
  readonly label: string;
  /** the game cannot run without it: tripping it is fatal instead of switching it off */
  readonly core: boolean;
  /** false once switched off */
  on: boolean;
  /** every throw, ever */
  faults: number;
  /** frames in a row that threw (a frame that throws in several fixed steps counts once) */
  streak: number;
  /** the frame number of the last throw (-1: never) */
  lastFrame: number;
  /** the times of the last FAULT_BURST throws (a ring; null until the first) */
  recent: Float64Array | null;
}

export function makeSystem<F>(fn: F, label: string | undefined, core: boolean, fallback: string): GameSystem<F> {
  const named = typeof fn === 'function' && typeof fn.name === 'string' && fn.name !== '' && fn.name !== 'anonymous' ? fn.name : '';
  return { fn, label: label ?? (named || fallback), core, on: true, faults: 0, streak: 0, lastFrame: -1, recent: null };
}

/**
 * Count one throw of `s` during frame `frame` at time `now` (ms), and say what happens to it. A 'off' / 'fatal' verdict
 * switches the system off here; the caller only reports and (fatal) stops the loop.
 */
export function recordFault(s: GameSystem<unknown>, frame: number, now: number): FaultVerdict {
  if (frame !== s.lastFrame) s.streak = frame === s.lastFrame + 1 ? s.streak + 1 : 1;
  s.lastFrame = frame;
  s.recent ??= new Float64Array(FAULT_BURST).fill(Number.NEGATIVE_INFINITY);
  const ring = s.recent;
  ring[s.faults % FAULT_BURST] = now;
  s.faults++;
  // the oldest of the last FAULT_BURST throws: all of them inside the window → a burst
  const oldest = ring[s.faults % FAULT_BURST] ?? Number.NEGATIVE_INFINITY;
  const burst = s.faults >= FAULT_BURST && now - oldest <= FAULT_WINDOW_MS;
  if (s.streak < FAULT_STREAK && !burst) return 'retry';
  s.on = false;
  return s.core ? 'fatal' : 'off';
}

// ── the hub: the loop's state and every fault, for the reporter (src/core/errorReport.ts) and the modal ──

/** 'boot': the world is still loading · 'running': the frame loop draws · 'dead': a core system died, the loop stopped */
export type LoopState = 'boot' | 'running' | 'dead';
let loop: LoopState = 'boot';
export function loopState(): LoopState { return loop; }
export function setLoopState(s: LoopState): void { loop = s; }

export interface Fault {
  /** the system's label ('window' for window.onerror / unhandledrejection, 'boot' for main().catch) */
  system: string;
  error: unknown;
  /** retry / off / fatal for a loop system; 'uncaught' for a window error or rejection, 'fatal' for main().catch */
  verdict: FaultVerdict | 'uncaught';
}
type Listener = (f: Fault) => void;
const listeners = new Set<Listener>();
/** hear every fault; returns an unsubscribe */
export function onFault(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitFault(f: Fault): void {
  for (const fn of listeners) {
    try { fn(f); } catch (e) { console.error('[faults] a fault listener threw', e); } // a listener must never throw back into the loop
  }
}

/** Game.ts's catch: count it, log it once, tell the listeners. Returns the verdict (the loop stops on 'fatal'). */
export function systemFault(s: GameSystem<unknown>, error: unknown, frame: number, now: number): FaultVerdict {
  const verdict = recordFault(s, frame, now);
  if (s.faults === 1) console.error(`[faults] system "${s.label}" threw:`, error);
  if (verdict === 'off') console.warn(`[faults] system "${s.label}" switched off after ${s.faults} throws; the game keeps running without it`);
  if (verdict === 'fatal') console.error(`[faults] core system "${s.label}" failed ${s.faults} times: the frame loop stops`);
  emitFault({ system: s.label, error, verdict });
  return verdict;
}

/** an error already described as text (main().catch hands the modal strings): reported as-is */
export class DescribedError {
  constructor(readonly message: string, readonly stack: string) {}
}

/** `{ message, stack }` of anything thrown */
export function describeError(reason: unknown): { message: string; stack: string } {
  if (reason instanceof DescribedError) return { message: reason.message, stack: reason.stack };
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, stack: reason.stack ?? '' };
  if (typeof reason === 'object' && reason !== null) { try { return { message: JSON.stringify(reason).slice(0, 400), stack: '' }; } catch { /* fall through */ } }
  return { message: String(reason), stack: '' };
}
