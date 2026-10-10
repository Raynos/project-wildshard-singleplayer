import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Lane } from '../../../src/shards/pine-hollow/combat/lane';
import { pineEliteScripts, type PineEliteBody, type PineEliteWorld } from '../../../src/shards/pine-hollow/combat/eliteScripts';
import { pineEliteScripts as oracleScripts } from '../../fixtures/species-oracle/pineElites';
import { sha256, moduleBytes } from '../../../src/game/shardfile/speciesScripts';
import { eliteScript } from '../../../src/sdk/eliteScripts';
import { IRONHIDE_BRAIN, PINE_ELITE_MODULES } from '../../../src/shards/pine-hollow/data/eliteBrains';

// SF27: Pine Hollow's four named elites fight through admitted elite scripts (behaviour/*.as, data/eliteBrains.ts). Each is
// held to the TypeScript script and goal it replaced (test/fixtures/species-oracle/pineElites.ts) on identical bodies and
// worlds, for thousands of steps at three seeds, while a player circles in close and far, hits them, leaves (leash), phase 2
// comes, dusk falls and reach closes now and then: every step's mode, fields, lanes, bodies and every world call (blows,
// stuns, shakes, voices, signatures, spawns, tells, fx) must be identical.

/** A deterministic body: it turns toward its wanted heading at its turn rate and walks at its wanted speed. */
class Body implements PineEliteBody {
  alive = true; hidden = false; hp = 400; readonly maxHp = 400; readonly scale = 1.2; state = 'idle';
  position = new Vector3(); yaw = 0; lookTarget = new Vector3(); lookWeight = 0; lastHitT = -Infinity;
  want = { yaw: 0, speed: 0, turn: 0 }; attack = -1;
  readonly kind: string; readonly entityId: string; readonly seed: number;
  constructor(kind: string, id: string, seed: number, x: number, z: number, yaw: number) {
    this.kind = kind; this.entityId = id; this.seed = seed; this.position.set(x, 0, z); this.yaw = yaw;
  }
  setMotion(yaw: number, speed: number, turn: number): void { this.want = { yaw, speed, turn }; }
  startAttack(seconds: number): void { this.attack = seconds; }
  cancelAttack(): void { this.attack = -1; }
  place(x: number, z: number, yaw: number, y?: number): void { this.position.set(x, y ?? 0, z); this.yaw = yaw; }
  step(dt: number): void {
    const diff = Math.atan2(Math.sin(this.want.yaw - this.yaw), Math.cos(this.want.yaw - this.yaw)), max = this.want.turn * dt;
    this.yaw += Math.max(-max, Math.min(max, diff));
    this.position.x += Math.sin(this.yaw) * this.want.speed * dt; this.position.z += Math.cos(this.yaw) * this.want.speed * dt;
    if (this.attack >= 0) this.attack = Math.max(-1, this.attack - dt);
  }
  view(): unknown {
    return [this.entityId, this.position.x, this.position.z, this.yaw, this.want, this.lookTarget.toArray(), this.lookWeight, this.hidden, this.attack, this.state];
  }
}

interface Rig { world: PineEliteWorld<Body>; log: unknown[]; bodies: Body[]; player: { position: Vector3; yaw: number }; clock: { dusk: number; reach: boolean } }
function rig(): Rig {
  const log: unknown[] = [], bodies: Body[] = [], player = { position: new Vector3(), yaw: 0 }, clock = { dusk: 0, reach: true };
  let n = 0;
  const world: PineEliteWorld<Body> = {
    player, reach: () => clock.reach, god: false,
    trauma: (k) => { log.push(['trauma', k]); }, stun: (s) => { log.push(['stun', s]); },
    dusk: () => clock.dusk, night: () => 0,
    hurt: (a, dmg, walls) => { log.push(['hurt', a.entityId, dmg, walls === true]); },
    voice: (name, a) => { log.push(['voice', name, a.entityId]); },
    spawn: (kind, x, z, yaw, variant) => { const b = new Body(kind, `creature:${String(++n)}`, n * 7.31, x, z, yaw); bodies.push(b); log.push(['spawn', kind, variant, x, z, yaw]); return b; },
    find: (id) => bodies.find(b => b.entityId === id) ?? null,
    own: (a) => { log.push(['own', a.entityId]); }, release: (a) => { log.push(['release', a.entityId]); },
    retire: (a) => { a.alive = false; log.push(['retire', a.entityId]); }, adopt: (a) => { log.push(['adopt', a.entityId]); },
    lane: (row) => new Lane<Body>(row, () => clock.reach),
    ring: () => ({ setTime: (t) => { log.push(['ringT', t]); }, ring: (x, z, r, alpha) => { log.push(['ring', x, z, r, alpha]); }, hide: () => { log.push(['ringOff']); } }),
    heightAt: (x, z) => Math.sin(x * 0.05) * 4 + Math.cos(z * 0.04) * 3,
    inChunk: (x, z, margin) => Math.abs(x) <= 300 - margin && Math.abs(z) <= 300 - margin,
    show: (a, visible) => { log.push(['show', a.entityId, visible]); },
    fx: { fade: (a) => { log.push(['fade', a.entityId]); }, reappear: (a) => { log.push(['reappear', a.entityId]); },
      burstOut: (a) => { log.push(['burst', a.entityId]); }, roar: (a, r) => { log.push(['roarFx', a.entityId, r]); } },
    signature: (id) => { log.push(['sig', id]); }, feed: (text) => { log.push(['feed', text]); },
  };
  return { world, log, bodies, player, clock };
}

/** Drive elite `index` of both implementations through the same story; return the first differing step, or null. */
function replay(index: number, seed: number, steps: number): { diverged: number | null; modes: Set<string>; hits: number } {
  const a = rig(), b = rig(), oldOne = oracleScripts(a.world, seed)[index], newOne = pineEliteScripts(b.world, seed)[index];
  if (oldOne === undefined || newOne === undefined) throw new Error('missing elite');
  oldOne.spawn(); newOne.spawn();
  const modes = new Set<string>(), dt = 1 / 60;
  let hits = 0;
  for (let i = 0; i < steps; i++) {
    const t = i * dt, lair = newOne.def.lair, r = 1 + 34 * (0.5 + 0.5 * Math.sin(t * 0.11 + seed)), ang = t * 0.3 + seed;
    const engaged = (i % 3000) < 2600, leashing = !engaged && (i % 3000) < 2800;
    for (const s of [a, b]) {
      const anchor = s.bodies[0];
      const cx = anchor === undefined ? lair.x : anchor.position.x * 0.02 + lair.x * 0.98, cz = anchor === undefined ? lair.z : anchor.position.z * 0.02 + lair.z * 0.98;
      s.player.position.set(cx + Math.sin(ang) * r, 0, cz + Math.cos(ang) * r); s.player.yaw = t * 0.7;
      s.clock.dusk = (i % 4000) > 2500 ? 0.8 : 0; s.clock.reach = (i % 700) < 600;
      // a hit now and then (the stag fades on it)
      if (i % 450 === 200 && anchor !== undefined) anchor.lastHitT = t;
    }
    if (i === Math.floor(steps / 2)) { oldOne.enterPhase2(); newOne.enterPhase2(); }
    if (i % 3000 === 2800) { oldOne.reset(); newOne.reset(); }
    modes.add(newOne.brainState);
    oldOne.tick(dt, t, engaged, leashing); newOne.tick(dt, t, engaged, leashing);
    for (const s of [a, b]) for (const body of s.bodies) body.step(dt);
    modes.add(newOne.brainState);
    const view = (s: Rig, e: typeof oldOne | typeof newOne): string => JSON.stringify([e.brainState, e.fields(), e.lanes().map(l => l.snapshot()), e.rngs().map(x => x.snapshot()), s.bodies.map(x => x.view()), s.log]);
    hits += b.log.filter(x => Array.isArray(x) && x[0] === 'hurt').length;
    if (view(a, oldOne) !== view(b, newOne)) {
      // the step's records, for the failure message
      expect([i, newOne.brainState, newOne.fields(), b.log]).toEqual([i, oldOne.brainState, oldOne.fields(), a.log]);
      return { diverged: i, modes, hits };
    }
    // each step compares its own world calls
    a.log.length = 0; b.log.length = 0;
  }
  return { diverged: null, modes, hits };
}

const ELITES = [['Old Ironhide', 0, ['circle', 'charge']], ['the Ghost Stag', 1, ['faded', 'stare', 'flee']],
  ['Old Blackpaw', 2, ['lurk', 'roar', 'charge', 'swipe', 'stalk']], ['the Imperial Bull', 3, ['bugle', 'charge', 'posture']]] as const;

describe('Pine elite scripts against their TypeScript oracle', () => {
  for (const [label, index, visits] of ELITES) {
    it.each([1337, 7, 4242])(`${label} is identical step for step (seed %i)`, (seed) => {
      const run = replay(index, seed, 12_000);
      expect(run.diverged).toBeNull();
      for (const mode of visits) expect(run.modes).toContain(mode);
      if (index !== 1) expect(run.hits).toBeGreaterThan(0);
    });
  }
  it('admits each module by its SHA-256 and refuses a tampered one', () => {
    for (const [hash, bytes] of Object.entries(PINE_ELITE_MODULES)) expect(sha256(moduleBytes(bytes))).toBe(hash);
    const bytes = PINE_ELITE_MODULES[IRONHIDE_BRAIN.module];
    if (bytes === undefined) throw new Error('missing module');
    const tampered = moduleBytes(bytes); tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;
    expect(() => eliteScript(IRONHIDE_BRAIN, btoa(String.fromCodePoint(...tampered)), () => 0)).toThrow(/hash mismatch/u);
  });
});
