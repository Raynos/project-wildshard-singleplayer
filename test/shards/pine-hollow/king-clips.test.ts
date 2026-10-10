import { Bone, Group, Vector3 } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- KING_CLIPS_RECORD=1 re-pins the trace from a base tree.
import { writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- hashes every bone transform's exact bits frame by frame against the pinned trace.
import { createHash, type Hash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- the record switch is a test-runner environment value; the platform gate keeps libm differences out.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Open the actual committed King rig.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACT_BRACE, ACT_ROAR, ACT_STRIKE, ACT_SWEEP, KING_BONES, KING_CLIP_NAMES, advanceKingPose, applyKingPose, clipPose, kingRest, newPose, type KingPose, type KingPoseInput, type KingRest } from '../../../src/shards/pine-hollow/combat/kingRig';
import { readKingRig } from '../../../scripts/bake-pine-king-collision.mjs';
import pinned from './king-clips.json' with { type: 'json' };

/** mulberry32: the same trace on every machine */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The stand-in skeleton (KING_BONES), parented as the rig declares it: the rest a hull-less King measures. */
function standIn(): Record<string, Bone> {
  const bones: Record<string, Bone> = {}, group = new Group();
  for (const def of KING_BONES) {
    const b = new Bone(); b.name = def.name; bones[def.name] = b;
    const parent = def.parent === null ? null : bones[def.parent];
    const pp = def.parent === null ? null : KING_BONES.find((d) => d.name === def.parent);
    b.position.set(def.pos[0] - (pp?.pos[0] ?? 0), def.pos[1] - (pp?.pos[1] ?? 0), def.pos[2] - (pp?.pos[2] ?? 0));
    (parent ?? group).add(b);
  }
  return bones;
}

const out = new Float64Array(10);
function hashBones(r: KingRest, h: Hash): void {
  for (const n of r.names) {
    const b = r.bones[n];
    if (b === undefined) continue;
    out[0] = b.position.x; out[1] = b.position.y; out[2] = b.position.z;
    out[3] = b.quaternion.x; out[4] = b.quaternion.y; out[5] = b.quaternion.z; out[6] = b.quaternion.w;
    out[7] = b.scale.x; out[8] = b.scale.y; out[9] = b.scale.z;
    h.update(new Uint8Array(out.buffer));
  }
}
const KEYS = ['rootY', 'rootZ', 'rootPitch', 'rootRoll', 'rootYaw', 'hipsPitch', 'chestPitch', 'chestYaw', 'chestRoll', 'neckPitch', 'neckYaw', 'headPitch', 'headYaw', 'headRoll', 'tailPitch', 'tailYaw'] as const;
const scalars = new Float64Array(KEYS.length);
function hashPose(p: KingPose, h: Hash): void {
  KEYS.forEach((k, i) => { scalars[i] = p[k]; });
  h.update(new Uint8Array(scalars.buffer)); h.update(new Uint8Array(p.feet.buffer.slice(0)));
}

/** Every clip alone at 97 points of its range (and past it), solved onto the rig. */
function clipSweep(r: KingRest, h: Hash): void {
  const p = newPose();
  for (const clip of KING_CLIP_NAMES) for (let i = 0; i <= 96; i++) {
    const x = clip === 'idle' ? i * 0.731 : i / 80 - 0.05;
    clipPose(p, r, clip, x, 3.7 + i * 0.113); hashPose(p, h); applyKingPose(r, p); hashBones(r, h);
  }
}

/** A fight's life at `hz`: walks, charges, stops, every named attack (held, eased out), hits, braces, looks, a debug hold, then dies. */
function life(r: KingRest, hz: number, seed: number, h: Hash): void {
  const rand = rng(seed), p = newPose(), at = new Vector3(), frames = hz * 60, deathAt = Math.floor(frames * 0.85);
  const input: KingPoseInput = { dt: 1 / hz, t: 100 + rand() * 50, scale: 2.6, speed: 0, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookWeight: 0, yaw: 0, lookTarget: new Vector3(4, 1, 9), position: at, mem: {} };
  const acts = [0, ACT_SWEEP, ACT_STRIKE, ACT_ROAR, ACT_BRACE];
  let speedLeft = 0, attackDur = 0, flinch = 0;
  for (let f = 0; f < frames; f++) {
    input.t += input.dt;
    if (speedLeft <= 0) { speedLeft = 1 + rand() * 4; input.speed = [0, 0.8, 2.5, 13, 40, -1.2][Math.floor(rand() * 6)] ?? 0; }
    speedLeft -= input.dt;
    if (input.attack < 0 && rand() < 0.01) {
      attackDur = 0.6 + rand() * 1.2; input.attack = 0;
      const act = acts[Math.floor(rand() * acts.length)] ?? 0;
      if (act === 0) delete input.mem['act']; else input.mem['act'] = act;
    } else if (input.attack >= 0) {
      input.attack = Math.min(1, input.attack + input.dt / attackDur);
      if (input.attack >= 1 && rand() < 0.02) input.attack = -1;
    }
    if (rand() < 0.01) flinch = 1;
    flinch = Math.max(0, flinch - input.dt * 2.5); input.flinch = flinch;
    input.brace = rand() < 0.003 ? 1 : Math.max(0, input.brace - input.dt);
    input.lookWeight = Math.max(0, Math.sin(input.t * 0.37));
    input.yaw = Math.sin(input.t * 0.11) * 3; at.set(Math.sin(input.t) * 5, 0, input.t * 0.2);
    if (f >= deathAt) input.deathT = Math.min(1.4, (f - deathAt) / hz / 0.8);
    const dbg = f % 400 > 380 ? { gait: KING_CLIP_NAMES[Math.floor(f / 400) % KING_CLIP_NAMES.length] ?? 'idle', phase: (f % 20) / 20 } : f % 400 === 5 ? { gait: 'nope', phase: 0.5 } : undefined;
    advanceKingPose(input, r, p, dbg); hashPose(p, h); applyKingPose(r, p); hashBones(r, h);
  }
  h.update(JSON.stringify(Object.entries(input.mem).sort(([a], [b]) => a.localeCompare(b))));
}

function traces(): Record<string, string> {
  const rigs: [string, () => Record<string, Bone>][] = [['hull', () => readKingRig(resolve(import.meta.dirname, '../../..')).bones], ['standIn', standIn]];
  const got: Record<string, string> = {};
  for (const [name, make] of rigs) {
    let h = createHash('sha256'); clipSweep(kingRest(make()), h); got[`${name}.clips`] = h.digest('hex');
    for (const hz of [60, 30, 20]) { h = createHash('sha256'); life(kingRest(make()), hz, hz * 7 + name.length, h); got[`${name}.life${hz}`] = h.digest('hex'); }
  }
  return got;
}

describe('the Antler King clip rows', () => {
  // libm's sin / cos are the platform's: the pinned bits are the Mac's (where every shipped rig is captured).
  it.runIf(process.platform === 'darwin')('reproduce the hand-written clips bit for bit (every bone, every pose scalar, the blend memory)', () => {
    const got = traces();
    if (process.env['KING_CLIPS_RECORD'] === '1') writeFileSync(resolve(import.meta.dirname, 'king-clips.json'), `${JSON.stringify(got, null, 2)}\n`);
    expect(got).toEqual(pinned);
  });
});
