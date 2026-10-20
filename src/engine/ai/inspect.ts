// only *-legacy imports this; deleted with the legacy copies (SHARD-PLATFORM-NEXT N5)
import { pinBrain as legacyPinBrain, brainPinned as legacyBrainPinned } from './pinning';
import type { Scope } from '../app/scope';
import type { UtilityScore } from './strikes';

export interface BrainInspection { state: string; picks: readonly UtilityScore[]; brainHz: number; pinned: boolean }
const brains = new WeakMap<object, () => BrainInspection>();
const ticks = new WeakMap<object, () => Pick<BrainInspection, 'brainHz' | 'pinned'>>();
export function pinBrain(actor: object, scope?: Scope): void { legacyPinBrain(actor, scope); }
export function brainPinned(actor: object): boolean { return legacyBrainPinned(actor); }
export function inspectTick(actor: object, read: () => Pick<BrainInspection, 'brainHz' | 'pinned'>): void { ticks.set(actor, read); }
export function inspectBrain(actor: object, read: () => BrainInspection): void { brains.set(actor, read); }
export function brainInspection(actor: object, fallback: string): BrainInspection {
  const info = brains.get(actor)?.() ?? { state: fallback, picks: [], brainHz: 10, pinned: false };
  const rate = ticks.get(actor)?.();
  const result = rate ? { ...info, ...rate } : info;
  return legacyBrainPinned(actor) ? { ...result, pinned: true } : result;
}
