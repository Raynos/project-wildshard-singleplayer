/**
 * Expected step durations for the SETUP track (docs/plans/LOAD-PERF.md, job 2 "continuous bar").
 *
 * The bar's setup fraction is time-weighted: each step counts for its *expected* wall ms — the
 * previous run's measurement on this device and tier (an EMA in localStorage), falling back to
 * the step table's weight scaled by what the recorded steps cost per weight unit, and on the very
 * first run to `weight × FIRST_RUN_MS_PER_WEIGHT`. A running step's fraction is elapsed / expected,
 * capped below 1 — so the bar moves every frame at the rate the last run predicts, and a step that
 * turns out slower stalls just short of its share instead of lying past it.
 */
import { TIER } from '../core/tier';
import { BOOT_STEPS, STEP_INFO, type BootStep } from './steps';

const KEY = `ws-load-times:v1:${TIER}:${typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 0 : 0}`;
const FIRST_RUN_MS_PER_WEIGHT = 300;
const EMA = 0.5;

export type Timings = Partial<Record<BootStep, number>>;

export function loadTimings(): Timings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Timings = {};
    for (const k of BOOT_STEPS) { const v = obj[k]; if (typeof v === 'number' && v > 0 && Number.isFinite(v)) out[k] = v; }
    return out;
  } catch { return {}; }
}

/** Blend this run's per-step ms into the stored expectation. */
export function saveTimings(measured: Timings): void {
  try {
    const prev = loadTimings();
    const next: Timings = {};
    for (const k of BOOT_STEPS) {
      const m = measured[k];
      if (!(typeof m === 'number' && m >= 0 && Number.isFinite(m))) continue;
      const p = prev[k];
      next[k] = p === undefined ? m : p * (1 - EMA) + m * EMA;
    }
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* private mode, quota: the next run just falls back to weights */ }
}

/** Expected ms per step: recorded where known, else weight-scaled from what is known. Always > 0. */
export function expectedDurations(recorded: Timings = loadTimings()): Record<BootStep, number> {
  let knownMs = 0, knownWeight = 0;
  for (const k of BOOT_STEPS) { const v = recorded[k]; if (v !== undefined) { knownMs += v; knownWeight += STEP_INFO[k].weight; } }
  const perWeight = knownWeight > 0 ? knownMs / knownWeight : FIRST_RUN_MS_PER_WEIGHT;
  const out = {} as Record<BootStep, number>;
  for (const k of BOOT_STEPS) out[k] = Math.max(1, recorded[k] ?? STEP_INFO[k].weight * perWeight);
  return out;
}
