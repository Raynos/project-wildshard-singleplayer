#!/usr/bin/env node
// check-clips.mjs — the --check of the Nine Dragon first-person rig (scripts/blender/targets.json "nine-dragon-stack/fp-rig").
//
// fp-rig.glb's 16 clips were sampled by bake.ts from moves.ts (the authored weapon paths) through the arm IK in
// src/game/systems/viewmodel/armRig.ts (the same file the lab used: it moved into the shard unchanged). This re-samples
// every clip the way bake.ts does (60 Hz, each bone's local rotation under its parent) from the recovered moves.ts and
// the shipped rig.ts, and compares it with the rotations in the committed GLB. It needs no browser and no Blender.
//
//   node --import ./scripts/bake-loader.mjs scripts/blender/nine-dragon-stack/viewmodel/rig/check-clips.mjs [--tol=0.1]
//
// Pass: the same clip names and durations, every bone rotation within --tol degrees (meshopt's quantisation is ~0.03°).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Quaternion, Vector3 } from 'three';

const ROOT = resolve(import.meta.dirname, '../../../../..');
const tolArg = process.argv.find((a) => a.startsWith('--tol='));
const TOL = tolArg === undefined ? 0.1 : Number(tolArg.slice(6));
const GLB = join(ROOT, 'public/assets/nine-dragon/viewmodel/fp-rig.glb');
const RIG = pathToFileURL(join(ROOT, 'src/game/systems/viewmodel/armRig.ts')).href;
const THREE = pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href;

// moves.ts as the lab had it, with its two imports pointed at the shipped rig.ts and three
const src = readFileSync(join(import.meta.dirname, 'moves.ts.txt'), 'utf8')
  .replace("from 'three';", `from '${THREE}';`)
  .replace("from './rig';", `from '${RIG}';`);
const tmp = mkdtempSync(join(tmpdir(), 'fp-rig-check-'));
writeFileSync(join(tmp, 'moves.ts'), src);
const M = await import(pathToFileURL(join(tmp, 'moves.ts')).href);
const R = await import(RIG);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(GLB);
const anims = new Map(doc.getRoot().listAnimations().map((a) => [a.getName(), a]));

// bake.ts: world matrices in BONES order, each bone's parent (−1 = the root; the left claw rides twist1)
const PARENT = [-1, 0, 1, 2, 2, 2, 2, 6];
const PARENT_L = [-1, 0, 1, 2, 2, 2, 2, 3];
const armMatrices = (w) => [w.shoulder, w.upper, w.fore, w.twists[0], w.twists[1], w.twists[2], w.hand, w.tip];
const locals = (world, parents) => world.map((m, i) => {
  const p = parents[i] ?? -1;
  const pw = p < 0 ? new Matrix4() : world[p];
  return pw.clone().invert().multiply(m);
});

const { cR, cL } = M.restRig();
const SR = M.FRAMING.shoulderR.clone();
const SL = M.FRAMING.shoulderL.clone();
const fails = [];
let worst = 0;
const clips = M.buildClips();
if (clips.length !== anims.size) fails.push(`clip count: moves.ts ${clips.length}, fp-rig.glb ${anims.size}`);
for (const c of clips) {
  const a = anims.get(c.name);
  if (a === undefined) { fails.push(`${c.name}: not in fp-rig.glb`); continue; }
  const right = c.side === 'R';
  const names = R.BONES[right ? 'right' : 'left'];
  const channels = new Map(a.listChannels().map((ch) => [`${ch.getTargetNode()?.getName()}.${ch.getTargetPath()}`, ch.getSampler()]));
  const n = Math.max(1, Math.round(c.duration * 60));
  let clipWorst = 0;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * c.duration;
    const tt = c.loop && i === n ? 0 : t;
    const w = R.solveArm(right ? cR : cL, c.owner(tt), (right ? SR : SL).clone().add(c.shoulder(tt)));
    const loc = locals(armMatrices(w), right ? PARENT : PARENT_L);
    for (let k = 1; k < 7; k++) {
      const q = new Quaternion();
      loc[k].decompose(new Vector3(), q, new Vector3());
      const s = channels.get(`${names[k]}.rotation`);
      if (s === undefined) { fails.push(`${c.name}: no ${names[k]} rotation track`); continue; }
      const times = s.getInput();
      if (i === 0 && Math.abs(times.getMax([])[0] - c.duration) > 1e-3) fails.push(`${c.name}: duration ${c.duration} vs ${times.getMax([])[0]}`);
      const o = s.getOutput().getElement(i, []);
      const dot = Math.min(1, Math.abs(q.x * o[0] + q.y * o[1] + q.z * o[2] + q.w * o[3]));
      clipWorst = Math.max(clipWorst, (2 * Math.acos(dot) * 180) / Math.PI);
    }
  }
  worst = Math.max(worst, clipWorst);
  if (clipWorst > TOL) fails.push(`${c.name}: a bone rotation is ${clipWorst.toFixed(3)}° off (tolerance ${TOL}°)`);
  console.log(`[fp-rig] ${c.name.padEnd(13)} ${c.duration.toFixed(2)} s, ${n + 1} keys, worst bone rotation ${clipWorst.toFixed(3)}°`);
}
console.log(`[fp-rig] ${clips.length} clips, worst ${worst.toFixed(3)}°: ${fails.length === 0 ? 'PASS' : 'FAIL'}`);
for (const f of fails) console.error(`  ${f}`);
process.exitCode = fails.length === 0 ? 0 : 1;
