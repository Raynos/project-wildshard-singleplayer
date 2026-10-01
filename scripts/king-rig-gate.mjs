#!/usr/bin/env node
// king-rig-gate.mjs — the rig gate of the Antler King's own rig (E322 F-M1; the img2-character twelve checks, as
// .claude/skills/mockup-to-model ▸ 4 and scripts/blender/driftwood-isle/fp-arms/gate.mjs run them). Loads a rigged GLB
// (public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb), builds the skeleton the way the game does
// (the joints at their GLB positions, `updateMatrixWorld(true)` then `new THREE.Skeleton` computing the inverses), poses
// every clip of src/shards/pine-hollow/combat/kingRig.ts at sampled times through the SAME functions the game's animate
// calls (clipPose → applyKingPose), skins the mesh on the CPU (three's applyBoneTransform) and measures. An unmeasured
// check is never a pass: each check reports its numbers, and an absent input is `unevaluated`.
//
//   node --import ./scripts/bake-loader.mjs scripts/king-rig-gate.mjs [--tier=desktop|phone] [--json=<out.json>]
//        [--sheet=<out.jpg>]   (a pose sheet: every clip at 4 times, 3 views, software-rendered)
//
// G1  binding reaches node — every clip, ≥ 5 times: the matrix the skin uploads (skeleton.boneMatrices) equals the posed
//     bone's matrixWorld × inverse (relative Δ ≤ 2⁻²³), and the clip moves its bones (max joint turn from rest) and the mesh
// G2  deformation finite — every vertex of every sampled frame skinned, all finite
// G3  bind restore — every bone back to rest after the sweep: the skinned mesh against the bind mesh, max Δ ≤ 1e-12 × H
// G4  weights normalised — |1 − Σw| ≤ 2e-7 every vertex        G5 indices in range — max JOINTS_0 ≤ joints − 1
// G6  every visible mesh bound — the GLB's meshes, skinned / all
// G7  medial / lateral — every L anchor x > 0 > every R anchor x
// G8  foot contact — in stance (the gait's own stance window; every hoof in idle / sweep / hit, the hind hooves in the
//     strike), the hoof's ground-frame slide (the root advancing at the clip's stride) ≤ 0.01 H
// G9  no joint scale — every bone's scale 1 in every sample
// G10 skin integrity sweep — background seen through a split: (a) the welded copies of one surface point (uv seams)
//     skinned apart, max gap; (b) in a 3-view raster of every 3rd sample, the pixels the mesh covers with no front face
//     (the single-sided material shows the background there: a tear or an inverted fold; regions from 3 px, below that
//     it is the raster's aliasing) against the rest pose's (the baseline); (c) the longest edge stretch, ≤ 2×
// G11 mesh parity — the GLB's position / normal / uv / index buffers byte-identical to the bake's freeze
// G12 rig reference — the skin's joints are KING_BONES by name and in order, every bone the clips pose is one of them,
//     the inverse binds match the joints' positions
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { KING_BONES, KING_LIMBS, KING_CLIP_NAMES, KING_GAITS, kingRest, clipPose, applyKingPose, newPose } from '../src/shards/pine-hollow/combat/kingRig.ts';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const TIER = flag('tier', 'desktop');
const FILE = resolvePath(ROOT, `public/assets/pine-hollow/creatures/antler-king-rig${TIER === 'phone' ? '.phone' : ''}.rigged.glb`);
const FREEZE = resolvePath(ROOT, `art/pine-hollow/round-25-e322-king-rig/freeze-${TIER}.json`);

const cliAbs = (await import('node:fs')).realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
const sharp = req('sharp');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// ─── load: the GLB's arrays, its skin, its node tree ───
const doc = await io.read(FILE);
const meshNodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
const skinNode = meshNodes.find((n) => n.getSkin());
if (!skinNode) throw new Error('no skinned mesh node');
const prim = skinNode.getMesh().listPrimitives()[0];
const arr = (acc) => { const n = acc.getCount(), k = acc.getElementSize(), out = new Float64Array(n * k), e = []; for (let i = 0; i < n; i++) { acc.getElement(i, e); for (let c = 0; c < k; c++) out[i * k + c] = e[c]; } return out; };
const raw = (acc) => acc.getArray();
const POS = arr(prim.getAttribute('POSITION')), JNT = arr(prim.getAttribute('JOINTS_0')), WGT = arr(prim.getAttribute('WEIGHTS_0'));
const IDX = Array.from(prim.getIndices().getArray());
const NV = POS.length / 3;
const skinDef = skinNode.getSkin();
const jointNodes = skinDef.listJoints();
const jointNames = jointNodes.map((n) => n.getName());
const ibm = arr(skinDef.getInverseBindMatrices());

// the skeleton, as the game builds it: bones at the joints' positions (parent-relative), identity rest rotations
const bones = {};
for (const jn of jointNodes) { const b = new THREE.Bone(); b.name = jn.getName(); const t = jn.getTranslation(); b.position.set(t[0], t[1], t[2]); bones[b.name] = b; }
for (const jn of jointNodes) { const p = jn.getParentNode(); if (p && bones[p.getName()]) bones[p.getName()].add(bones[jn.getName()]); }
const boneList = jointNames.map((n) => bones[n]);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(POS), 3));
geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(JNT), 4));
geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(WGT), 4));
geo.setIndex(IDX);
const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
const rootBone = bones.body;
mesh.add(rootBone);
mesh.updateMatrixWorld(true);                 // before the Skeleton: its inverses read the bones' world matrices (rule 4)
const skeleton = new THREE.Skeleton(boneList);
mesh.bind(skeleton, new THREE.Matrix4());     // attached mode at identity (rule 3)
const restQ = boneList.map((b) => b.quaternion.clone()), restP = boneList.map((b) => b.position.clone());
const rest = kingRest(bones);
let H = 0; for (let i = 0; i < NV; i++) H = Math.max(H, POS[i * 3 + 1]);

const resetPose = () => boneList.forEach((b, i) => { b.quaternion.copy(restQ[i]); b.position.copy(restP[i]); b.scale.set(1, 1, 1); });
const pose = newPose();
function poseClip(clip, x) { resetPose(); applyKingPose(rest, clipPose(pose, rest, clip, x, x)); mesh.updateMatrixWorld(true); skeleton.update(); }
const _v = new THREE.Vector3();
function skinned() { const out = new Float64Array(NV * 3); for (let i = 0; i < NV; i++) { _v.set(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]); mesh.applyBoneTransform(i, _v); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; } return out; }

// ─── the sweep: every clip at its sample times ───
const WALKS = { walk: { stride: rest.walkStride, ...KING_GAITS.walk }, charge: { stride: rest.chargeStride, ...KING_GAITS.charge } };
const SAMPLES = 24;
const samplesOf = (clip) => Array.from({ length: SAMPLES }, (_, k) => (clip === 'idle' ? k * 0.5 : k / (SAMPLES - 1)) * (clip === 'walk' || clip === 'charge' ? (SAMPLES - 1) / SAMPLES : 1));
const report = { file: FILE.slice(ROOT.length + 1), tier: TIER, vertices: NV, triangles: IDX.length / 3, joints: jointNames.length, H: Number(H.toFixed(3)), clips: [...KING_CLIP_NAMES], checks: {} };
const put = (id, status, detail) => { report.checks[id] = { status, ...detail }; };

// G4 / G5 (the binding)
let wErr = 0, maxIdx = 0;
for (let i = 0; i < NV; i++) {
  // Σw in float32, as the GPU sums it
  let s = Math.fround(0); for (let k = 0; k < 4; k++) s = Math.fround(s + Math.fround(WGT[i * 4 + k]));
  wErr = Math.max(wErr, Math.abs(1 - s));
  for (let k = 0; k < 4; k++) if (WGT[i * 4 + k] > 0) maxIdx = Math.max(maxIdx, JNT[i * 4 + k]);
}
put('G4 weights normalised', wErr <= 2e-7 ? 'pass' : 'fail', { maxError: wErr, criterion: '|1 - sum(w)| <= 2e-7 every vertex' });
put('G5 indices in range', maxIdx <= jointNames.length - 1 ? 'pass' : 'fail', { maxSkinIndex: maxIdx, joints: jointNames.length });
// G6
const visible = meshNodes.length, skinnedCount = meshNodes.filter((n) => n.getSkin()).length;
put('G6 every visible mesh bound', visible === skinnedCount ? 'pass' : 'fail', { visibleMeshCount: visible, visibleSkinnedMeshCount: skinnedCount, note: 'the GLB; in the game the lanterns and the ribcage are children of the head / chest bones (dressAntlerKing)' });
// G7
const Lx = [], Rx = [];
for (const n of jointNames) { const w = rest.at[n]; if (/L_/.test(n)) Lx.push([n, w.x]); if (/R_/.test(n)) Rx.push([n, w.x]); }
const minL = Math.min(...Lx.map((e) => e[1])), maxR = Math.max(...Rx.map((e) => e[1]));
put('G7 medial/lateral', Lx.length > 0 && Rx.length > 0 && minL > 0 && maxR < 0 ? 'pass' : 'fail', { leftAnchors: Lx.length, minLeftX: Number(minL.toFixed(3)), rightAnchors: Rx.length, maxRightX: Number(maxR.toFixed(3)) });
// G12
const namesOk = jointNames.length === KING_BONES.length && KING_BONES.every((b, i) => jointNames[i] === b.name);
const posed = new Set(['body', 'hips', 'tail', 'chest', 'neck', 'head', ...KING_LIMBS.flat()]);
const missing = [...posed].filter((n) => !jointNames.includes(n));
let ibmErr = 0;
jointNames.forEach((n, i) => { const w = rest.at[n]; ibmErr = Math.max(ibmErr, Math.abs(ibm[i * 16 + 12] + w.x), Math.abs(ibm[i * 16 + 13] + w.y), Math.abs(ibm[i * 16 + 14] + w.z)); for (const k of [0, 5, 10, 15]) ibmErr = Math.max(ibmErr, Math.abs(ibm[i * 16 + k] - 1)); });
put('G12 rig reference', namesOk && missing.length === 0 && ibmErr < 1e-5 * H ? 'pass' : 'fail', { jointsMatchKingBones: namesOk, bonesPosedNotInSkin: missing, maxInverseBindVsJointError: ibmErr });
// G11
let parity;
try {
  const fz = JSON.parse(readFileSync(FREEZE, 'utf8'));
  const h = (a, T) => { const t = T.from(a); return createHash('sha256').update(Buffer.from(t.buffer, t.byteOffset, t.byteLength)).digest('hex'); };
  const got = { position: h(raw(prim.getAttribute('POSITION')), Float32Array), normal: h(raw(prim.getAttribute('NORMAL')), Int8Array), uv: h(raw(prim.getAttribute('TEXCOORD_0')), Float32Array), index: h(IDX, Uint32Array) };
  const same = Object.fromEntries(Object.keys(got).map((k) => [k, got[k] === fz[k]]));
  parity = { status: Object.values(same).every(Boolean) && fz.vertices === NV ? 'pass' : 'fail', detail: { freeze: FREEZE.slice(ROOT.length + 1), identical: same } };
} catch (e) { parity = { status: 'unevaluated', detail: { reason: `no freeze manifest: ${String(e).slice(0, 120)}` } }; }
put('G11 mesh parity', parity.status, parity.detail);

// the welded groups (G10a): vertices sharing a position
const weld = new Map(), wid = new Int32Array(NV);
for (let i = 0; i < NV; i++) { const k = `${POS[i * 3]},${POS[i * 3 + 1]},${POS[i * 3 + 2]}`; let w = weld.get(k); if (w === undefined) { w = weld.size; weld.set(k, w); } wid[i] = w; }
const firstOf = new Int32Array(weld.size).fill(-1);
// edges (G10c)
const edges = new Set();
for (let t = 0; t < IDX.length; t += 3) for (const [a, b] of [[IDX[t], IDX[t + 1]], [IDX[t + 1], IDX[t + 2]], [IDX[t + 2], IDX[t]]]) edges.add(a < b ? a * NV + b : b * NV + a);
const E = Array.from(edges, (e) => [Math.floor(e / NV), e % NV]);
const restLen = E.map(([a, b]) => Math.hypot(POS[a * 3] - POS[b * 3], POS[a * 3 + 1] - POS[b * 3 + 1], POS[a * 3 + 2] - POS[b * 3 + 2]));

// the silhouette raster (G10b + the sheet): orthographic, 3 azimuths, z-buffered, Lambert-shaded
const RS = 200, AZ = [90, 30, -30].map((d) => (d * Math.PI) / 180);
function raster(P, az, withImage) {
  const c = Math.cos(az), s = Math.sin(az), scale = RS / (1.25 * H), cx = RS / 2, cy = RS * 0.92;
  const zb = new Float32Array(RS * RS).fill(-Infinity), img = withImage ? new Uint8Array(RS * RS).fill(235) : null;
  const front = new Uint8Array(RS * RS);   // a front face covers the pixel (the game's material is single-sided)
  const X = new Float32Array(NV), Y = new Float32Array(NV), Z = new Float32Array(NV);
  for (let i = 0; i < NV; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; X[i] = cx + (x * c - z * s) * scale; Y[i] = cy - y * scale; Z[i] = x * s + z * c; }
  for (let t = 0; t < IDX.length; t += 3) {
    const a = IDX[t], b = IDX[t + 1], d = IDX[t + 2];
    const minX = Math.max(0, Math.floor(Math.min(X[a], X[b], X[d]))), maxX = Math.min(RS - 1, Math.ceil(Math.max(X[a], X[b], X[d])));
    const minY = Math.max(0, Math.floor(Math.min(Y[a], Y[b], Y[d]))), maxY = Math.min(RS - 1, Math.ceil(Math.max(Y[a], Y[b], Y[d])));
    const area = (X[b] - X[a]) * (Y[d] - Y[a]) - (X[d] - X[a]) * (Y[b] - Y[a]);
    if (Math.abs(area) < 1e-9) continue;
    let shade = 0;
    if (img) {
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[d * 3] - P[a * 3], vy = P[d * 3 + 1] - P[a * 3 + 1], vz = P[d * 3 + 2] - P[a * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      shade = Math.round(40 + 170 * Math.abs(nx * 0.4 + ny * 0.75 + nz * 0.5));
    }
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w0 = ((X[b] - qx) * (Y[d] - qy) - (X[d] - qx) * (Y[b] - qy)) / area, w1 = ((X[d] - qx) * (Y[a] - qy) - (X[a] - qx) * (Y[d] - qy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * Z[a] + w1 * Z[b] + w2 * Z[d], o = py * RS + px;
      if (area < 0) front[o] = 1;
      if (z > zb[o]) { zb[o] = z; if (img) img[o] = area < 0 ? shade : 255; }
    }
  }
  // background seen through the skin: covered by the mesh, but by no front face (a torn or inverted surface)
  // (a see-through speck of 1–2 pixels is the raster's own aliasing — a back face's pixel centre inside, its front
  // twin's shared edge missing it by rounding; idle, which bends nothing, shows them — so a region counts from 3 pixels)
  const see = new Uint8Array(RS * RS);
  for (let o = 0; o < RS * RS; o++) if (zb[o] !== -Infinity && !front[o]) see[o] = 1;
  let holes = 0;
  const lab = new Uint8Array(RS * RS), st = [];
  for (let o = 0; o < RS * RS; o++) {
    if (!see[o] || lab[o]) continue;
    const region = []; lab[o] = 1; st.push(o);
    while (st.length > 0) { const q = st.pop(), x = q % RS, y = (q - x) / RS; region.push(q); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= RS || ny >= RS) continue; const r = ny * RS + nx; if (see[r] && !lab[r]) { lab[r] = 1; st.push(r); } } }
    if (region.length >= 3) { holes += region.length; if (img) for (const q of region) img[q] = 0; }
  }
  return { holes, img };
}

resetPose(); mesh.updateMatrixWorld(true); skeleton.update();
const bindSk = skinned();
const baseline = AZ.map((az) => raster(bindSk, az, false).holes);
const clipsOut = {}, sheet = [];
let g1Delta = 0, g2Bad = 0, g2Count = 0, g9Max = 0, splitMax = 0, stretchMax = 0, stretchAt = '', holesWorst = 0, holesAt = '';
const HOOVES = KING_LIMBS.map((c) => c[3]);
const hoofW = (n) => { const b = bones[n]; return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); };
for (const clip of KING_CLIP_NAMES) {
  const xs = samplesOf(clip);
  let maxTurn = 0, maxMove = 0, clipStretch = 0, clipSee = 0;
  const feet = HOOVES.map(() => []);
  for (const [k, x] of xs.entries()) {
    poseClip(clip, x);
    // G1: the uploaded matrices vs matrixWorld × inverse, recomputed in float64
    const m = new THREE.Matrix4();
    boneList.forEach((b, i) => {
      m.multiplyMatrices(b.matrixWorld, skeleton.boneInverses[i]);
      for (let e = 0; e < 16; e++) g1Delta = Math.max(g1Delta, Math.abs(skeleton.boneMatrices[i * 16 + e] - m.elements[e]) / Math.max(1, Math.abs(m.elements[e])));
      maxTurn = Math.max(maxTurn, 2 * Math.acos(Math.min(1, Math.abs(b.quaternion.dot(restQ[i])))));
      g9Max = Math.max(g9Max, Math.abs(b.scale.x - 1), Math.abs(b.scale.y - 1), Math.abs(b.scale.z - 1));
    });
    const S = skinned();
    for (let i = 0; i < NV * 3; i++) { g2Count++; if (!Number.isFinite(S[i])) g2Bad++; }
    for (let i = 0; i < NV; i++) maxMove = Math.max(maxMove, Math.hypot(S[i * 3] - bindSk[i * 3], S[i * 3 + 1] - bindSk[i * 3 + 1], S[i * 3 + 2] - bindSk[i * 3 + 2]));
    // G10a: welded copies apart
    firstOf.fill(-1);
    for (let i = 0; i < NV; i++) { const w = wid[i], f = firstOf[w]; if (f < 0) firstOf[w] = i; else splitMax = Math.max(splitMax, Math.hypot(S[i * 3] - S[f * 3], S[i * 3 + 1] - S[f * 3 + 1], S[i * 3 + 2] - S[f * 3 + 2])); }
    // G10c: edge stretch
    E.forEach(([a, b], e) => { if (restLen[e] < 1e-4) return; const r = Math.hypot(S[a * 3] - S[b * 3], S[a * 3 + 1] - S[b * 3 + 1], S[a * 3 + 2] - S[b * 3 + 2]) / restLen[e]; if (r > clipStretch) clipStretch = r; if (r > stretchMax) { stretchMax = r; stretchAt = `${clip}@${x.toFixed(2)}`; } });
    if (flag('see', '') === `${clip}@${k}`) {
      // --see=<clip>@<sample>: the three views with the see-through pixels black (scratch debugging)
      const ims = AZ.map((az) => raster(S, az, true).img), W3 = RS * 3, b3 = Buffer.alloc(W3 * RS);
      ims.forEach((im, j) => { for (let py = 0; py < RS; py++) for (let px = 0; px < RS; px++) b3[py * W3 + j * RS + px] = im[py * RS + px]; });
      await sharp(b3, { raw: { width: W3, height: RS, channels: 1 } }).resize(W3 * 2, RS * 2, { kernel: 'nearest' }).png().toFile(flag('seeout', '/tmp/king-see.png'));
    }
    if (flag('worst', '') === `${clip}@${k}`) {
      // --worst=<clip>@<sample>: the 12 most stretched edges and their vertices' dominant joints
      const top = E.map(([a, b], e) => [Math.hypot(S[a * 3] - S[b * 3], S[a * 3 + 1] - S[b * 3 + 1], S[a * 3 + 2] - S[b * 3 + 2]) / Math.max(1e-4, restLen[e]), a, b]).sort((u, v) => v[0] - u[0]).slice(0, 12);
      const dom = (i) => [0, 1, 2, 3].filter((q) => WGT[i * 4 + q] > 0.01).map((q) => `${jointNames[JNT[i * 4 + q]]}:${WGT[i * 4 + q].toFixed(2)}`).join('+');
      const at = (i) => [POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]].map((v) => v.toFixed(2)).join(',');
      console.log('turns', boneList.map((bn, i) => `${bn.name}:${(2 * Math.acos(Math.min(1, Math.abs(bn.quaternion.dot(restQ[i])))) * 57.3).toFixed(0)}`).join(' '));
      for (const [r, a, b] of top) console.log('worst', r.toFixed(2), at(a), dom(a), '|', at(b), dom(b), restLen[E.findIndex(([u, v]) => u === a && v === b)]?.toFixed(4));
    }
    // G10b: the raster, every 3rd sample (+ the sheet's 4)
    const sheetK = new Set([0, Math.round(xs.length / 3), Math.round(2 * xs.length / 3), xs.length - 1]);
    if (k % 3 === 0 || sheetK.has(k)) {
      const r3 = AZ.map((az, j) => raster(S, az, sheetK.has(k) && j === 0));
      r3.forEach((r, j) => { const over = r.holes - baseline[j]; clipSee = Math.max(clipSee, over); if (over > holesWorst) { holesWorst = over; holesAt = `${clip}@${x.toFixed(2)} az${j}`; } });
      if (sheetK.has(k) && r3[0].img) sheet.push({ clip, x, img: r3[0].img });
    }
    // G8: hoof joints in the ground frame (a gait's root advances at its stride)
    HOOVES.forEach((n, l) => { const p = hoofW(n); const adv = WALKS[clip] ? x * WALKS[clip].stride : 0; feet[l].push({ x, z: p.z + adv, y: p.y, xw: p.x }); });
  }
  // stance windows
  let slide = 0;
  HOOVES.forEach((n, l) => {
    const inStance = (x) => {
      if (WALKS[clip]) { const p = (((x + WALKS[clip].off[l]) % 1) + 1) % 1; return p < WALKS[clip].stance - 0.02 && p > 0.02; }
      if (clip === 'idle' || clip === 'sweep' || clip === 'hit') return true;
      if (clip === 'strike' || clip === 'roar') return l >= 2;   // the hind hooves carry the rear
      return false;                                               // brace paws, die folds: no stance
    };
    // contiguous stance runs
    let run = [];
    const flush = () => { if (run.length > 1) { const zs = run.map((f) => f.z), ys = run.map((f) => f.y), xs2 = run.map((f) => f.xw); slide = Math.max(slide, Math.max(...zs) - Math.min(...zs), Math.max(...ys) - Math.min(...ys), Math.max(...xs2) - Math.min(...xs2)); } run = []; };
    for (const f of feet[l]) { if (inStance(f.x)) run.push(f); else flush(); }
    flush();
  });
  clipsOut[clip] = { samples: xs.length, maxJointTurnDeg: Number((maxTurn * 180 / Math.PI).toFixed(1)), maxVertexMove: Number(maxMove.toFixed(3)), footSlideInStance: Number(slide.toFixed(4)), footSlideOverH: Number((slide / H).toFixed(4)), edgeStretch: Number(clipStretch.toFixed(2)), seeThroughOverBaseline: clipSee };
}
report.clipDetail = clipsOut;
const silent = Object.entries(clipsOut).filter(([, c]) => c.maxJointTurnDeg < 2 || c.maxVertexMove < 0.01 * H).map(([k]) => k);
put('G1 binding reaches node', g1Delta <= 2 ** -23 && silent.length === 0 && Object.values(clipsOut).every((c) => c.samples >= 5) ? 'pass' : 'fail', { maxSampledBindingDelta: g1Delta, samplesPerClip: SAMPLES, clipsThatDoNotMove: silent });
put('G2 deformation finite', g2Bad === 0 && g2Count > 0 ? 'pass' : 'fail', { componentsSkinned: g2Count, nonFiniteCount: g2Bad, verticesPerFrame: NV });
const slideWorst = Math.max(...Object.values(clipsOut).map((c) => c.footSlideOverH));
put('G8 foot contact', slideWorst <= 0.01 ? 'pass' : 'fail', { worstSlideOverH: slideWorst, perClip: Object.fromEntries(Object.entries(clipsOut).map(([k, c]) => [k, c.footSlideOverH])), criterion: 'footSlide <= 0.01H in stance' });
put('G9 no joint scale', g9Max === 0 ? 'pass' : 'fail', { scaleDelta: g9Max });
put('G10 skin integrity sweep', splitMax <= 1e-6 * H && holesWorst <= 0 && stretchMax <= 2 ? 'pass' : 'fail', { seamSplitMax: splitMax, seeThroughOverBaselinePx: holesWorst, worstAt: holesAt, baselineSeeThroughPx: baseline, edgeStretchMax: Number(stretchMax.toFixed(3)), stretchAt });
// G3: back to rest after the whole sweep
resetPose(); mesh.updateMatrixWorld(true); skeleton.update();
const back = skinned();
let restoreErr = 0; for (let i = 0; i < NV * 3; i++) restoreErr = Math.max(restoreErr, Math.abs(back[i] - POS[i]));
put('G3 bind restore', restoreErr <= 1e-12 * Math.max(1, H) ? 'pass' : 'fail', { maxBindRestoreDelta: restoreErr });

const ids = Object.keys(report.checks).sort((a, b) => Number(a.slice(1).split(' ')[0]) - Number(b.slice(1).split(' ')[0]));
report.checks = Object.fromEntries(ids.map((k) => [k, report.checks[k]]));
report.ok = Object.values(report.checks).every((c) => c.status === 'pass');
for (const [k, c] of Object.entries(report.checks)) console.log(`${c.status.padEnd(11)} ${k}  ${JSON.stringify(Object.fromEntries(Object.entries(c).filter(([x]) => x !== 'status')))}`);
console.log(JSON.stringify(clipsOut));
console.log(report.ok ? 'RIG GATE: PASS (12 / 12 measured)' : 'RIG GATE: NOT PASSED');
const json = flag('json', '');
if (json) writeFileSync(json, JSON.stringify(report, null, 1));
const sheetOut = flag('sheet', '');
if (sheetOut && sheet.length > 0) {
  const cols = 4, rows = Math.ceil(sheet.length / cols), W = RS * cols, Hh = RS * rows, buf = Buffer.alloc(W * Hh, 255);
  sheet.forEach((s, i) => { const ox = (i % cols) * RS, oy = Math.floor(i / cols) * RS; for (let y = 0; y < RS; y++) for (let x = 0; x < RS; x++) buf[(oy + y) * W + ox + x] = s.img[y * RS + x]; });
  const labels = sheet.map((s, i) => `<text x="${(i % cols) * RS + 4}" y="${Math.floor(i / cols) * RS + 14}" font-family="Helvetica" font-size="12" fill="#b00">${s.clip} ${s.x.toFixed(2)}</text>`).join('');
  await sharp(buf, { raw: { width: W, height: Hh, channels: 1 } }).composite([{ input: Buffer.from(`<svg width="${W}" height="${Hh}">${labels}</svg>`), top: 0, left: 0 }]).jpeg({ quality: 85 }).toFile(sheetOut);
  console.log('sheet', sheetOut);
}
process.exit(report.ok ? 0 : 1);
