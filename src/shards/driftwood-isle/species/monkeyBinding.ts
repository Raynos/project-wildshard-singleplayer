import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { Scope } from '@wildshard/engine/app/scope';
import type { SimHost } from '@wildshard/engine/sim';
import { MathUtils, Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { projectedSite } from '@wildshard/game/population/projectedSites';
import { parse, strictObject, tuple, unknown } from 'valibot';

export interface MonkeyPerchPorts<A extends AnimalSim> {
  readonly world: { readonly perches?: readonly A['position'][] | undefined; readonly perchBases?: readonly A['position'][] | undefined };
  readonly herd: readonly A[] | null;
  /** the decision stream (the manager's Rng in the browser) */
  readonly rng: Rng;
  heightAt: (x: number, z: number) => number;
}
/** What the strike reads: the contact ports, the sound and the coconut lob (the shard's projectile owner). */
export interface MonkeyStrikePorts<A extends AnimalSim> {
  readonly player: A['position'];
  reach: (actor: A) => boolean;
  hurt: (damage: number) => void;
  sound: (name: string) => void;
  readonly world: { readonly throwCoconut?: ((from: A['position'], target: A['position'], thrower: A) => void) | undefined };
}

const _from = new Vector3(), _to = new Vector3();
const contact = new StrikeRunner();
/** Existing bite contact; the caller's declared memory gate claims the strike first. */
export function biteMonkey<A extends AnimalSim>(a: A, c: MonkeyStrikePorts<A>, bite: StrikeSpec): void {
  if (contact.contains(bite, { actor: { position: a.position, scale: a.scale, yaw: a.yaw }, target: c.player }) && (bite.tags.includes('cover.exempt') || c.reach(a))) {
    c.hurt(bite.damage); c.sound('monkey_shriek');
  }
}
/** Existing coconut owner and target heights; no random draw or projectile clock is added. */
export function throwMonkeyCoconut<A extends AnimalSim>(a: A, c: MonkeyStrikePorts<A>): void {
  _from.set(a.position.x, a.position.y + 0.95 * a.scale, a.position.z);
  _to.set(c.player.x, c.player.y + 0.9, c.player.z);
  c.world.throwCoconut?.(_from, _to, a);
}


function stepMonkeyRoot(a: Pick<AnimalSim, 'mem' | 'position' | 'yOffset'>, dt: number): void {
  const m = a.mem as Record<'drop' | 'vy' | 'land' | 'climb' | 'perchH' | 'bx' | 'bz' | 'px' | 'pz', number>;
  if (m.drop) {
    m.vy = (m.vy || 0) - 9.8 * dt;
    a.yOffset += m.vy * dt;
    if (a.yOffset <= 0) { a.yOffset = 0; m.drop = 0; m.vy = 0; m.land = 0.35; }
  } else if (m.climb && m.perchH > 0) {
    a.yOffset = Math.min(m.perchH, a.yOffset + 2.2 * dt);
    const k = m.perchH > 0.01 ? a.yOffset / m.perchH : 1;
    a.position.x = MathUtils.lerp(m.bx, m.px, k); a.position.z = MathUtils.lerp(m.bz, m.pz, k);
    if (a.yOffset >= m.perchH - 1e-3) { m.climb = 0; a.position.x = m.px; a.position.z = m.pz; }
  }
  m.land = Math.max(0, (m.land || 0) - dt);
}

/** AS owns perch decisions. Per-frame root integration remains counted native
 * code (G457), at its original near-pose phase and with its original save keys. */
export class MonkeyBinding {
  private readonly poses: ((c: AnimalRigContext) => void)[];
  private readonly guest: ReturnProgram;
  constructor(input: unknown, owner: Scope | SimHost) {
    const row = parse(strictObject({ clips: tuple([unknown(), unknown()]), program: unknown() }), input);
    this.poses = row.clips.map(numericCreaturePose);
    this.guest = owner instanceof Scope ? ReturnProgram.page(row.program, owner) : ReturnProgram.native(owner, row.program);
  }
  readonly animate = (c: AnimalRigContext): void => { stepMonkeyRoot(c.animal, c.dt); for (const pose of this.poses) pose(c); };
  pickPerch<A extends AnimalSim>(a: A, c: MonkeyPerchPorts<A>, min: number, max: number, away?: A['position']): number {
      const points = (c.world.perches ?? []).map((p, index) => ({ x: p.x, z: p.z,
        occupied: c.herd?.some(h => h !== a && h.alive && h.mem['perch'] === index) === true ? 1 : 0 }));
      return projectedSite(points, this.guest, { signal: 'perchScore', limit: 1024, origin: a.position, minimum: min, maximum: max,
        observations: {}, ...(away === undefined ? {} : { away }) }, c.rng)?.index ?? -1;
  }
  setPerch<A extends AnimalSim>(a: A, c: MonkeyPerchPorts<A>, index: number): void {
      const p = c.world.perches?.[index]; if (p === undefined) throw new Error(`monkey: no perch ${index}`);
      const base = c.world.perchBases?.[index] ?? p;
      const height = this.guest.project('perchHeight', { y: p.y, ground: c.heightAt(p.x, p.z) })['perchH'];
      if (height === undefined) throw new Error('Missing perch projection');
      Object.assign(a.mem, { perch: index, px: p.x, pz: p.z, bx: base.x, bz: base.z, perchH: height });
  }
}
