import type { UtilityScore } from './strikes';

export interface BrainInspection { state: string; picks: readonly UtilityScore[]; brainHz: number; pinned: boolean }
const brains = new WeakMap<object, () => BrainInspection>();
const pinned = new WeakSet();
export function pinBrain(actor: object): void { pinned.add(actor); }
export function inspectBrain(actor: object, read: () => BrainInspection): void { brains.set(actor, read); }
export function brainInspection(actor: object, fallback: string): BrainInspection {
  const info = brains.get(actor)?.() ?? { state: fallback, picks: [], brainHz: 10, pinned: false };
  return pinned.has(actor) ? { ...info, pinned: true } : info;
}
