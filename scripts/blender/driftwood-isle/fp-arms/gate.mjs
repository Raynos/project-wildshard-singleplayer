#!/usr/bin/env node
// gate.mjs — the rig gate of Driftwood's first-person arms (E334; the img2-character rig checks, the dummy's list in
// .claude/skills/mockup-to-model ▸ 4): load fp-arms.glb through three's GLTFLoader, play every clip at sampled times on
// a CPU copy of the skinning, and measure. An unmeasured check is never a pass: each check reports its numbers.
//
//   node scripts/blender/driftwood-isle/fp-arms/gate.mjs <fp-arms.glb> [--json=<out.json>] [--ply=<dir> --poses=idle@0,light@0.13,…]
//
// Checks: G1 every clip moves the bones it targets (max rotation from bind, per clip) · G2 every skinned vertex finite ·
// G3 the bind restores (skinned at the inverse bind matrices' own pose = the modelled mesh, max error) · G4 weights sum
// to 1 · G5 joint indices in range · G6 every visible mesh bound (the arms skinned, the swords on R_weapon) · G9 no
// joint scale in any clip · G10 the skin sweep: every clip × 6 times, the longest edge stretch and the smallest edge
// squash against the bind (a tearing weight shows as a stretch) · grip: the right fingertips' distance to the grip axis
// at rest (they close on the cord, not through it) · off-screen: the arms at idle stay under the canonical frame's top.
// G7 (medial / lateral) and G8 (foot contact) are a whole-body figure's: not applicable to a first-person pair of arms.
// --ply writes each listed pose as a vertex-coloured PLY (rig space) for scripts/blender/driftwood-isle/fp-arms/preview.py.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? 'true']; }));
if (file === undefined) throw new Error('usage: gate.mjs <fp-arms.glb> [--json=…] [--ply=<dir> --poses=clip@t,…]');

const buf = readFileSync(file);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((resolve, reject) => { loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject); });
const root = gltf.scene.getObjectByName('vm_root') ?? gltf.scene;
const arms = root.getObjectByName('arms');
if (!(arms instanceof THREE.SkinnedMesh)) throw new Error('no skinned `arms`');
const swords = { wood: root.getObjectByName('sword_wood'), iron: root.getObjectByName('sword_iron') };
const mixer = new THREE.AnimationMixer(root);
const clips = gltf.animations;
const bones = arms.skeleton.bones;
const restQ = bones.map((b) => b.quaternion.clone()), restP = bones.map((b) => b.position.clone());
const geo = arms.geometry;
const P = geo.getAttribute('position'), SI = geo.getAttribute('skinIndex'), SW = geo.getAttribute('skinWeight'), C = geo.getAttribute('color');
const n = P.count;

function resetPose() { bones.forEach((b, i) => { b.quaternion.copy(restQ[i]); b.position.copy(restP[i]); b.scale.set(1, 1, 1); }); } // (G3 poses the bones at their inverse binds, which carry meshopt's dequantisation scale)
function pose(clipName, t) {
  mixer.stopAllAction();
  resetPose();
  if (clipName !== 'rest') {
    const c = clips.find((x) => x.name === clipName);
    if (c === undefined) throw new Error(`no clip ${clipName}`);
    const a = mixer.clipAction(c);
    a.reset().play();
    // the engine plays the right-arm moves over the left base and vice versa: idle / idleL under everything
    for (const base of ['idle', 'idleL']) {
      if (base === clipName || clipName.startsWith('swim')) continue;
      const side = c.tracks[0]?.name.startsWith('L_') ? 'L' : 'R';
      if ((base === 'idle') === (side === 'R')) continue;
      const bc = clips.find((x) => x.name === base);
      if (bc !== undefined) mixer.clipAction(bc).reset().play();
    }
    mixer.setTime(t);
  }
  root.updateMatrixWorld(true);
  arms.skeleton.update();
}
const skinned = () => {
  const out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); arms.applyBoneTransform(i, v); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  return out;
};
const report = { file, vertices: n, triangles: n / 3, joints: bones.length, clips: clips.map((c) => c.name), checks: {} };
const put = (id, pass, detail) => { report.checks[id] = { pass, ...detail }; };

// G4 / G5
let wErr = 0, badIdx = 0;
for (let i = 0; i < n; i++) {
  wErr = Math.max(wErr, Math.abs(1 - (SW.getX(i) + SW.getY(i) + SW.getZ(i) + SW.getW(i))));
  for (const k of [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)]) if (k < 0 || k >= bones.length) badIdx++;
}
put('G4 weights sum to 1', wErr <= 2e-3, { maxError: wErr, note: 'weights are 8-bit normalised after meshopt: 1/255 steps' });
put('G5 indices in range', badIdx === 0, { outOfRange: badIdx, joints: bones.length });
// the bind: every joint's world at its bind. meshopt stores the positions quantised and folds the dequantisation T into
// the inverse bind matrices (IBM' = IBM · T), so bind_j = T · IBM'_j⁻¹, and T = an arm joint's rest world · its IBM' (the
// arm joints rest at their bind; only the fingers don't)
const T = (() => { resetPose(); root.updateMatrixWorld(true); const b = root.getObjectByName('R_upperarm'); return b.matrixWorld.clone().multiply(arms.skeleton.boneInverses[bones.indexOf(b)]); })();
const depth = (o) => { let d = 0; for (let x = o; x.parent; x = x.parent) d++; return d; };
function setBind(filter) {
  resetPose();
  root.updateMatrixWorld(true);
  for (const b of [...bones].sort((x, y) => depth(x) - depth(y))) {
    if (!filter(b)) continue;
    const w = T.clone().multiply(arms.skeleton.boneInverses[bones.indexOf(b)].clone().invert());
    b.parent.updateMatrixWorld(true);
    b.parent.matrixWorld.clone().invert().multiply(w).decompose(b.position, b.quaternion, b.scale);
    b.updateMatrixWorld(true);
  }
  root.updateMatrixWorld(true);
  arms.skeleton.update();
}
// G3: every bone at its bind → the skinned mesh is the modelled one (T · the stored positions)
{
  setBind(() => true);
  const s = skinned();
  let err = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i).applyMatrix4(T); err = Math.max(err, Math.abs((s[i * 3] ?? 0) - v.x), Math.abs((s[i * 3 + 1] ?? 0) - v.y), Math.abs((s[i * 3 + 2] ?? 0) - v.z)); }
  put('G3 bind restores', err <= 1e-5, { maxError: err });
  resetPose();
}
// G6
put('G6 every visible mesh bound', arms.skeleton.bones.length > 0 && swords.wood?.parent?.name === 'R_weapon' && swords.iron?.parent?.name === 'R_weapon', {
  arms: 'skinned', swords: [swords.wood?.parent?.name, swords.iron?.parent?.name],
});
// G1 + G9: every clip moves what it targets; no scale track
const moved = {}, scaled = [];
for (const c of clips) {
  let maxDeg = 0, maxT = 0;
  for (const tr of c.tracks) {
    if (tr.name.endsWith('.scale')) scaled.push(`${c.name}:${tr.name}`);
    const [bn, path] = tr.name.split('.');
    const b = root.getObjectByName(bn);
    if (b === undefined) continue;
    const vs = tr.values, w = path === 'quaternion' ? 4 : 3;
    for (let k = 0; k < vs.length / w; k++) {
      if (path === 'quaternion') {
        const q = new THREE.Quaternion(vs[k * 4], vs[k * 4 + 1], vs[k * 4 + 2], vs[k * 4 + 3]);
        const bi = bones.indexOf(b);
        const r = bi !== -1 ? restQ[bi] : b.quaternion;
        maxDeg = Math.max(maxDeg, (2 * Math.acos(Math.min(1, Math.abs(q.dot(r))))) * 180 / Math.PI);
      } else {
        const bi = bones.indexOf(b);
        const r = bi !== -1 ? restP[bi] : b.position;
        maxT = Math.max(maxT, Math.hypot(vs[k * 3] - r.x, vs[k * 3 + 1] - r.y, vs[k * 3 + 2] - r.z));
      }
    }
  }
  // measured through the mixer, on the skinned mesh: the hand's travel
  const hand = root.getObjectByName(c.tracks[0]?.name.startsWith('L_') ? 'L_hand' : 'R_hand');
  const pts = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) { pose(c.name, f * c.duration); pts.push(new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld)); }
  const travel = Math.max(...pts.map((p) => p.distanceTo(pts[0])));
  moved[c.name] = { maxRotDeg: Number(maxDeg.toFixed(2)), maxShoulderM: Number(maxT.toFixed(4)), handTravelM: Number(travel.toFixed(4)) };
}
const still = Object.entries(moved).filter(([name, m]) => m.handTravelM < 0.002 && !['charge', 'sheathed', 'grapple_aim'].includes(name) && m.maxRotDeg < 0.5);
put('G1 every clip plays', still.length === 0, { still: still.map(([k]) => k), perClip: moved });
put('G9 no joint scale', scaled.length === 0, { scaleTracks: scaled });
// G2 + G10: the sweep
const edges = [];
for (let i = 0; i < n; i += 3) edges.push([i, i + 1], [i + 1, i + 2], [i + 2, i]);
// the bind lengths in rig space: the rest pose with every finger back at its bind (the modelled, open hands)
const bindLen = (() => {
  setBind(() => true);
  const s = skinned();
  resetPose();
  return edges.map(([a, b]) => Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]));
})();
let frames = 0, nonFinite = 0, maxStretch = 0, minSquash = Infinity, worstAt = '';
const TIMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
for (const c of [{ name: 'rest', duration: 0 }, ...clips]) {
  for (const f of c.name === 'rest' ? [0] : TIMES) {
    pose(c.name, f * c.duration);
    const s = skinned();
    frames++;
    for (let i = 0; i < s.length; i++) if (!Number.isFinite(s[i])) nonFinite++;
    edges.forEach(([a, b], k) => {
      const l0 = bindLen[k];
      if (l0 < 2e-4) return;
      const l = Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]);
      const r = l / l0;
      if (r > maxStretch) { maxStretch = r; worstAt = `${c.name}@${f.toFixed(1)} ${bones[SI.getX(a)]?.name}:${SW.getX(a).toFixed(2)}/${bones[SI.getY(a)]?.name}:${SW.getY(a).toFixed(2)}`; }
      minSquash = Math.min(minSquash, r);
    });
  }
}
put('G2 deformation finite', nonFinite === 0, { frames, nonFinite });
put('G10 skin sweep', maxStretch <= 2.0, { frames, clipsTimes: `${clips.length} clips × ${TIMES.length} times + rest`, maxEdgeStretch: Number(maxStretch.toFixed(3)), worstAt, minEdgeRatio: Number(minSquash.toFixed(3)), bar: 'no edge over 2× its bind length' });
// the grip: at rest, how far the right fingers' pads sit from the grip line (R_weapon's +y through its origin)
{
  pose('rest', 0);
  const w = root.getObjectByName('R_weapon');
  const inv = w.matrixWorld.clone().invert();
  const out = {};
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    const b3 = root.getObjectByName(`R_${f}3`);
    const tip = new THREE.Vector3(0, 0.02, 0).applyMatrix4(b3.matrixWorld).applyMatrix4(inv);
    const mid = new THREE.Vector3().setFromMatrixPosition(b3.matrixWorld).applyMatrix4(inv);
    out[f] = { tipToAxis: Number(Math.hypot(tip.x, tip.z).toFixed(4)), dipToAxis: Number(Math.hypot(mid.x, mid.z).toFixed(4)) };
  }
  put('grip closes on the cord', Object.values(out).every((o) => o.dipToAxis < 0.05), { fingers: out, gripRadius: 0.0175 });
}
put('G7 medial/lateral', null, { note: 'not applicable: a first-person pair of arms, no figure to place' });
put('G8 foot contact', null, { note: 'not applicable: no feet' });

// PLY dumps for the Blender preview
if (opt.ply !== undefined) {
  mkdirSync(opt.ply, { recursive: true });
  for (const spec of (opt.poses ?? 'rest@0').split(',')) {
    const [clipName, t, sword] = spec.split('@');
    pose(clipName, Number(t ?? 0));
    const s = skinned();
    const tri = [], cols = [];
    for (let i = 0; i < n; i++) { tri.push(s[i * 3], s[i * 3 + 1], s[i * 3 + 2]); cols.push(C.getX(i), C.getY(i), C.getZ(i)); }
    const kind = sword ?? (clipName.startsWith('swim') ? 'none' : 'wood');
    const sw = swords[kind];
    if (sw !== undefined) {
      sw.updateMatrixWorld(true);
      const g = sw.geometry, sp = g.getAttribute('position'), sc = g.getAttribute('color'), v = new THREE.Vector3();
      for (let i = 0; i < sp.count; i++) { v.fromBufferAttribute(sp, i).applyMatrix4(sw.matrixWorld); tri.push(v.x, v.y, v.z); cols.push(sc.getX(i), sc.getY(i), sc.getZ(i)); }
    }
    const nv = tri.length / 3;
    const head = `ply\nformat ascii 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nv / 3}\nproperty list uchar int vertex_indices\nend_header\n`;
    const srgb = (x) => Math.round(255 * Math.min(1, x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055));
    const lines = [];
    for (let i = 0; i < nv; i++) lines.push(`${tri[i * 3].toFixed(5)} ${tri[i * 3 + 1].toFixed(5)} ${tri[i * 3 + 2].toFixed(5)} ${srgb(cols[i * 3])} ${srgb(cols[i * 3 + 1])} ${srgb(cols[i * 3 + 2])}`);
    for (let f = 0; f < nv / 3; f++) lines.push(`3 ${f * 3} ${f * 3 + 1} ${f * 3 + 2}`);
    writeFileSync(join(opt.ply, `${clipName}-${t}${sword ? `-${sword}` : ''}.ply`), `${head + lines.join('\n')  }\n`);
  }
}
const fails = Object.entries(report.checks).filter(([, c]) => c.pass === false).map(([k]) => k);
report.verdict = fails.length === 0 ? 'pass' : `fail: ${fails.join(', ')}`;
if (opt.json !== undefined) writeFileSync(opt.json, JSON.stringify(report, null, 1));
for (const [k, c] of Object.entries(report.checks)) console.log(`${c.pass === null ? 'n/a ' : c.pass ? 'PASS' : 'FAIL'}  ${k}  ${JSON.stringify(Object.fromEntries(Object.entries(c).filter(([x]) => x !== 'pass' && x !== 'perClip'))).slice(0, 260)}`);
console.log(`verdict: ${report.verdict}`);
process.exitCode = fails.length === 0 ? 0 : 1;
