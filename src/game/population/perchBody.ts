import type { MixedPopulationRows } from '@wildshard/format/mixedPopulation';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { EnemyWorld } from '@wildshard/engine/entities/species/registry';
import { Vector3 } from 'three';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { createMemoryActionBrain, type SpeciesDecision, type createNativeSpeciesContext } from '../plugin/brain';
import { projectedSite } from './projectedSites';
import { ReturnProgram } from './returnProgram';
import type { SimHost } from '@wildshard/engine/sim';

type Context = ReturnType<typeof createNativeSpeciesContext<EnemyWorld<HuntBody>>>['observation'];
/** Native perch policy adapter: admitted memory gates select built-in strike and
 * physical launch effects. The guest selects habitat sites and projected heights. */
export function bindPerchBody(actor: HuntBody, first: Context, decision: SpeciesDecision<HuntBody>, bite: StrikeSpec,
  guest: ReturnProgram, row: MixedPopulationRows['perch']): ReturnType<typeof createMemoryActionBrain<HuntBody, Context>> {
  if (decision.archetype !== 'perch-hunter') throw new Error('Perch body requires its declared policy');
  const contact = new StrikeRunner(), from = new Vector3(), to = new Vector3();
  let current = first;
  const ports = { ...first,
    pickPerch: (a: HuntBody, min: number, max: number, away?: Vector3): number => {
      const points = (current.world.perches ?? []).map((p, index) => ({ x: p.x, z: p.z,
        occupied: current.herd?.some(h => h !== a && h.alive && h.mem['perch'] === index) === true ? 1 : 0 }));
      return projectedSite(points, guest, { signal: row.score, limit: 1024, origin: a.position, minimum: min, maximum: max,
        observations: {}, ...(away === undefined ? {} : { away }) }, current.rng)?.index ?? -1;
    },
    setPerch: (a: HuntBody, index: number): void => {
      const p = current.world.perches?.[index], base = current.world.perchBases?.[index] ?? p;
      if (p === undefined || base === undefined) throw new Error('Missing declared perch');
      const height = guest.project(row.height, { y: p.y, ground: current.heightAt(p.x, p.z) })[row.heightChannel];
      if (height === undefined) throw new Error('Missing perch height channel');
      const root = row.root;
      Object.assign(a.mem, { perch: index, [root.x]: p.x, [root.z]: p.z, [root.baseX]: base.x, [root.baseZ]: base.z, [root.height]: height });
    },
  };
  return createMemoryActionBrain(actor, row.actions, { decide: (_a, context) => {
    current = context; Object.assign(ports, context); decision.policy.think(ports);
  }, effects: new Map([
    ['bite', (a: HuntBody, c: Context): void => {
      if (contact.contains(bite, { actor: { position: a.position, scale: a.scale, yaw: a.yaw }, target: c.player }) && (bite.tags.includes('cover.exempt') || c.reach(a))) {
        c.hurt(bite.damage); c.sound(row.sound);
      }
    }],
    ['throw', (a: HuntBody, c: Context): void => {
      from.set(a.position.x, a.position.y + row.sourceHeight * a.scale, a.position.z);
      to.set(c.player.x, c.player.y + row.targetHeight, c.player.z); c.world.throwCoconut?.(from, to, a);
    }],
  ]) });
}

/** Client-independent root integration for a declared climbing/drop pose. The
 * roster invokes this on its existing body clock before numeric joint poses. */
export function stepPerchRoot(c: AnimalRigContext, row: MixedPopulationRows['perch']['root']): void {
  const a = c.animal, m = a.mem, dt = c.dt, height = m[row.height] ?? 0;
  if (m[row.drop]) {
    m[row.velocity] = (m[row.velocity] ?? 0) - row.gravity * dt; a.yOffset += (m[row.velocity] ?? 0) * dt;
    if (a.yOffset <= 0) { a.yOffset = 0; m[row.drop] = 0; m[row.velocity] = 0; m[row.land] = row.landing; }
  } else if (m[row.climb] && height > 0) {
    a.yOffset = Math.min(height, a.yOffset + row.speed * dt);
    const k = height > .01 ? a.yOffset / height : 1, bx = m[row.baseX] ?? 0, bz = m[row.baseZ] ?? 0, x = m[row.x] ?? 0, z = m[row.z] ?? 0;
    a.position.x = bx + (x - bx) * k; a.position.z = bz + (z - bz) * k;
    if (a.yOffset >= height - 1e-3) { m[row.climb] = 0; a.position.x = x; a.position.z = z; }
  }
  m[row.land] = Math.max(0, (m[row.land] ?? 0) - dt);
}

/** Bind the projection to the installed host's admitted terrain. */
export function nativePerchProgram(host: SimHost, input: unknown): ReturnProgram { return ReturnProgram.native(host, input); }
