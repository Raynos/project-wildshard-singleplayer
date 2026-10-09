import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { MathUtils } from 'three';
import { Pack, HorseHerd, type PackController, type HerdController } from './groupRegistry';
import { declaredGroupFactories, memberGroupIdentity } from './groupDeclared';
import { APP_GROUP_HOST } from './groupHost';

/** Fallback spawns retain the shipping ordered roster and averaged den, using the declared policy. */
export function packForThink(actor: Animal, context: ThinkCtx): PackController | null {
  const pack = Pack.of(actor); if (pack !== null) return pack;
  if (context.herd === null) return null;
  const wolves = context.herd.filter(member => member.kind === 'wolf');
  if (wolves.length === 0) return null;
  let x = 0, z = 0;
  for (const wolf of wolves) { x += wolf.position.x; z += wolf.position.z; }
  return declaredGroupFactories(memberGroupIdentity(context.herd), APP_GROUP_HOST).pack(wolves, x / wolves.length, z / wolves.length);
}
/** Unregistered wild horses use the declared policy; owned/taming bodies stay native. */
export function herdForThink(actor: Animal, context: ThinkCtx): HerdController | null {
  const herd = HorseHerd.of(actor); if (herd !== null) return herd;
  if (context.herd === null) return null;
  const horses = context.herd.filter(member => member.kind === 'horse');
  return horses.length === 0 ? null : declaredGroupFactories(memberGroupIdentity(context.herd), APP_GROUP_HOST).herd(horses);
}
export function thinkWolf(a: Animal, c: ThinkCtx): void {
  const p = packForThink(a, c);
  if (p === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  p.tick(c); p.drive(a, c); c.confine(a);
}
export function actWolf(a: Animal, c: ThinkCtx): void {
  const p = packForThink(a, c); if (p === null || !a.alive) return;
  p.drive(a, c, true); c.confine(a);
}
export function thinkHorse(a: Animal, c: ThinkCtx): void {
  if ((a.mem['ridden'] ?? 0) === 1 || (a.mem['owned'] ?? 0) === 1) return;
  const h = herdForThink(a, c);
  if (h === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  h.tick(c); h.drive(a, c);
}
export function actHorse(a: Animal, c: ThinkCtx): void {
  const herd = herdForThink(a, c); if (herd === null || !a.alive) return;
  herd.drive(a, c, true);
}
/** Native damage recipe retains the shipping HP floors for owned horses and stallions. */
export function horseDamageMul(a: Animal): number {
  const f = a.hp / a.maxHp;
  if ((a.mem['owned'] ?? 0) === 1) return MathUtils.clamp((f - 0.1) / 0.9, 0, 1);
  if (a.variant !== 'stallion') return 1;
  return MathUtils.clamp((f - 0.2) / 0.8, 0, 1);
}
