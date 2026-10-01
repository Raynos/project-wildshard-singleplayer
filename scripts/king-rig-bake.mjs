#!/usr/bin/env node
// king-rig-bake.mjs — the Antler King's own rig (E322 F-M1): skins his upright hull (art/pine-hollow/round-25-e322-king-rig/
// antler-king-rig[.phone].glb: codex ref → Hunyuan3D-2 full + paint → driftwood_post.py --keep-texture → the backdrop
// sheet stripped → creature-color.mjs) to his own 22-bone skeleton (KING_BONES, src/shards/pine-hollow/combat/kingRig.ts),
// in Node, no browser. Writes public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb: one mesh, the hull's
// own textures, a glTF skin whose joints are KING_BONES by name and in order, bound at the rest pose (inverse binds =
// −joint position, identity rotations — what src/engine/entities/pineCreatures.ts loads).
//
//   node --import ./scripts/bake-loader.mjs scripts/king-rig-bake.mjs [--tiers=desktop,phone] [--json=<report.json>]
//
// The hull is not re-posed: its generated stance IS the rest pose (a raised chest, planted forelimbs), so the bake only
// ADDS a skin (the img2-character rule: repair before the freeze, after it only add):
//   1. freeze   the hull's position / normal / uv / index as it loads (node transform applied): the parity baseline;
//   2. joints   measured on the hull: each limb's column (the centroid of its slice, walked up from the hoof), the joint
//               heights along it; the spine / neck / head / tail from the torso's slices and the skull (the hull's own
//               muzzle tip, the rack's base);
//   3. weights  Blender's bone heat on the welded surface (scripts/img2mesh/king_heat_weights.py): each bone's weight
//               diffused through the solid body, so the thick torso's belly stays the spine's; a crumb the heat misses
//               keeps its nearest segment's label (blended ½ / ½ at the joints); the rack is rigid on the head;
//   4. smooth   a few Laplacian passes over the welded surface (uv seams joined), never across an air gap;
//   5. keep the top 4 influences, normalised.
// The phone copy is the desktop hull simplified (meshoptimizer, the uv seams kept) to PHONE_TRIS, then baked the same way.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve as resolvePath, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { KING_BONES, KING_LIMBS } from '../src/shards/pine-hollow/combat/kingRig.ts';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const TIERS = flag('tiers', 'desktop,phone').split(',').filter(Boolean);
const SRC = resolvePath(ROOT, 'art/pine-hollow/round-25-e322-king-rig');
const OUT = resolvePath(ROOT, 'public/assets/pine-hollow/creatures');
const HULL = 'antler-king-rig';
/** the phone's triangles: today's King (the Bark Warden on the elk's bones) ships 14 k on the phone */
const PHONE_TRIS = 13000;

const cliAbs = (await import('node:fs')).realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO, Document } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
const { weld, simplify } = await import(pathToFileURL(req.resolve('@gltf-transform/functions')).href);
await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ─── 1. freeze ───
function mat4Apply(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
function normalApply(m, x, y, z) {
  // the node transforms here are translate + uniform scale (+ rotation): the upper 3×3 then renormalise
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
/** the hull's geometry as float arrays in its own space (the node's world matrix applied) */
function readHull(doc) {
  const node = doc.getRoot().listNodes().find((x) => x.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
  const n = P.getCount();
  const position = new Float32Array(n * 3), normal = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const e = [];
  for (let i = 0; i < n; i++) {
    P.getElement(i, e); position.set(mat4Apply(m, e[0], e[1], e[2]), i * 3);
    N.getElement(i, e); normal.set(normalApply(m, e[0], e[1], e[2]), i * 3);
    T.getElement(i, e); uv[i * 2] = e[0]; uv[i * 2 + 1] = e[1];
  }
  const index = Uint32Array.from(I.getArray());
  return { position, normal, uv, index, n };
}

/** an index buffer through a meshopt write + read (the triangle codec), as the rigged GLB will store it */
async function indexRoundTrip(index0, n) {
  let index = index0;
  for (let pass = 0; pass < 3; pass++) {
    const d = new Document();
    d.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const b = d.createBuffer();
    const prim = d.createPrimitive().setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(n * 3)).setBuffer(b))
      .setIndices(d.createAccessor().setType('SCALAR').setArray(n > 65535 ? index : Uint16Array.from(index)).setBuffer(b));
    d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(prim)));
    const back = Uint32Array.from((await io.readBinary(await io.writeBinary(d))).getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getArray());
    const same = back.length === index.length && back.every((v, i) => v === index[i]);
    index = back;
    if (same) return index;
  }
  throw new Error('king-rig-bake: the meshopt index round trip does not settle');
}

// ─── 2. joints ───
const V = (x, y, z) => ({ x, y, z });
/** the centroid (x, z) of the vertices in the slice |y − h| < band on side sx (x·sx > xMin), within r of `near` */
function sliceCentre(pos, n, h, band, sx, xMin, near, r) {
  let sx0 = 0, sz0 = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.abs(y - h) > band || x * sx < xMin) continue;
    if (Math.hypot(x - near.x, z - near.z) > r) continue;
    sx0 += x; sz0 += z; c++;
  }
  return c > 0 ? { x: sx0 / c, z: sz0 / c, c } : null;
}
/** a limb's column: its hoof (the lowest band on its side and end), then the slice centres walked up to `top` */
function limbColumn(pos, n, sx, front, top) {
  let hx = 0, hz = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (y < 0.14 && x * sx > 0.05 && (front ? z > 0 : z < 0)) { hx += x; hz += z; c++; }
  }
  if (c === 0) throw new Error(`king-rig-bake: no hoof at ${sx > 0 ? 'L' : 'R'} ${front ? 'front' : 'back'}`);
  const col = [{ y: 0.07, x: hx / c, z: hz / c }];
  for (let h = 0.15; h <= top + 1e-6; h += 0.05) {
    const prev = col[col.length - 1];
    const s = sliceCentre(pos, n, h, 0.035, sx, 0.02, prev, 0.3);
    if (!s) break;
    // the step is a limb's: a slice centre moving more than 12 cm sideways per 5 cm has left the limb for the body
    const jump = Math.hypot(s.x - prev.x, s.z - prev.z);
    col.push({ y: h, x: jump > 0.12 ? prev.x + (s.x - prev.x) * 0.12 / jump : s.x, z: jump > 0.12 ? prev.z + (s.z - prev.z) * 0.12 / jump : s.z });
  }
  return col;
}
const colAt = (col, y) => {
  for (let i = 1; i < col.length; i++) if (col[i].y >= y) { const a = col[i - 1], b = col[i], t = (y - a.y) / (b.y - a.y); return V(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t); }
  const l = col[col.length - 1]; return V(l.x, y, l.z);
};

/**
 * The joints (model space) from the hull. Heights are the hull's (measured by scripts/king-rig-bake.mjs --probe on the
 * slices: the forelimbs free from the ground to ~1.1 m, the chest over them to 2.6 m, the hindquarters ~1.8 m, the skull
 * 2.2–2.9 m at z 1.4–1.9, the rack above 2.75 m).
 */
function measureJoints(pos, n) {
  const J = {};
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < n; i++) { zMin = Math.min(zMin, pos[i * 3 + 2]); zMax = Math.max(zMax, pos[i * 3 + 2]); }
  // the forelimbs: hoof → wrist 0.42 → elbow 1.1 → shoulder 1.85 (inside the chest, over the column's top, pulled in)
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const fc = limbColumn(pos, n, sx, true, 1.3), bc = limbColumn(pos, n, sx, false, 1.2);
    const f0 = fc[0], ftop = colAt(fc, 1.3);
    J[`arm${s}_hoof`] = V(f0.x, 0.07, f0.z);
    J[`arm${s}_wr`] = colAt(fc, 0.42);
    J[`arm${s}_el`] = colAt(fc, 1.1);
    J[`arm${s}_sh`] = V(ftop.x * 0.8, 1.85, ftop.z - 0.05);
    
    // the hull's hind leg stands near straight from the hip to the hock: the stifle goes to the front of the thigh (ahead of
    // that line) so the leg has a bend to work with, as an elk's (the IK keeps each limb in its rest bend)
    const b0 = bc[0], btop = colAt(bc, 1.2);
    J[`leg${s}_hoof`] = V(b0.x, 0.07, b0.z);
    J[`leg${s}_hock`] = colAt(bc, 0.55);
    J[`leg${s}_hip`] = V(btop.x * 0.8, 1.5, btop.z);
    const kn = colAt(bc, 1.0), hk = J[`leg${s}_hock`], hi = J[`leg${s}_hip`];
    const lineZ = hi.z + (hk.z - hi.z) * (hi.y - 1.0) / (hi.y - hk.y);
    J[`leg${s}_knee`] = V(kn.x, 1.0, Math.max(kn.z, lineZ + 0.15));
  }
  const mid = (a, b) => V((J[a].x + J[b].x) / 2, (J[a].y + J[b].y) / 2, (J[a].z + J[b].z) / 2);
  const sh = mid('armL_sh', 'armR_sh'), hp = mid('legL_hip', 'legR_hip');
  J.hips = V(0, hp.y + 0.1, hp.z + 0.05);
  J.chest = V(0, sh.y + 0.25, sh.z - 0.05);
  J.body = V(0, (J.hips.y + J.chest.y) / 2, (J.hips.z + J.chest.z) / 2);
  // the skull: the muzzle tip is the hull's frontmost point between 1.9 and 2.8 m; the head joint sits behind it at the
  // rack's base (the skull is ~0.55 m long), the neck's base between it and the chest
  let tip = null;
  for (let i = 0; i < n; i++) { const y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (y > 1.9 && y < 2.8 && Math.abs(pos[i * 3]) < 0.3 && (!tip || z > tip.z)) tip = V(pos[i * 3], y, z); }
  J.head = V(0, tip.y + 0.25, tip.z - 0.55);
  J.neck = V(0, (J.head.y + J.chest.y) / 2 + 0.05, (J.head.z + J.chest.z) / 2);
  J.tail = V(0, J.hips.y + 0.15, zMin + 0.3);
  return { J, muzzle: tip, zMin, zMax };
}

// ─── 3. label, 4. smooth, 5. top four ───
const segDist = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / Math.max(1e-9, abx * abx + aby * aby + abz * abz)));
  return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t);
};
function skin(h, J, extra) {
  const names = KING_BONES.map((b) => b.name), NB = names.length, bi = (nm) => names.indexOf(nm);
  // each bone's segment, and the bones at its two ends (the joint blends): a limb bone runs to its child, a leaf out to
  // where the hull ends; the torso is hips (the rump) · body (hips → chest) · chest (→ the neck)
  const rump = V(0, J.hips.y + 0.05, extra.zMin + 0.3);
  const SEG = {
    body: [J.hips, J.chest, 'hips', 'chest'], hips: [J.hips, rump, 'body', null], chest: [J.chest, J.neck, 'body', 'neck'],
    neck: [J.neck, J.head, 'chest', 'head'], head: [J.head, extra.muzzle, 'neck', null], tail: [J.tail, V(0, J.tail.y - 0.25, extra.zMin), 'hips', null],
  };
  for (const [a0, b0, c0, d0] of KING_LIMBS) {
    const top = a0.startsWith('arm') ? 'chest' : 'hips';
    SEG[a0] = [J[a0], J[b0], top, b0]; SEG[b0] = [J[b0], J[c0], a0, c0]; SEG[c0] = [J[c0], J[d0], b0, d0];
    SEG[d0] = [J[d0], V(J[d0].x, 0, J[d0].z + (a0.startsWith('arm') ? 0.18 : 0.14)), c0, null];
  }
  const segs = names.map((nm) => SEG[nm]);
  const side = names.map((nm) => (/(arm|leg)L_/.test(nm) ? 1 : /(arm|leg)R_/.test(nm) ? -1 : 0));
  const { position: pos, n } = h;
  const W = new Float32Array(n * NB), label = new Int32Array(n);
  const rackY = J.head.y + 0.2, head = bi('head');
  /** the rack: above the skull and either ahead of the neck or out past the hump (its beams spread wide) */
  const inRack = (q) => q.y > rackY && (q.z > J.neck.z + 0.05 || Math.abs(q.x) > 0.45);
  const p = { x: 0, y: 0, z: 0 };
  const segT = (q, a, c) => { const abx = c.x - a.x, aby = c.y - a.y, abz = c.z - a.z; return Math.max(0, Math.min(1, ((q.x - a.x) * abx + (q.y - a.y) * aby + (q.z - a.z) * abz) / Math.max(1e-9, abx * abx + aby * aby + abz * abz))); };
  const sm = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  const TAU = 0.35;
  /** each limb bone's reach from its segment (m): the hull's limb radius there, measured off the slices */
  const LIMB_R = { sh: 0.45, el: 0.36, wr: 0.3, hoof: 0.3, hip: 0.42, knee: 0.33, hock: 0.28 };
  for (let i = 0; i < n; i++) {
    p.x = pos[i * 3]; p.y = pos[i * 3 + 1]; p.z = pos[i * 3 + 2];
    let best = -1, bd = Infinity;
    if (inRack(p)) best = head;   // the rack: rigid on the head
    else for (let b = 0; b < NB; b++) {
      if (side[b] !== 0 && p.x * side[b] < -0.04) continue;   // a limb never reaches over the midline
      const [a, c] = segs[b];
      const d = segDist(p, a, c);
      // a limb bone only claims its own cylinder (the thick torso's belly and flanks are the spine's, not a thigh's);
      // the spine's segments run along his back, so they win a tie
      if (side[b] !== 0 && d > (LIMB_R[names[b].split('_')[1]] ?? 0.3)) continue;
      const dd = d * (side[b] === 0 ? 0.85 : 1);
      if (dd < bd) { bd = dd; best = b; }
    }
    label[i] = best;
    // the joint blend: near either end of its segment a vertex shares with the bone across that joint (½ at the joint)
    const [a, c, s0, s1] = segs[best];
    const t = best === head && p.y > rackY ? 1 : segT(p, a, c);
    let wb = 1;
    if (s0 && t < TAU) { const w = 0.5 * (1 - sm(t / TAU)); W[i * NB + bi(s0)] += w; wb -= w; }
    if (s1 && t > 1 - TAU) { const w = 0.5 * (1 - sm((1 - t) / TAU)); W[i * NB + bi(s1)] += w; wb -= w; }
    W[i * NB + best] += wb;
  }
  // weld by position (uv seams join) for the surface adjacency
  const key = new Map(), weldId = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    let w = key.get(k); if (w === undefined) { w = key.size; key.set(k, w); } weldId[i] = w;
  }
  const NW = key.size, nbr = Array.from({ length: NW }, () => new Set());
  const idx = h.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = weldId[idx[t]], b = weldId[idx[t + 1]], c = weldId[idx[t + 2]];
    nbr[a].add(b); nbr[a].add(c); nbr[b].add(a); nbr[b].add(c); nbr[c].add(a); nbr[c].add(b);
  }
  let WW = new Float32Array(NW * NB);
  const cnt = new Float32Array(NW);
  for (let i = 0; i < n; i++) { const w = weldId[i]; cnt[w]++; for (let b = 0; b < NB; b++) WW[w * NB + b] += W[i * NB + b]; }
  for (let w = 0; w < NW; w++) for (let b = 0; b < NB; b++) WW[w * NB + b] /= cnt[w];
  // bone heat (Blender's automatic weights, scripts/img2mesh/king_heat_weights.py) on the welded surface: the weights
  // diffuse through the body from each bone, so the thick torso's belly and flanks stay the spine's. A vertex the heat
  // leaves unweighted (a loose crumb) keeps the segment labels above; the rack stays rigid on the head
  const wp = new Float32Array(NW * 3);
  for (let i = 0; i < n; i++) wp.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], weldId[i] * 3);
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) { const a = weldId[idx[t]], b = weldId[idx[t + 1]], c = weldId[idx[t + 2]]; if (a !== b && b !== c && a !== c) tris.push(a, b, c); }
  const heatIn = join(tmpdir(), `king-heat-${process.pid}-in.json`), heatOut = join(tmpdir(), `king-heat-${process.pid}-out.json`);
  writeFileSync(heatIn, JSON.stringify({ positions: Array.from(wp, (v) => Number(v.toFixed(6))), tris, bones: names.map((nm) => ({ name: nm, parent: KING_BONES.find((b) => b.name === nm)?.parent ?? null, head: [segs[bi(nm)][0].x, segs[bi(nm)][0].y, segs[bi(nm)][0].z], tail: [segs[bi(nm)][1].x, segs[bi(nm)][1].y, segs[bi(nm)][1].z] })) }));
  execFileSync('blender', ['-b', '--factory-startup', '--python-exit-code', '1', '-P', resolvePath(ROOT, 'scripts/img2mesh/king_heat_weights.py'), '--', heatIn, heatOut], { stdio: 'pipe' });
  const heat = JSON.parse(readFileSync(heatOut, 'utf8'));
  let heated = 0;
  heat.weights.forEach((ws, w) => {
    if (ws.length === 0) return;
    const sum = ws.reduce((s2, [, v]) => s2 + v, 0);
    if (sum <= 1e-6) return;
    heated++;
    for (let b = 0; b < NB; b++) WW[w * NB + b] = 0;
    for (const [b, v] of ws) WW[w * NB + b] = v / sum;
  });
  // the rack's tines, well clear of the skull, are the head's alone (the heat can leak a little neck into a long beam);
  // nearer the skull the heat's own blend stands
  for (let i = 0; i < n; i++) if (inRack({ x: pos[i * 3], y: pos[i * 3 + 1] - 0.3, z: pos[i * 3 + 2] })) { const w = weldId[i]; for (let b = 0; b < NB; b++) WW[w * NB + b] = b === head ? 1 : 0; }
  console.log(`  bone heat: ${heated} / ${NW} welded vertices weighted (${heat.unweighted} left to the segment labels)`);
  const PASSES = 6;
  const pinned = new Uint8Array(NW);
  for (let i = 0; i < n; i++) if (inRack({ x: pos[i * 3], y: pos[i * 3 + 1] - 0.4, z: pos[i * 3 + 2] })) pinned[weldId[i]] = 1;
  for (let pass = 0; pass < PASSES; pass++) {
    const next = new Float32Array(NW * NB);
    for (let w = 0; w < NW; w++) {
      const nb = nbr[w];
      if (pinned[w] || nb.size === 0) { for (let b = 0; b < NB; b++) next[w * NB + b] = WW[w * NB + b]; continue; }
      // each neighbour weighed by 1 / (edge length + 8 mm): a generator's millimetre edges pull their ends together
      // hard (a steep weight step across one would stretch it several times over), the long edges barely spread
      let ks = 0;
      for (const o of nb) ks += 1 / (Math.hypot(wp[o * 3] - wp[w * 3], wp[o * 3 + 1] - wp[w * 3 + 1], wp[o * 3 + 2] - wp[w * 3 + 2]) + 0.008);
      for (let b = 0; b < NB; b++) {
        let s = 0;
        for (const o of nb) s += WW[o * NB + b] / (Math.hypot(wp[o * 3] - wp[w * 3], wp[o * 3 + 1] - wp[w * 3 + 1], wp[o * 3 + 2] - wp[w * 3 + 2]) + 0.008);
        next[w * NB + b] = 0.5 * WW[w * NB + b] + 0.5 * s / ks;
      }
    }
    WW = next;
    // the GPU keeps four influences: cut each vertex to its top four every pass, so the last cut changes little and
    // two neighbours never differ by a dropped fifth bone (that step stretched the throat 2×)
    for (let w = 0; w < NW; w++) {
      const o = w * NB, top = [];
      for (let b = 0; b < NB; b++) if (WW[o + b] > 0) top.push([WW[o + b], b]);
      if (top.length <= 4) continue;
      top.sort((x, y) => y[0] - x[0]);
      const keepB = new Set(top.slice(0, 4).map((e) => e[1]));
      let sum = 0; for (let b = 0; b < NB; b++) { if (!keepB.has(b)) WW[o + b] = 0; sum += WW[o + b]; }
      for (let b = 0; b < NB; b++) WW[o + b] /= sum;
    }
  }
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const counts = Object.fromEntries(names.map((nm) => [nm, 0]));
  for (let i = 0; i < n; i++) {
    const w = weldId[i];
    const top = [];
    for (let b = 0; b < NB; b++) { const v = WW[w * NB + b]; if (v > 1e-4) top.push([v, b]); }
    top.sort((a, b) => b[0] - a[0]);
    const k = top.slice(0, 4);
    const sum = k.reduce((s, [v]) => s + v, 0);
    // weights in steps of 2^-16: exact in float32 and float64 alike, so Σw is exactly 1 (G4) and the rest pose skins
    // back onto the bind mesh bit for bit (G3); the first takes the rounding remainder
    const q = k.map(([v]) => Math.round((v / sum) * 65536));
    q[0] += 65536 - q.reduce((s2, v) => s2 + v, 0);
    for (let j = 0; j < 4; j++) {
      const e = k[j];
      const qj = q[j] ?? 0;
      if (j >= k.length || qj <= 0) { skinIndex[i * 4 + j] = 0; skinWeight[i * 4 + j] = 0; continue; }
      skinIndex[i * 4 + j] = e[1];
      skinWeight[i * 4 + j] = qj / 65536;
    }
    counts[names[k[0][1]]]++;
  }
  return { skinIndex, skinWeight, counts, welded: NW };
}

/** a tier's weights from another tier's skin: each vertex takes its nearest source vertex's four influences */
function transferSkin(h, src) {
  const CELL = 0.05, grid = new Map(), key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  const sp = src.position, sn = sp.length / 3;
  for (let i = 0; i < sn; i++) { const k = key(sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(i); }
  const skinIndex = new Uint16Array(h.n * 4), skinWeight = new Float32Array(h.n * 4);
  let far = 0;
  for (let i = 0; i < h.n; i++) {
    const x = h.position[i * 3], y = h.position[i * 3 + 1], z = h.position[i * 3 + 2];
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    for (let r = 0; best < 0 && r < 8; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
        for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) { const d = (sp[j * 3] - x) ** 2 + (sp[j * 3 + 1] - y) ** 2 + (sp[j * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = j; } }
      }
    }
    if (Math.sqrt(bd) > 1e-4) far++;
    for (let k = 0; k < 4; k++) { skinIndex[i * 4 + k] = src.skinIndex[best * 4 + k]; skinWeight[i * 4 + k] = src.skinWeight[best * 4 + k]; }
  }
  const names = KING_BONES.map((b) => b.name), counts = Object.fromEntries(names.map((nm) => [nm, 0]));
  for (let i = 0; i < h.n; i++) { let m = 0; for (let k = 1; k < 4; k++) if (skinWeight[i * 4 + k] > skinWeight[i * 4 + m]) m = k; counts[names[skinIndex[i * 4 + m]]]++; }
  console.log(`  weights from the desktop skin (${far} of ${h.n} vertices off a desktop position)`);
  return { skinIndex, skinWeight, counts, welded: 0 };
}

// ─── the GLB ───
async function writeRigged(srcDoc, h, sk, J, out) {
  const srcMat = srcDoc.getRoot().listMaterials()[0] ?? null;
  const srcBase = srcMat?.getBaseColorTexture() ?? null, srcNormal = srcMat?.getNormalTexture() ?? null;
  const doc = new Document();
  // QUANTIZE: no lossy filter in the meshopt stream (the arrays are already what ships: float positions, int8 normals)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  if ([srcBase, srcNormal].some((t) => t?.getMimeType() === 'image/webp')) doc.createExtension(ALL_EXTENSIONS.find((E) => E.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
  const buf = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const joints = new Uint8Array(h.n * 4); for (let i = 0; i < h.n * 4; i++) joints[i] = sk.skinIndex[i];
  const index = h.n > 65535 ? h.index : Uint16Array.from(h.index);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', h.position)).setAttribute('NORMAL', acc('VEC3', h.normal).setNormalized(true)).setAttribute('TEXCOORD_0', acc('VEC2', h.uv))
    .setAttribute('JOINTS_0', acc('VEC4', joints)).setAttribute('WEIGHTS_0', acc('VEC4', sk.skinWeight)).setIndices(acc('SCALAR', index));
  const mat = doc.createMaterial(`${HULL}-coat`).setMetallicFactor(0).setRoughnessFactor(srcMat?.getRoughnessFactor() ?? 0.9);
  const copyTex = (t) => doc.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType());
  if (srcBase) mat.setBaseColorTexture(copyTex(srcBase));
  if (srcNormal) mat.setNormalTexture(copyTex(srcNormal));
  prim.setMaterial(mat);
  const mesh = doc.createMesh(`${HULL}.rigged`).addPrimitive(prim);
  const nodes = new Map();
  for (const bd of KING_BONES) {
    const p = bd.parent ? J[bd.parent] : null, a = J[bd.name];
    const node = doc.createNode(bd.name).setTranslation(p ? [a.x - p.x, a.y - p.y, a.z - p.z] : [a.x, a.y, a.z]);
    nodes.set(bd.name, node);
    if (bd.parent) nodes.get(bd.parent).addChild(node);
  }
  const ibm = new Float32Array(KING_BONES.length * 16);
  KING_BONES.forEach((bd, i) => { const o = i * 16, a = J[bd.name]; ibm[o] = ibm[o + 5] = ibm[o + 10] = ibm[o + 15] = 1; ibm[o + 12] = -a.x; ibm[o + 13] = -a.y; ibm[o + 14] = -a.z; });
  const skinDef = doc.createSkin('antler-king').setInverseBindMatrices(acc('MAT4', ibm)).setSkeleton(nodes.get('body'));
  for (const bd of KING_BONES) skinDef.addJoint(nodes.get(bd.name));
  const meshNode = doc.createNode(`${HULL}.rigged`).setMesh(mesh).setSkin(skinDef);
  doc.createScene(HULL).addChild(nodes.get('body')).addChild(meshNode);
  doc.getRoot().getAsset().generator = 'wildshard scripts/king-rig-bake.mjs';
  doc.getRoot().getAsset().extras = { kingRig: { counts: sk.counts } };
  await io.write(out, doc);
  return statSync(out).size;
}

const report = {};
for (const tier of TIERS) {
  const doc = await io.read(resolvePath(SRC, `${HULL}${tier === 'phone' ? '.phone' : ''}.glb`));
  if (tier === 'phone') {
    const tris = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
    if (tris > PHONE_TRIS) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: PHONE_TRIS / tris, error: 0.02 }));
  }
  const h = readHull(doc);
  // repair before the freeze: the normals as the GLB carries them, int8 normalised (KHR_mesh_quantization; the meshopt
  // stream is then lossless), so the written file's buffers are the freeze's, byte for byte (G11)
  h.normal = Int8Array.from(h.normal, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127));
  // and the index buffer as meshopt's triangle codec hands it back (it may rotate a triangle's corners, winding kept)
  h.index = await indexRoundTrip(h.index, h.n);
  // the joints are measured once, on the desktop hull, so both tiers share one skeleton
  report.joints ??= measureJoints(h.position, h.n);
  const { J, muzzle, zMin } = report.joints;
  // the phone hull is the desktop's simplified (meshopt keeps original vertex positions): it takes the desktop's weights,
  // vertex by vertex (the nearest desktop vertex), so both tiers bend alike and the phone's longer edges inherit the
  // desktop's smooth blends instead of a coarser heat solve of their own
  const sk = tier === 'phone' && report.desktopSkin ? transferSkin(h, report.desktopSkin) : skin(h, J, { muzzle, zMin });
  if (tier === 'desktop') report.desktopSkin = { position: h.position, skinIndex: sk.skinIndex, skinWeight: sk.skinWeight };
  const out = resolvePath(OUT, `${HULL}${tier === 'phone' ? '.phone' : ''}.rigged.glb`);
  const bytes = await writeRigged(doc, h, sk, J, out);
  // the freeze: the buffers the gate compares the written GLB against (G11 mesh parity)
  const freeze = resolvePath(SRC, `freeze-${tier}.json`);
  const hash = async (a) => (await import('node:crypto')).createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
  writeFileSync(freeze, JSON.stringify({ tier, vertices: h.n, position: await hash(h.position), normal: await hash(h.normal), uv: await hash(h.uv), index: await hash(h.index) }, null, 1));
  report[tier] = { tris: h.index.length / 3, verts: h.n, welded: sk.welded, bytes, counts: sk.counts };
  console.log(`${HULL} ${tier}: ${h.index.length / 3} tris, ${h.n} verts, ${(bytes / 1024).toFixed(0)} KB → ${out.slice(ROOT.length + 1)}`);
}
delete report.desktopSkin;
const jr = Object.fromEntries(Object.entries(report.joints.J).map(([k, v]) => [k, [v.x, v.y, v.z].map((x) => Number(x.toFixed(3)))]));
console.log(JSON.stringify(jr));
const json = flag('json', '');
if (json) writeFileSync(json, JSON.stringify({ ...report, joints: jr }, null, 1));
