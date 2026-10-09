import { Bone, Vector3 } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- SPECIES_CLIPS_RECORD=1 re-pins the traces from a base tree.
import { writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- hashes every bone transform's exact bits frame by frame against the pinned trace.
import { createHash, type Hash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- the record switch is a test-runner environment value, not game configuration.
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import type { Animal } from '../../src/engine/entities/AnimalView';
import type { RigAnimCtx } from '../../src/engine/entities/species/registry';
import type { SpeciesLook } from '../../src/engine/entities/species/look';
import { DUNE_STRIDER_LOOK } from '../../src/shards/sunscar-dunes/species/strider';
import { SAND_SKITTERER_LOOK } from '../../src/shards/sunscar-dunes/species/skitterer';
import { DUNE_RAY_LOOK } from '../../src/shards/sunscar-dunes/species/duneRay';
import { DUNE_MATRIARCH_LOOK } from '../../src/shards/sunscar-dunes/species/matriarch';
import { DRIFT_RAY_LOOK } from '../../src/shards/far-reach/species/driftRay';
import { SKY_GOAT_LOOK } from '../../src/shards/far-reach/species/skyGoat';
import { GALE_WISP_LOOK } from '../../src/shards/far-reach/species/galeWisp';
import { playClips, type ClipCtx, type SpeciesClips } from '../../src/game/systems/species/clips';
import pinned from './species-clips.json' with { type: 'json' };

/** A small deterministic generator (mulberry32), so a trace is the same on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const RATES = [60, 30, 20] as const;
type Run = (typeof RATES)[number] | 'paused';
const RUNS: readonly Run[] = [...RATES, 'paused'];

/**
 * One animal's life at `hz` (or paused): walks, runs and backs off (gait phase from the speed), attacks, paws, is winded,
 * burrows, lands (the Matriarch's phase), then dies (deathT 0 → 1 over 0.8 s, held). Every frame hashes each bone's
 * position, rotation and scale as raw float64 bits (so a signed zero counts), and the animal's `mem` at the end.
 */
function trace(look: SpeciesLook, run: Run, seed: number, hash: Hash): void {
  const animate = look.animate;
  if (animate === undefined) throw new Error(`${look.kind} has no animate`);
  const r = rng(seed), sockets = look.rigContract.sockets, bones: Record<string, Bone> = {};
  sockets.forEach((name, i) => { const b = new Bone(); b.name = name; b.position.set((i % 3) * 0.31 - 0.3, 0.4 + i * 0.137, i * 0.21 - 0.5); bones[name] = b; });
  const mem: Record<string, number> = {}, hz = run === 'paused' ? 30 : run, frames = hz * 50, deathAt = Math.floor(frames * 0.8);
  // The species animate functions never read the animal: a bare stand-in keeps the trace free of the entity system.
  const animal = {} as Animal;
  const ctx: RigAnimCtx = { bones, dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: 0.5, headRadius: 0.3, legLen: 0.6, feet: [], halfWidth: 0.5 }, dt: 1 / hz, t: 500 + r() * 2000, seed,
    scale: 1, speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position: new Vector3(), yaw: 0, mem, animal };
  let speedLeft = 0, attackDur = 0, pawLeft = 0;
  const out = new Float64Array(sockets.length * 9);
  for (let f = 0; f < frames; f++) {
    const paused = run === 'paused' && f % 200 >= 120; // paused stretches: the clock and every input hold
    if (!paused) {
      ctx.dt = 1 / hz; ctx.t += ctx.dt;
      if ((speedLeft -= ctx.dt) <= 0) { speedLeft = 0.5 + r() * 2.5; ctx.speed = r() < 0.15 ? 0 : -2 + r() * 11; }
      ctx.phase = (ctx.phase + ctx.dt * Math.abs(ctx.speed) / 1.7) % 1;
      if (ctx.attack >= 0) { ctx.attack += ctx.dt / attackDur; if (ctx.attack > 1) ctx.attack = -1; } else if (r() < 0.01) { attackDur = 0.5 + r(); ctx.attack = 0; }
      if ((pawLeft -= ctx.dt) <= 0) { pawLeft = 0.5 + r() * 2; mem['paw'] = r() < 0.3 ? 1 : 0; mem['phase'] = Math.floor(r() * 4); }
      if (r() < 0.02) mem['winded'] = r() < 0.5 ? 0 : r();
      if (r() < 0.02) mem['burrow'] = r() < 0.4 ? 0 : r();
      if (f >= deathAt) { ctx.alive = false; ctx.deathT = Math.min(1, (f - deathAt) * ctx.dt / 0.8); }
    } else ctx.dt = 0;
    animate(ctx);
    sockets.forEach((name, i) => {
      const b = bones[name]; if (b === undefined) return;
      out.set([b.position.x, b.position.y, b.position.z, b.rotation.x, b.rotation.y, b.rotation.z, b.scale.x, b.scale.y, b.scale.z], i * 9);
    });
    hash.update(new Uint8Array(out.buffer));
  }
  hash.update(JSON.stringify(Object.entries(mem).sort(([a], [b]) => a.localeCompare(b))));
}

const LOOKS: readonly SpeciesLook[] = [DUNE_STRIDER_LOOK, SAND_SKITTERER_LOOK, DUNE_RAY_LOOK, DUNE_MATRIARCH_LOOK, DRIFT_RAY_LOOK, SKY_GOAT_LOOK, GALE_WISP_LOOK];
const SEEDS = [11, 23, 47] as const;
const traces = (look: SpeciesLook): Record<Run, string> => {
  const result: Record<string, string> = {};
  for (const run of RUNS) { const hash = createHash('sha256'); for (const seed of SEEDS) trace(look, run, seed, hash); result[String(run)] = hash.digest('hex'); }
  return { 60: result['60'] ?? '', 30: result['30'] ?? '', 20: result['20'] ?? '', paused: result['paused'] ?? '' };
};

describe('declarative species clips play exactly what the hand-written animate functions did (SHARD-PLATFORM M3)', () => {
  if (process.env['SPECIES_CLIPS_RECORD'] === '1') {
    it('records the traces from this tree', () => {
      writeFileSync(new URL('species-clips.json', import.meta.url), `${JSON.stringify(Object.fromEntries(LOOKS.map((look) => [look.kind, traces(look)])), null, 2)}\n`);
    });
    return;
  }
  it.each(LOOKS.map((look) => [look.kind, look] as const))('%s: every bone transform bit-equal over 60 / 30 / 20 Hz and paused (3 lives × 50 s each)', (kind, look) => {
    expect(traces(look)).toEqual(Object.entries(pinned).find(([k]) => k === kind)?.[1]);
  });
});

/** A fixture grazer (no shard's): a head that bobs off-phase, a neck bound to its bind turn, a body that sways sideways when hungry. */
const GRAZER: SpeciesClips = [
  { bone: 'head', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2, offset: 1 }, 0.1] }] }] },
  { bone: 'neck', channel: 'rotation.x', bind: 'neckX', cases: [{ when: { mem: { key: 'graze', above: 0.5 } }, sum: [0.6] }, { sum: [] }] },
  { bone: 'body', channel: 'position.x', cases: [{ when: { mem: { key: 'hunger', atLeast: 1 } }, sum: [{ of: [{ wave: 'phase', rate: 4 }, 0.05] }] }] },
  { bone: 'tail', channel: 'rotation.z', cases: [{ sum: [0.3] }] },
];

describe('the clip player is generic: a fixture grazer', () => {
  const frame = (bones: Record<string, Bone>, mem: Record<string, number>, alive = true): ClipCtx => ({ bones, t: 1.5, phase: 0.25, speed: 1, alive, deathT: alive ? -1 : 1, attack: -1, mem });
  it('plays each row on its bone, binds once, skips a missing bone and leaves a channel no case covers', () => {
    const head = new Bone(), neck = new Bone(), body = new Bone(), mem: Record<string, number> = {};
    neck.rotation.x = 0.2; body.position.x = 7;
    playClips(GRAZER, frame({ head, neck, body }, mem));
    expect(head.rotation.x).toBe(Math.sin(1.5 * 2 + 1) * 0.1);
    expect([neck.rotation.x, mem['neckX']]).toEqual([0.2, 0.2]); // the bind with an empty sum: the bind turn itself
    expect(body.position.x).toBe(7); // not hungry: no case holds, so the channel keeps its value
    mem['graze'] = 1; mem['hunger'] = 1; neck.rotation.x = 5;
    playClips(GRAZER, frame({ head, neck, body }, mem));
    expect(neck.rotation.x).toBe(0.2 + 0.6); // from the kept bind, not the bone's current turn
    expect(body.position.x).toBe(Math.sin(0.25 * 4) * 0.05);
    playClips(GRAZER, frame({ head, neck, body }, mem, false));
    expect(head.rotation.x).toBe(Math.sin(1.5 * 2 + 1) * 0.1); // dead: no case, the head keeps its last turn
  });
  it('a gated term adds +0 and a product keeps its sign, so signed zeroes match hand-written code', () => {
    const bone = new Bone(), clips: SpeciesClips = [{ bone: 'b', channel: 'rotation.y', cases: [{ sum: [{ when: { attacking: true }, of: [{ attack: true }, -0.45] }] }] }];
    playClips(clips, { ...frame({ b: bone }, {}), attack: -1 });
    expect(Object.is(bone.rotation.y, 0)).toBe(true);
    playClips(clips, { ...frame({ b: bone }, {}), attack: 0 });
    expect(Object.is(bone.rotation.y, -0)).toBe(true);
  });
});
