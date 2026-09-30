#!/usr/bin/env node
// e350-king-measure.mjs — E350 F-X2: measure the Antler King's own hull (antler-king-rig[.phone].rigged.glb) in the poses
// the fight uses, through the SAME clip functions the game animates him with (src/pinehollow/kingRig.ts clipPose →
// applyKingPose, skinned on the CPU as scripts/king-rig-gate.mjs does). World metres = model units × KING_SCALE (2.6).
//
//   node --import ./scripts/bake-loader.mjs scripts/e350-king-measure.mjs [--tier=desktop|phone] [--json=<out.json>]
//
// What it reports (the numbers src/pinehollow/antlerKing.ts's distances are set from):
//   rest     the bounding box, the joints, the torso's extent round the body capsule's axis (the body bone's z)
//   sweep    over the swing, the rack's farthest horizontal reach from his origin and the arc it covers
//   strike   the forehooves' horizontal distance from his origin at the slam (contact) and his top reach reared
//   charge   over a gallop cycle, his half-width (|x|) and his front / back extent (z)
//   hitbox   the torso fitted to a capsule on the body bone (the half-length and radius that hug it), the skull (head
//            weighted, not rack) as a ball on the head joint, the ribcage sphere against the torso's front
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { realpathSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { kingRest, clipPose, applyKingPose, newPose } from '../src/pinehollow/kingRig.ts';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const TIER = flag('tier', 'desktop');
const S = Number(flag('scale', '2.6'));
const FILE = resolvePath(ROOT, `public/assets/pine-hollow/creatures/antler-king-rig${TIER === 'phone' ? '.phone' : ''}.rigged.glb`);

const cliAbs = realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(FILE);
const skinNode = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
if (!skinNode) throw new Error('no skinned mesh');
const prim = skinNode.getMesh().listPrimitives()[0];
const arr = (acc) => { const n = acc.getCount(), k = acc.getElementSize(), out = new Float64Array(n * k), e = []; for (let i = 0; i < n; i++) { acc.getElement(i, e); for (let c = 0; c < k; c++) out[i * k + c] = e[c]; } return out; };
let IDX = [];
const POS = arr(prim.getAttribute('POSITION')), JNT = arr(prim.getAttribute('JOINTS_0')), WGT = arr(prim.getAttribute('WEIGHTS_0'));
const NV = POS.length / 3;
const jointNodes = skinNode.getSkin().listJoints();
const jointNames = jointNodes.map((n) => n.getName());

const bones = {};
for (const jn of jointNodes) { const b = new THREE.Bone(); b.name = jn.getName(); const t = jn.getTranslation(); b.position.set(t[0], t[1], t[2]); bones[b.name] = b; }
for (const jn of jointNodes) { const p = jn.getParentNode(); if (p && bones[p.getName()]) bones[p.getName()].add(bones[jn.getName()]); }
const boneList = jointNames.map((n) => bones[n]);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(POS), 3));
geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(JNT), 4));
geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(WGT), 4));
const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
mesh.add(bones.body);
mesh.updateMatrixWorld(true);
const skeleton = new THREE.Skeleton(boneList);
mesh.bind(skeleton, new THREE.Matrix4());
const restQ = boneList.map((b) => b.quaternion.clone()), restP = boneList.map((b) => b.position.clone());
const rest = kingRest(bones);
const pose = newPose();
const resetPose = () => boneList.forEach((b, i) => { b.quaternion.copy(restQ[i]); b.position.copy(restP[i]); });
function poseClip(clip, x) { resetPose(); if (clip) applyKingPose(rest, clipPose(pose, rest, clip, x, x)); mesh.updateMatrixWorld(true); skeleton.update(); }
const _v = new THREE.Vector3();
function skinned() { const out = new Float64Array(NV * 3); for (let i = 0; i < NV; i++) { _v.set(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]); mesh.applyBoneTransform(i, _v); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; } return out; }

// each vertex's dominant joint
const dom = new Int32Array(NV);
for (let i = 0; i < NV; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (WGT[i * 4 + k] > bw) { bw = WGT[i * 4 + k]; best = JNT[i * 4 + k]; } dom[i] = best; }
const J = (n) => jointNames.indexOf(n);
const headJ = J('head');
const TORSO = new Set(['body', 'chest', 'hips'].map(J));
// the rack: head-weighted vertices well above the head joint; the skull: head-weighted, within ~0.5 of the joint's height
// the rack: head-weighted and above 7.6 m or more than 1.1 m off his midline (at rest); the face (the skull, the muzzle,
// the beard) is the rest of the head's
const isRack = (i) => dom[i] === headJ && (POS[i * 3 + 1] * S > 7.6 || Math.abs(POS[i * 3]) * S > 1.1);
const isSkull = (i) => dom[i] === headJ && !isRack(i);
/** his body as the eye reads it: the torso, the neck, the shoulders and haunches (the limbs' top joints) */
const isBodyV = (i) => TORSO.has(dom[i]) || dom[i] === J('neck') || /_sh$|_hip$/.test(jointNames[dom[i]] ?? '');
const isTorso = (i) => TORSO.has(dom[i]);
const isFore = (i) => (jointNames[dom[i]] ?? '').startsWith("arm");
const m = (x) => Number((x * S).toFixed(2));
const u = (x) => Number(x.toFixed(3));

if (argv.includes('--parts')) {
  const hist = {};
  for (let i = 0; i < NV; i++) { const y = POS[i * 3 + 1] * S; const k = `${jointNames[dom[i]]} y${Math.floor(y)}`; hist[k] = (hist[k] ?? 0) + 1; }
  console.error(Object.entries(hist).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join('  '));
}
const out = { file: FILE.slice(ROOT.length + 1), tier: TIER, scale: S, vertices: NV };

// ─── rest ───
poseClip(null, 0);
const R = skinned();
const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (let i = 0; i < NV; i++) for (let c = 0; c < 3; c++) { bb.min[c] = Math.min(bb.min[c], R[i * 3 + c]); bb.max[c] = Math.max(bb.max[c], R[i * 3 + c]); }
out.rest = {
  bboxModel: { min: bb.min.map(u), max: bb.max.map(u) },
  bboxWorld: { min: bb.min.map(m), max: bb.max.map(m) },
  H_shoulder_world: m(rest.H),
  joints_world: Object.fromEntries(['body', 'hips', 'chest', 'neck', 'head', 'armL_hoof', 'legL_hoof'].map((n) => [n, [m(rest.at[n].x), m(rest.at[n].y), m(rest.at[n].z)]])),
};

// ─── the torso against a capsule on the body bone (rest: the body bone's axes are the model's; z forward) ───
function torsoFit(P) {
  const b = rest.at.body;
  const zs = [], rs = [];
  let cy = 0, cz = 0, n = 0;
  for (let i = 0; i < NV; i++) {
    if (!isTorso(i)) continue;
    const x = P[i * 3] - b.x, y = P[i * 3 + 1] - b.y, z = P[i * 3 + 2] - b.z;
    zs.push(z); rs.push(Math.hypot(x, y)); cy += y; cz += z; n++;
  }
  zs.sort((a, c) => a - c); rs.sort((a, c) => a - c);
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
  return { n, centroidOffsetFromBody_world: [0, m(cy / n), m(cz / n)], zRange_world: [m(q(zs, 0.02)), m(q(zs, 0.98))], radial_p50_p90_p98_world: [m(q(rs, 0.5)), m(q(rs, 0.9)), m(q(rs, 0.98))] };
}
out.torso = torsoFit(R);

// torso cross-section: at slices along z, the half-width (|x|) and the y extent above / below the body joint
{
  const b = rest.at.body;
  const slices = [];
  for (let z0 = -1.6; z0 <= 1.6; z0 += 0.2) {
    let xm = 0, ylo = Infinity, yhi = -Infinity, n = 0;
    for (let i = 0; i < NV; i++) {
      if (!isTorso(i) && !(dom[i] === J('neck'))) continue;
      const z = R[i * 3 + 2] - b.z; if (z < z0 || z >= z0 + 0.2) continue;
      xm = Math.max(xm, Math.abs(R[i * 3])); ylo = Math.min(ylo, R[i * 3 + 1] - b.y); yhi = Math.max(yhi, R[i * 3 + 1] - b.y); n++;
    }
    if (n > 0) slices.push({ z_world: m(z0 + 0.1), n, halfWidth: m(xm), yBelow: m(ylo), yAbove: m(yhi) });
  }
  out.torsoSlices = slices;
}

// the skull
{
  let n = 0;
  const c = new THREE.Vector3();
  for (let i = 0; i < NV; i++) if (isSkull(i)) { c.x += R[i * 3]; c.y += R[i * 3 + 1]; c.z += R[i * 3 + 2]; n++; }
  c.multiplyScalar(1 / n);
  const ds = [];
  for (let i = 0; i < NV; i++) if (isSkull(i)) ds.push(Math.hypot(R[i * 3] - c.x, R[i * 3 + 1] - c.y, R[i * 3 + 2] - c.z));
  ds.sort((a, b) => a - b);
  const q = (f) => ds[Math.min(ds.length - 1, Math.floor(ds.length * f))];
  const hj = rest.at.head;
  out.skull = { n, centroid_world: [m(c.x), m(c.y), m(c.z)], headJoint_world: [m(hj.x), m(hj.y), m(hj.z)], centroidFromJoint_world: [m(c.x - hj.x), m(c.y - hj.y), m(c.z - hj.z)], radius_p50_p80_p95_world: [m(q(0.5)), m(q(0.8)), m(q(0.95))] };
  let rn = 0, rx = 0, rz = -Infinity, ry = -Infinity;
  for (let i = 0; i < NV; i++) if (isRack(i)) { rn++; rx = Math.max(rx, Math.abs(R[i * 3])); rz = Math.max(rz, R[i * 3 + 2]); ry = Math.max(ry, R[i * 3 + 1]); }
  out.rack = { n: rn, halfSpan_world: m(rx), frontZ_world: m(rz), top_world: m(ry) };
}

// the ribcage basket (antlerKing.ts's RIB_AT on the chest bone, radius 0.36 × 1.15)
{
  const ch = rest.at.chest;
  const RIB = new THREE.Vector3(ch.x, ch.y - 0.45, ch.z + 0.47);
  // the torso's front surface along +z at the cage's height (the nearest torso vertices to the line x=0,y=RIB.y)
  let front = -Infinity;
  for (let i = 0; i < NV; i++) { if (!isTorso(i) && dom[i] !== J('neck')) continue; if (Math.abs(R[i * 3]) < 0.15 && Math.abs(R[i * 3 + 1] - RIB.y) < 0.12) front = Math.max(front, R[i * 3 + 2]); }
  out.ribcage = { centre_world: [m(RIB.x), m(RIB.y), m(RIB.z)], radius_world: m(0.36 * 1.15), chestFrontZ_atCageHeight_world: m(front), cageFrontZ_world: m(RIB.z + 0.36) };
}

// ─── the clips ───
function reachStats(P, sel) {
  let r = 0, zf = -Infinity, zb = Infinity, xw = 0, top = -Infinity, ang = 0;
  for (let i = 0; i < NV; i++) {
    if (sel && !sel(i)) continue;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const h = Math.hypot(x, z);
    if (h > r) { r = h; ang = Math.atan2(x, z); }
    zf = Math.max(zf, z); zb = Math.min(zb, z); xw = Math.max(xw, Math.abs(x)); top = Math.max(top, y);
  }
  return { r, zf, zb, xw, top, ang };
}
// sweep: over the swing
{
  const rows = [];
  let worst = { r: 0 };
  for (let k = 0; k <= 20; k++) {
    const a = k / 20; poseClip('sweep', a); const P = skinned();
    const s = reachStats(P, isRack), b = reachStats(P, null);
    rows.push({ a: u(a), rackReach: m(s.r), rackAngleDeg: Math.round(s.ang * 180 / Math.PI), rackHalfSpan: m(s.xw), bodyReach: m(b.r) });
    if (s.r > worst.r) worst = { ...s, a };
  }
  out.sweep = { rows, maxRackReach_world: m(worst.r) };
}
// strike: the forehooves at the slam, the rear's top
{
  const rows = [];
  for (const a of [0, 0.3, 0.5, 0.6, 0.7, 0.78, 0.85, 0.9, 0.95, 1]) {
    poseClip('strike', a); const P = skinned();
    const f = reachStats(P, isFore), b = reachStats(P, null);
    const hf = ['armL_hoof', 'armR_hoof'].map((n) => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld));
    rows.push({ a, foreReach: m(f.r), foreFrontZ: m(f.zf), hoofL: [m(hf[0].x), m(hf[0].y), m(hf[0].z)], hoofR: [m(hf[1].x), m(hf[1].y), m(hf[1].z)], bodyFrontZ: m(b.zf), top: m(b.top) });
  }
  out.strike = rows;
}
// charge: over a cycle
{
  let xw = 0, zf = -Infinity, zb = Infinity, xwT = 0;
  for (let k = 0; k < 16; k++) {
    poseClip('charge', k / 16); const P = skinned();
    const s = reachStats(P, null); xw = Math.max(xw, s.xw); zf = Math.max(zf, s.zf); zb = Math.min(zb, s.zb);
    xwT = Math.max(xwT, reachStats(P, (i) => !isRack(i)).xw);
  }
  out.charge = { halfWidth_world: m(xw), halfWidthNoRack_world: m(xwT), frontZ_world: m(zf), backZ_world: m(zb) };
}
// idle for reference
{ poseClip('idle', 0); const P = skinned(); const s = reachStats(P, null); out.idle = { halfWidth_world: m(s.xw), frontZ_world: m(s.zf), backZ_world: m(s.zb), top_world: m(s.top) }; }

// ─── the hit volumes against the visual: rays from the player's eye (1.6 m) over his silhouette, per pose ───
// A ray's visual answer is the first triangle it meets (its part: the dominant joint of the triangle's vertices) or the
// ribcage basket (a sphere on the chest bone); the hitbox answer is the game's head ball + body capsule (Animal.ts
// headWorld / bodyCapsule with the dims below). Counted on rays whose visual answer is the torso, the skull or the cage:
//   hit     the hitbox is met within 1 m before / 2 m behind the visual surface
//   through the visual surface is there and the hitbox is not (a bolt passes his body)
//   air     the hitbox is met more than 1 m before any visual surface (or with none behind): a hit from air
IDX = Array.from(prim.getIndices().getArray());
const NT = IDX.length / 3;
const triPart = new Uint8Array(NT);   // 0 other (limbs, tail), 1 torso, 2 skull, 3 rack
for (let t = 0; t < NT; t++) {
  const i = IDX[t * 3];
  triPart[t] = isBodyV(i) ? 1 : isRack(i) ? 3 : isSkull(i) ? 2 : 0;
}
function rayTris(P, o, d) {
  let best = Infinity, part = -1;
  for (let t = 0; t < NT; t++) {
    const a = IDX[t * 3] * 3, b = IDX[t * 3 + 1] * 3, c = IDX[t * 3 + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2];
    const uu = (tx * px + ty * py + tz * pz) * inv; if (uu < 0 || uu > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const vv = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (vv < 0 || uu + vv > 1) continue;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tt > 1e-6 && tt < best) { best = tt; part = triPart[t]; }
  }
  return { t: best, part };
}
function raySphere(o, d, c, r) {
  const ox = o[0] - c.x, oy = o[1] - c.y, oz = o[2] - c.z;
  const b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return Infinity; const t = -b - Math.sqrt(h); return t > 0 ? t : (cc < 0 ? 0 : Infinity);
}
function rayCapsule(o, d, A, B, r) {
  // Inigo Quilez's ray-capsule intersection (exact), the nearest t > 0 (0 when the eye is inside)
  const bax = B.x - A.x, bay = B.y - A.y, baz = B.z - A.z, oax = o[0] - A.x, oay = o[1] - A.y, oaz = o[2] - A.z;
  const baba = bax * bax + bay * bay + baz * baz, bard = bax * d[0] + bay * d[1] + baz * d[2], baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d[0] * oax + d[1] * oay + d[2] * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard; let b = baba * rdoa - baoa * bard; let c = baba * oaoa - baoa * baoa - r * r * baba;
  let h = b * b - a * c;
  if (h >= 0) {
    const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0) return t;
    const ocx = y <= 0 ? oax : o[0] - B.x, ocy = y <= 0 ? oay : o[1] - B.y, ocz = y <= 0 ? oaz : o[2] - B.z;
    b = d[0] * ocx + d[1] * ocy + d[2] * ocz; c = ocx * ocx + ocy * ocy + ocz * ocz - r * r; h = b * b - c;
    if (h > 0) { const t2 = -b - Math.sqrt(h); if (t2 > 0) return t2; }
  }
  return Infinity;
}
/** the hitboxes as Animal.ts places them (model units) for dims `D`: the head ball on the head bone (+ headAt), the body
 *  capsule on the body bone (+ bodyAt, tilted bodyPitch from its z), the optional fore capsule on its bone */
const _e0 = new THREE.Vector3(), _e1 = new THREE.Vector3();
function capsuleOn(mat, at, axis, pitch, halfLen) {
  const c = new THREE.Vector3(...at).applyMatrix4(mat), e = mat.elements;
  const main = axis === 'x' ? _e0.set(e[0], e[1], e[2]) : _e0.set(e[8], e[9], e[10]);
  const dir = main.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(_e1.set(e[4], e[5], e[6]), Math.sin(pitch)).normalize();
  return [c.clone().addScaledVector(dir, -halfLen), c.clone().addScaledVector(dir, halfLen)];
}
function hitboxes(D, mats) {
  const head = new THREE.Vector3(...(D.headAt ?? [0, 0, 0])).applyMatrix4(mats.head);
  const [A, B] = capsuleOn(mats.body, D.bodyAt ?? [0, 0, 0], 'z', D.bodyPitch ?? 0, D.bodyHalfLen);
  const f = D.fore;
  const fore = f ? capsuleOn(mats[f.bone], f.at, f.axis, f.pitch ?? 0, f.halfLen) : null;
  return { head, headR: D.headRadius, A, B, bodyR: D.bodyRadius, fore, foreR: f?.radius ?? 0 };
}
let lastHead = false;
function hitT(D, r) {
  const h = hitboxes(D, r.mats);
  const th = raySphere(r.o, r.d, h.head, h.headR);
  let t = rayCapsule(r.o, r.d, h.A, h.B, h.bodyR);
  if (h.fore) t = Math.min(t, rayCapsule(r.o, r.d, h.fore[0], h.fore[1], h.foreR));
  lastHead = th < t;
  return Math.min(t, th);
}
const EYE = 1.6 / S;
const POSES = [['idle', 0], ['strike', 0.6], ['strike', 1], ['charge', 0.3], ['sweep', 1]];
const VIEWS = [[0, 14], [14, 0], [10, 10], [-9, 9], [0, 7], [-10, -10]];   // eye (x, z) world m round his origin
const rayCache = [];
for (const [clip, x] of POSES) {
  poseClip(clip, x); const P = skinned();
  const ch = bones.chest.matrixWorld; const cage = new THREE.Vector3(0, -0.45, 0.47).add(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(ch));
  const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < NV; i++) for (let c = 0; c < 3; c++) { bmin[c] = Math.min(bmin[c], P[i * 3 + c]); bmax[c] = Math.max(bmax[c], P[i * 3 + c]); }
  const mats = { head: bones.head.matrixWorld.clone(), body: bones.body.matrixWorld.clone(), chest: bones.chest.matrixWorld.clone() };
  for (const [vx, vz] of VIEWS) {
    const o = [vx / S, EYE, vz / S];
    const GX = 34, GY = 30;
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      // a target point on the plane through his origin square to the view, over his bbox
      const fx = (gx + 0.5) / GX, fy = (gy + 0.5) / GY;
      const len = Math.hypot(vx, vz), sx = -vz / len, sz = vx / len;   // the view's side axis
      const w = Math.max(bmax[0] - bmin[0], bmax[2] - bmin[2]) * 0.6;
      const tx = sx * (fx - 0.5) * 2 * w, tz = sz * (fx - 0.5) * 2 * w, ty = bmin[1] + (bmax[1] - bmin[1]) * fy;
      const dx = tx - o[0], dy = ty - o[1], dz = tz - o[2], dl = Math.hypot(dx, dy, dz), d = [dx / dl, dy / dl, dz / dl];
      const hitM = rayTris(P, o, d);
      const tc = raySphere(o, d, cage, 0.36);
      let part = hitM.part, tv = hitM.t;
      if (tc < tv) { tv = tc; part = 4; }
      rayCache.push({ pose: `${clip}@${x}`, o, d, tv, part, cage, mats });
    }
  }
}
function evalDims(D, withCage = true) {
  const per = {};
  let hit = 0, through = 0, air = 0, ribOk = 0, ribN = 0, wrong = 0;
  for (const r of rayCache) {
    const tb = hitT(D, r);
    // the right part: the face answers with the head ball, the torso / the cage with the body
    if (tb < Infinity && tb <= r.tv + 2 / S && tb >= r.tv - 1 / S && ((r.part === 2) !== lastHead) && (r.part === 1 || r.part === 2 || r.part === 4)) wrong++;
    const target = r.part === 1 || r.part === 2 || (withCage && r.part === 4);
    const pp = per[r.pose] ??= { hit: 0, through: 0, air: 0 };
    if (target) {
      if (tb <= r.tv + 2 / S && tb >= r.tv - 1 / S) { hit++; pp.hit++; } else if (tb < r.tv - 1 / S) { air++; pp.air++; } else { through++; pp.through++; }
      if (r.part === 4) { ribN++; if (tb < Infinity) { const q = new THREE.Vector3(...r.o).addScaledVector(new THREE.Vector3(...r.d), tb); if (q.distanceTo(r.cage) < 0.36 * 1.15) ribOk++; } }
    } else if (tb < Math.min(r.tv, Infinity) - 1 / S || (tb < Infinity && r.tv === Infinity)) { air++; pp.air++; }
  }
  const n = hit + through + air;
  return { hit, through, air, wrong, ribMiss: ribN - ribOk, wrongPct: Number((100 * wrong / (hit + through + air)).toFixed(1)), hitPct: Number((100 * hit / n).toFixed(1)), throughPct: Number((100 * through / n).toFixed(1)), airPct: Number((100 * air / n).toFixed(1)), ribRegistered: `${ribOk}/${ribN}`, per };
}
out.rays = rayCache.length;
const TODAY = { headRadius: 0.36, bodyRadius: 0.65, bodyHalfLen: 1.0 };
out.fitToday = evalDims(TODAY);
const cand = flag('cand', '');
if (cand) out.fitCandidate = { dims: JSON.parse(cand), ...evalDims(JSON.parse(cand)) };
const FIT_KEYS = [['bodyRadius', 0.02], ['bodyHalfLen', 0.05], ['bodyPitch', 0.04], ['by', 0.04], ['bz', 0.05], ['headRadius', 0.02], ['hy', 0.04], ['hz', 0.05]];
const FORE_KEYS = [['fr', 0.02], ['fl', 0.04], ['fy', 0.04], ['fz', 0.05], ['fp', 0.05]];
const toD = (v) => ({
  bodyRadius: v.bodyRadius, bodyHalfLen: v.bodyHalfLen, bodyPitch: v.bodyPitch, bodyAt: [0, v.by, v.bz], headRadius: v.headRadius, headAt: [0, v.hy, v.hz],
  ...(v.fr !== undefined ? { fore: { bone: 'chest', axis: 'x', at: [0, v.fy, v.fz], halfLen: v.fl, radius: v.fr, pitch: v.fp } } : {}),
});
function descend(v0, keys) {
  const score = (e) => e.through + e.air + e.wrong + e.ribMiss;
  let v = { ...v0 }, cur = score(evalDims(toD(v)));
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const [k, st] of keys) for (const sgn of [1, -1]) {
      for (;;) { const w = { ...v, [k]: v[k] + sgn * st }; if (w.bodyRadius < 0.2 || w.bodyHalfLen < 0.05 || w.headRadius < 0.1 || (w.fr !== undefined && (w.fr < 0.2 || w.fl < 0.01))) break; const sc = score(evalDims(toD(w))); if (sc < cur) { v = w; cur = sc; moved = true; } else break; }
    }
    if (!moved) break;
  }
  const e = evalDims(toD(v));
  const round = (x) => Array.isArray(x) ? x.map((q) => Number(q.toFixed(3))) : typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, q]) => [k, typeof q === 'number' || Array.isArray(q) ? round(q) : q])) : Number(x.toFixed(3));
  return { dims: round(toD(v)), hitPct: e.hitPct, throughPct: e.throughPct, airPct: e.airPct, wrongPct: e.wrongPct, ribRegistered: e.ribRegistered, per: e.per };
}
if (argv.includes('--search')) {
  const today = { bodyRadius: 0.65, bodyHalfLen: 1.0, bodyPitch: 0, by: 0, bz: 0, headRadius: 0.36, hy: 0, hz: 0 };
  out.searchOne = descend(today, FIT_KEYS);
  // two volumes: the barrel on the body bone and the fore block (shoulders, chest, hump) across the chest bone
  const starts = [
    { ...today, bodyRadius: 0.55, bodyHalfLen: 0.6, bz: -0.3, fr: 0.75, fl: 0.25, fy: -0.1, fz: 0.1, fp: 0 },
    { ...today, bodyRadius: 0.5, bodyHalfLen: 0.8, bz: -0.5, by: -0.1, fr: 0.6, fl: 0.45, fy: -0.2, fz: 0.0, fp: 0 },
    { ...today, bodyRadius: 0.6, bodyHalfLen: 0.4, bz: -0.6, bodyPitch: 0.2, fr: 0.85, fl: 0.1, fy: -0.25, fz: 0.15, fp: 0 },
    { ...today, bodyRadius: 0.5, bodyHalfLen: 1.0, bz: -0.2, bodyPitch: 0.3, fr: 0.55, fl: 0.6, fy: 0.0, fz: -0.1, fp: 0 },
  ];
  const runs = starts.map((st) => descend(st, [...FIT_KEYS, ...FORE_KEYS]));
  out.searchTwoRuns = runs.map((r) => ({ hitPct: r.hitPct, throughPct: r.throughPct, airPct: r.airPct }));
  out.searchTwo = runs.reduce((a, b) => (a.throughPct + a.airPct <= b.throughPct + b.airPct ? a : b));
}

// ─── the reach that can touch a standing player: only the surface below `LOW` (the player's 1.8 m + margin) ───
const LOW = 2.6 / S;
function lowStats(P, sel) {
  let r = 0, xw = 0, zf = -Infinity, ymin = Infinity, angMin = Infinity, angMax = -Infinity;
  for (let i = 0; i < NV; i++) {
    if (sel && !sel(i)) continue;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    ymin = Math.min(ymin, y);
    if (y > LOW) continue;
    const h = Math.hypot(x, z); r = Math.max(r, h); xw = Math.max(xw, Math.abs(x)); zf = Math.max(zf, z);
    if (h > 2.5 / S) { const a = Math.atan2(x, z); angMin = Math.min(angMin, a); angMax = Math.max(angMax, a); }
  }
  return { r: m(r), xw: m(xw), zf: m(zf), ymin: m(ymin), arcDeg: [Math.round(angMin * 57.3), Math.round(angMax * 57.3)] };
}
{
  const sw = [];
  for (let k = 0; k <= 20; k++) { const a = k / 20; poseClip('sweep', a); const P = skinned(); sw.push({ a, rackLow: lowStats(P, isRack), faceLow: lowStats(P, isSkull), allLow: lowStats(P, (i) => !isRack(i)) }); }
  out.sweepLow = sw;
  const ch = [];
  for (let k = 0; k < 8; k++) { poseClip('charge', k / 8); const P = skinned(); ch.push({ ph: k / 8, all: lowStats(P, null), noRack: lowStats(P, (i) => !isRack(i)), body: lowStats(P, isBodyV) }); }
  out.chargeLow = ch;
  const bodyW = [];
  for (let k = 0; k < 8; k++) { poseClip('charge', k / 8); const P = skinned(); let xw = 0, zf = -Infinity; for (let i = 0; i < NV; i++) if (isBodyV(i) || isSkull(i)) { xw = Math.max(xw, Math.abs(P[i * 3])); zf = Math.max(zf, P[i * 3 + 2]); } bodyW.push({ ph: k / 8, bodyHalfWidth: m(xw), bodyFrontZ: m(zf) }); }
  out.chargeBody = bodyW;
  const st = [];
  for (const a of [0.9, 0.95, 1]) { poseClip('strike', a); const P = skinned(); st.push({ a, all: lowStats(P, null) }); }
  out.strikeLow = st;
}
// ─── the sweep's contact map: a standing player (feet on his ground, 1.8 m, r 0.38) at (d, angle off his heading); his
// skinned mesh's closest gap to that capsule over the swing (attack 0.5 → 1, 16 frames). Then the blow's arc and reach
// that agree with it best: inArc(aim ± arc, reach) against contact (gap < 0.15 m) ───
if (argv.includes('--sweepmap')) {
  const frames = [];
  for (let k = 0; k <= 15; k++) { poseClip('sweep', 0.5 + 0.5 * k / 15); frames.push(skinned()); }
  const cells = [];
  for (let d = 2.5; d <= 8.51; d += 0.5) for (let ang = -90; ang <= 90; ang += 5) {
    const a = ang * Math.PI / 180, px = Math.sin(a) * d / S, pz = Math.cos(a) * d / S, y0 = 0.38 / S, y1 = (1.8 - 0.38) / S;
    let gap = Infinity;
    for (const P of frames) for (let i = 0; i < NV; i++) {
      const y = P[i * 3 + 1], dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      const g = Math.hypot(P[i * 3] - px, dy, P[i * 3 + 2] - pz) * S - 0.38;
      if (g < gap) gap = g;
    }
    cells.push({ d, ang, gap });
  }
  const touch = (c) => c.gap < 0.15;
  let best = null;
  for (let aim = -30; aim <= 10; aim += 2.5) for (let arc = 20; arc <= 80; arc += 2.5) for (let reach = 5; reach <= 8.5; reach += 0.1) {
    let bad = 0, air = 0, thr = 0;
    for (const c of cells) {
      const hit = c.d <= reach && Math.abs(c.ang - aim) <= arc;
      if (hit !== touch(c)) { bad++; if (hit) air++; else thr++; }
    }
    if (!best || bad < best.bad) best = { aim, arc, reach: Number(reach.toFixed(1)), bad, air, through: thr, cells: cells.length };
  }
  out.sweepFit = best;
  // two parts: close in (he dives onto you: his forelegs, chest and face) and the rack's scythe further out
  let best2 = null;
  for (let r1 = 3; r1 <= 5; r1 += 0.25) for (let a1 = 40; a1 <= 90; a1 += 5) for (let aim = -25; aim <= 5; aim += 2.5) for (let arc = 20; arc <= 55; arc += 2.5) for (let reach = 5.5; reach <= 8; reach += 0.1) {
    let bad = 0, air = 0, thr = 0;
    for (const c of cells) {
      const hit = (c.d <= r1 && Math.abs(c.ang) <= a1) || (c.d <= reach && Math.abs(c.ang - aim) <= arc);
      if (hit !== touch(c)) { bad++; if (hit) air++; else thr++; }
    }
    if (!best2 || bad < best2.bad) best2 = { r1, a1, aim, arc, reach: Number(reach.toFixed(1)), bad, air, through: thr, cells: cells.length };
  }
  out.sweepFit2 = best2;
  const rows = [];
  for (let d = 2.5; d <= 8.51; d += 0.5) rows.push(`${d.toFixed(1).padStart(4)} ${  cells.filter((c) => c.d === d).map((c) => (c.gap < 0.15 ? '#' : c.gap < 0.6 ? '+' : '.')).join('')}`);
  console.error(`sweep contact (# touch, + within 0.6 m), angle −90 … +90 (+ = his left) →\n${  rows.join('\n')}`);
}
// ─── the lane's contact: a standing player L m off his line as he gallops past (every gait phase, any point along the
// pass: only the lateral offset and the height count); the widest L his mesh still touches ───
if (argv.includes('--lanemap')) {
  const frames = [];
  for (let k = 0; k < 16; k++) { poseClip('charge', k / 16); frames.push(skinned()); }
  const y0 = 0.38 / S, y1 = (1.8 - 0.38) / S, rows = [];
  let widest = 0;
  for (let L = 0; L <= 4.01; L += 0.25) {
    let gap = Infinity;
    for (const P of frames) for (let i = 0; i < NV; i++) {
      const y = P[i * 3 + 1], dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      for (const sx of [1, -1]) { const g = Math.hypot(P[i * 3] * sx - L / S, dy) * S - 0.38; if (g < gap) gap = g; }
    }
    rows.push({ L, gap: Number(gap.toFixed(2)) });
    if (gap < 0.15) widest = L;
  }
  out.laneMap = { rows, widestTouch: widest };
}
const json = flag('json', '');
if (json) writeFileSync(resolvePath(ROOT, json), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
if (argv.includes('--map')) {
  // a side-view map of the idle pose (the (14, 0) view): . air-free visual hit, # through, A air, blank nothing
  const D = out.searchTwo ? out.searchTwo.dims : JSON.parse(flag('cand', '{}'));
  for (const view of [[14, 0], [0, 14]]) {
    const rows = [];
    const GX = 34, GY = 30;
    const rs = rayCache.filter((r) => r.pose === 'idle@0' && Math.abs(r.o[0] - view[0] / S) < 1e-6 && Math.abs(r.o[2] - view[1] / S) < 1e-6);
    for (let gy = GY - 1; gy >= 0; gy--) {
      let line = '';
      for (let gx = 0; gx < GX; gx++) {
        const r = rs[gy * GX + gx];
        const tb = hitT(D, r);
        const target = r.part === 1 || r.part === 2 || r.part === 4;
        let ch = r.tv === Infinity ? ' ' : 'o';
        if (target) ch = tb <= r.tv + 2 / S && tb >= r.tv - 1 / S ? (r.part === 4 ? 'R' : r.part === 2 ? 'H' : '.') : tb < r.tv - 1 / S ? 'A' : '#';
        else if (tb < r.tv - 1 / S) ch = 'A';
        line += ch;
      }
      rows.push(line);
    }
    console.error(`view ${view}:\n${  rows.join('\n')}`);
  }
}

if (argv.some((a) => a.startsWith('--img'))) {
  // a picture of the joint regions and the hitboxes: rest pose, side and front, per pixel the first triangle's dominant joint
  const sharp = req('sharp');
  poseClip(null, 0); const P = skinned();
  const W = 160, Hh = 150;
  const col = (n) => n === 'head' ? [220, 180, 60] : n === 'neck' ? [200, 120, 60] : n === 'chest' ? [80, 160, 220] : n === 'body' ? [60, 110, 170] : n === 'hips' ? [40, 80, 140] : n === 'tail' ? [150, 150, 150] : /_sh$|_hip$/.test(n) ? [90, 190, 110] : [60, 120, 60];
  const bufs = [];
  for (const [vx, vz] of [[30, 0], [0, 30]]) {
    const img = Buffer.alloc(W * Hh * 3, 255);
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
      // orthographic: along -view, pixel = (side, y) over [-6, 6] m × [0, 10] m (the target plane through his origin)
      const len = Math.hypot(vx, vz), sx = -vz / len, sz = vx / len;
      const u0 = ((px + 0.5) / W - 0.5) * 12 / S, y = (1 - (py + 0.5) / Hh) * 10 / S;
      const o = [sx * u0 + vx / len * 20 / S, y, sz * u0 + vz / len * 20 / S], d = [-vx / len, 0, -vz / len];
      let best = Infinity, bt = -1;
      for (let t = 0; t < NT; t++) {
        const a = IDX[t * 3] * 3, b = IDX[t * 3 + 1] * 3, c = IDX[t * 3 + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        const qx0 = d[1] * e2z - d[2] * e2y, qy0 = d[2] * e2x - d[0] * e2z, qz0 = d[0] * e2y - d[1] * e2x, det = e1x * qx0 + e1y * qy0 + e1z * qz0;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], uu = (tx * qx0 + ty * qy0 + tz * qz0) * inv; if (uu < 0 || uu > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, vv = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (vv < 0 || uu + vv > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv; if (tt > 0 && tt < best) { best = tt; bt = t; }
      }
      const off = (py * W + px) * 3;
      if (bt >= 0) { const c = col(jointNames[dom[IDX[bt * 3]]]); img[off] = c[0]; img[off + 1] = c[1]; img[off + 2] = c[2]; }
    }
    bufs.push(img);
  }
  const both = Buffer.alloc(W * 2 * Hh * 3);
  for (let y = 0; y < Hh; y++) for (let k = 0; k < 2; k++) bufs[k].copy(both, (y * W * 2 + k * W) * 3, y * W * 3, (y + 1) * W * 3);
  await sharp(both, { raw: { width: W * 2, height: Hh, channels: 3 } }).resize(W * 8, Hh * 4, { kernel: 'nearest' }).png().toFile(flag('img', 'parts.png'));
}
