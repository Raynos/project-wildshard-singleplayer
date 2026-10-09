import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackContext } from '@wildshard/engine/ai/pack';
import type { HerdContext } from '@wildshard/engine/ai/herd';
import { MathUtils } from 'three';
import { Pack, HorseHerd, fallbackGroupHost, type PackController, type HerdController } from './groupRegistry';
import { declaredGroupFactories, memberGroupIdentity } from './groupDeclared';

/** Fallback spawns retain the shipping ordered roster and averaged den, using the declared policy. */
export function packForThink(actor: Animal, context: ThinkCtx): PackController | null {
  const pack = Pack.of(actor); if (pack !== null) return pack;
  if (context.herd === null) return null;
  const wolves = context.herd.filter(member => member.kind === 'wolf');
  if (wolves.length === 0) return null;
  let x = 0, z = 0;
  for (const wolf of wolves) { x += wolf.position.x; z += wolf.position.z; }
  return declaredGroupFactories(memberGroupIdentity(context.herd), fallbackGroupHost()).pack(wolves, x / wolves.length, z / wolves.length);
}
/** Unregistered wild horses use the declared policy; owned/taming bodies stay native. */
export function herdForThink(actor: Animal, context: ThinkCtx): HerdController | null {
  const herd = HorseHerd.of(actor); if (herd !== null) return herd;
  if (context.herd === null) return null;
  const horses = context.herd.filter(member => member.kind === 'horse');
  return horses.length === 0 ? null : declaredGroupFactories(memberGroupIdentity(context.herd), fallbackGroupHost()).herd(horses);
}
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
export function thinkWolf(a: Animal, c: ThinkCtx): void { decideWolf(a, c, packForThink(a, c)); }
export function actWolf(a: Animal, c: ThinkCtx): void { actWolfBody(a, c, packForThink(a, c)); }
export function thinkHorse(a: Animal, c: ThinkCtx): void {
  if (horseHeld(a)) return;
  decideHorse(a, c, herdForThink(a, c));
}
export function actHorse(a: Animal, c: ThinkCtx): void { actHorseBody(a, c, herdForThink(a, c)); }
/** Native damage recipe retains the shipping HP floors for owned horses and stallions. */
export function horseDamageMul(a: Animal): number {
  const f = a.hp / a.maxHp;
  if ((a.mem['owned'] ?? 0) === 1) return MathUtils.clamp((f - 0.1) / 0.9, 0, 1);
  if (a.variant !== 'stallion') return 1;
  return MathUtils.clamp((f - 0.2) / 0.8, 0, 1);
}
