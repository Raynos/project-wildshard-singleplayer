import type { Scope } from '../app/scope';
import type { UtilityScore } from './strikes';

export interface BrainInspection { state: string; picks: readonly UtilityScore[]; brainHz: number; pinned: boolean }
const brains = new WeakMap<object, () => BrainInspection>();
const pinned = new WeakMap<object, number>();
const ticks = new WeakMap<object, () => Pick<BrainInspection, 'brainHz' | 'pinned'>>();
export function pinBrain(actor: object, scope?: Scope): void {
  if (scope?.disposed === true) return;
  pinned.set(actor, (pinned.get(actor) ?? 0) + 1);
  scope?.onDispose(() => {
    const count = (pinned.get(actor) ?? 1) - 1;
    if (count === 0) pinned.delete(actor); else pinned.set(actor, count);
  });
}
export function brainPinned(actor: object): boolean { return pinned.has(actor); }
export function inspectTick(actor: object, read: () => Pick<BrainInspection, 'brainHz' | 'pinned'>): void { ticks.set(actor, read); }
export function inspectBrain(actor: object, read: () => BrainInspection): void { brains.set(actor, read); }
export function brainInspection(actor: object, fallback: string): BrainInspection {
  const info = brains.get(actor)?.() ?? { state: fallback, picks: [], brainHz: 10, pinned: false };
  const rate = ticks.get(actor)?.();
  const result = rate ? { ...info, ...rate } : info;
  return pinned.has(actor) ? { ...result, pinned: true } : result;
}
