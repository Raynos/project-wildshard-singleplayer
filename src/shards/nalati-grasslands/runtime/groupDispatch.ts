import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackContext } from '@wildshard/engine/ai/pack';
import type { HerdContext } from '@wildshard/engine/ai/herd';

/** A pack's decision and steer for one member, as its policy runs on the page and in a renderer-free host (SF72). */
export interface PackMemberPolicy<A extends AnimalSim> { tick: (c: PackContext<A>) => void; drive: (a: A, c: PackContext<A>, body?: boolean) => void }
/** A herd's decision and steer for one member, as its policy runs on the page and in a renderer-free host (SF72). */
export interface HerdMemberPolicy<A extends AnimalSim> { tick: (c: HerdContext<A>) => void; drive: (a: A, c: HerdContext<A>, body?: boolean) => void }
interface Confines<A extends AnimalSim> { confine: (a: A) => void }
/** A wolf's decision (its brain step): it stands without a pack or once dead, else the pack's tick, its steer, the confine. */
export function decideWolf<A extends AnimalSim>(a: A, c: PackContext<A> & Confines<A>, p: PackMemberPolicy<A> | null): void {
  if (p === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  p.tick(c); p.drive(a, c); c.confine(a);
}
/** A wolf's body step before it moves (its `act`): a committed lunge steers on the body clock. */
export function actWolfBody<A extends AnimalSim>(a: A, c: PackContext<A> & Confines<A>, p: PackMemberPolicy<A> | null): void {
  if (p === null || !a.alive) return;
  p.drive(a, c, true); c.confine(a);
}
/** A horse no herd decides for: ridden, or owned (the camp's saddled horses, the shepherd's). */
export function horseHeld(a: AnimalSim): boolean { return (a.mem['ridden'] ?? 0) === 1 || (a.mem['owned'] ?? 0) === 1; }
/** A free horse's decision (its brain step): it stands without a herd or once dead, else the herd's tick and steer. */
export function decideHorse<A extends AnimalSim>(a: A, c: HerdContext<A>, h: HerdMemberPolicy<A> | null): void {
  if (h === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  h.tick(c); h.drive(a, c);
}
/** A horse's body step before it moves (its `act`): the stallion's committed charge steers on the body clock. */
export function actHorseBody<A extends AnimalSim>(a: A, c: HerdContext<A>, h: HerdMemberPolicy<A> | null): void {
  if (h === null || !a.alive) return;
  h.drive(a, c, true);
}
