import type { UtilityScore } from './strikes';

export interface BrainInspection { state: string; picks: readonly UtilityScore[]; brainHz: number; pinned: boolean }
const brains = new WeakMap<object, () => BrainInspection>();
const pinned = new WeakSet();
const ticks = new WeakMap<object, () => Pick<BrainInspection, 'brainHz' | 'pinned'>>();
export function pinBrain(actor: object): void { pinned.add(actor); }
export function brainPinned(actor: object): boolean { return pinned.has(actor); }
export function inspectTick(actor: object, read: () => Pick<BrainInspection, 'brainHz' | 'pinned'>): void { ticks.set(actor, read); }
export function inspectBrain(actor: object, read: () => BrainInspection): void { brains.set(actor, read); }
export function brainInspection(actor: object, fallback: string): BrainInspection {
  const info = brains.get(actor)?.() ?? { state: fallback, picks: [], brainHz: 10, pinned: false };
  const rate = ticks.get(actor)?.();
  const result = rate ? { ...info, ...rate } : info;
  return pinned.has(actor) ? { ...result, pinned: true } : result;
}
