// Native and legacy brains expose their current diagnostic state here.
import { pinBrain as legacyPinBrain, brainPinned as legacyBrainPinned } from './pinning';
import type { Scope } from '../app/scope';
import type { UtilityScore } from './strikes';

export interface BrainInspection { state: string; picks: readonly UtilityScore[]; brainHz: number; pinned: boolean }
const brains = new WeakMap<object, () => BrainInspection>();
export function pinBrain(actor: object, scope?: Scope): void { legacyPinBrain(actor, scope); }
export function inspectBrain(actor: object, read: () => BrainInspection): void { brains.set(actor, read); }
export function brainInspection(actor: object, fallback: string): BrainInspection {
  const info = brains.get(actor)?.() ?? { state: fallback, picks: [], brainHz: 10, pinned: false };
  return legacyBrainPinned(actor) ? { ...info, pinned: true } : info;
}
