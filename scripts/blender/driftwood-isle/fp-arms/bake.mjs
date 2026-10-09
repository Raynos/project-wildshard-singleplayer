#!/usr/bin/env node
// bake.mjs — step 3 of Driftwood's first-person arms (E334, scripts/blender/targets.json "driftwood-isle/fp-arms"): Nine
// Dragon's rig (fp-rig.glb) + arms.py's castaway parts → public/assets/driftwood-isle/viewmodel/fp-arms.glb.
//
//   node scripts/blender/driftwood-isle/fp-arms/bake.mjs <parts.json> <out.glb> [--raw]
//
// What it keeps from fp-rig.glb, untouched: both arms' joints (shoulder → upper arm → forearm → 3 twist bones → hand),
// the R_weapon node and the 16 clips (idle, walk, light ×3, charge, heavy, parry, sheathe, draw, sheathed, idleL, walkL,
// grapple_aim / fire / hold: the engine's SwordMoves timing, round 13). What it drops: every Nine Dragon mesh, hull and
// map, and L_claw. What it adds:
//   - 15 finger bones per hand (thumb / index / middle / ring / pinky × 3), children of <S>_hand. The hands are modelled
//     open (the bind: the inverse bind matrices); the bones REST in the grip (right, the fingers round the cord grip) or
//     the relaxed off hand (left), so the 16 clips, which never touch a finger, hold the sword with a closed fist;
//   - one skinned mesh `arms` (both arms, 44 joints, vertex colour, no texture) and the two swords as rigid children of
//     R_weapon (`sword_wood`, `sword_iron`: the runtime shows one), R_weapon moved 6 cm down the grip (a 15 cm grip);
//   - two looping clips on the same bones: `swimStroke` (the breaststroke, one cycle = one Player stroke) and `swimTread`
//     (sculling when still), with the fingers' swim poses. Authored as wrist paths through the rig's own two-bone IK
//     (src/game/systems/viewmodel/armRig.ts: twoBone, buildBones), like the 16.
// Skin weights, per part rule (arms.py): 'hand' = the hand bone (blended into the forearm over the wrist), 'chain' = a
// finger's bones by the nearest point on its bone line (a short blend at each knuckle), 'arm' = the bones along the
// shoulder → elbow → wrist line (a baggy elbow blend, the twist bones interpolated along the forearm).
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { rigIO, SRC, bindSkeleton, ARM } from './skeleton.mjs';
import { armConst, buildBones, measure, twoBone, LEFT_HAND, RIGHT_HAND } from '../../../../src/game/systems/viewmodel/armRig.ts';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
/** --raw: no meshopt (build.sh meshopts the build into public/, as every Blender target) */
const RAW = process.argv.includes('--raw');
if (positional.length < 2) throw new Error('usage: bake.mjs <parts.json> <out.glb> [--raw]');
const partsPath = positional[0], outPath = positional[1];
const P = JSON.parse(readFileSync(partsPath, 'utf8'));
const io = await rigIO();
const doc = await io.read(SRC);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const bind = bindSkeleton(doc);
const node = (n) => { const x = root.listNodes().find((o) => o.getName() === n); if (x === undefined) throw new Error(`no node ${n}`); return x; };
const M4 = (a) => new Matrix4().fromArray(a);

// ── strip Nine Dragon's meshes, skins and the claw ──
for (const n of root.listNodes()) if (n.getMesh() !== null || n.getName().startsWith('L_claw')) n.dispose();
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMeshes()) m.dispose();
for (const m of root.listMaterials()) m.dispose();
for (const t of root.listTextures()) t.dispose();
node('R_weapon').setTranslation(P.weaponT);
const vmRoot = node('vm_root');

// ── the finger bones: bind (world) from arms.py's open hands, rest = bind × the side's rest pose ──
const bindW = new Map(Object.entries(bind).map(([k, v]) => [k, M4(v.world)]));
const frame = (b) => {
  const y = new Vector3(...b.y).normalize();
  const x = new Vector3(...b.x); x.addScaledVector(y, -x.dot(y)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Matrix4().makeBasis(x, y, z).setPosition(...b.head);
};
const fingerLocal = new Map(); // name → { t, bindQ } (the bind local transform under its parent)
const deltaQ = (side, pose, name) => { const d = P.hands[side].poses[pose]?.[name]; return d === undefined ? new Quaternion() : new Quaternion(...d); };
for (const side of ['R', 'L']) {
  const rest = side === 'R' ? 'grip' : 'relaxed';
  for (const b of P.hands[side].bones) {
    const w = frame(b);
    bindW.set(b.name, w);
    const parentW = bindW.get(b.parent);
    if (parentW === undefined) throw new Error(`finger ${b.name}: no parent ${b.parent}`);
    const local = parentW.clone().invert().multiply(w);
    const t = new Vector3(), q = new Quaternion(), s = new Vector3();
    local.decompose(t, q, s);
    fingerLocal.set(b.name, { t, q });
    const r = q.clone().multiply(deltaQ(side, rest, b.name));
    const n = doc.createNode(b.name).setTranslation(t.toArray()).setRotation(r.toArray());
    node(b.parent).addChild(n);
  }
}

// ── joints: per side the 7 arm joints, then the 15 fingers ──
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const joints = [];
for (const side of ['R', 'L']) {
  for (const a of ARM) joints.push(`${side}_${a}`);
  for (const f of FINGERS) for (const k of [1, 2, 3]) joints.push(`${side}_${f}${k}`);
}
const jIndex = new Map(joints.map((n, i) => [n, i]));

// ── skin weights ──
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const posOf = (n) => new Vector3().setFromMatrixPosition(bindW.get(n));
/** nearest point on a polyline → arc length (the first / last segments extend beyond their ends) */
function arcParam(p, pts) {
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ab = b.clone().sub(a), len = ab.length();
    let t = p.clone().sub(a).dot(ab) / (len * len);
    const lo = i === 0 ? -Infinity : 0, hi = i === pts.length - 2 ? Infinity : 1;
    t = Math.min(hi, Math.max(lo, t));
    const d = a.clone().addScaledVector(ab, t).distanceToSquared(p);
    if (d < best) { best = d; bestS = acc + t * len; }
    acc += len;
  }
  return bestS;
}
/** piecewise-linear weights between stations [(bone, s)] */
function stationWeights(s, st) {
  if (s <= st[0][1]) return [[st[0][0], 1]];
  for (let i = 0; i < st.length - 1; i++) {
    const [b0, s0] = st[i], [b1, s1] = st[i + 1];
    if (s <= s1) { const f = s1 === s0 ? 1 : (s - s0) / (s1 - s0); return b0 === b1 ? [[b0, 1]] : [[b0, 1 - f], [b1, f]]; }
  }
  return [[st[st.length - 1][0], 1]];
}
const armStations = {};
for (const side of ['R', 'L']) {
  const S = posOf(`${side}_upperarm`), E = posOf(`${side}_forearm`), W = posOf(`${side}_hand`);
  const Lf = E.distanceTo(W);
  const ud = E.clone().sub(S).normalize(), fd = W.clone().sub(E).normalize();
  armStations[side] = {
    E, fd,
    // the elbow: which side of the plane through E that bisects the bend (a smooth blend across it, no projection jump
    // on the inside of the bend)
    bis: ud.clone().add(fd).normalize(),
    // along the forearm from E: the forearm's own roll, then the twist bones, then the hand over the wrist
    st: [[`${side}_forearm`, 0], [`${side}_forearm`, 0.03], [`${side}_twist3`, 0.22 * Lf], [`${side}_twist2`, 0.55 * Lf],
      [`${side}_twist1`, 0.85 * Lf], [`${side}_hand`, Lf + 0.012]],
  };
}
const ELBOW_BLEND = 0.05;
function weightsFor(rule, p) {
  if (rule.type === 'arm') {
    const a = armStations[rule.side];
    const rel = p.clone().sub(a.E);
    const f = sstep(-ELBOW_BLEND, ELBOW_BLEND, rel.dot(a.bis));
    const fore = stationWeights(Math.max(0, rel.dot(a.fd)), a.st).map(([bn, x]) => [bn, x * f]);
    return f >= 1 ? fore : [[`${rule.side}_upperarm`, 1 - f], ...fore].filter(([, x]) => x > 1e-4);
  }
  if (rule.type === 'hand') {
    const side = rule.bone[0];
    const hw = bindW.get(rule.bone), inv = hw.clone().invert();
    const lp = p.clone().applyMatrix4(inv);
    const long = side === 'R' ? new Vector3(0.2248, 0.9272, -0.2997).normalize() : new Vector3(0, 1, 0);
    const f = sstep(-0.02, 0.014, lp.dot(long));
    return f >= 1 ? [[rule.bone, 1]] : [[rule.bone, f], [`${side}_twist1`, 1 - f]];
  }
  if (rule.type === 'chain') {
    const [hand, b1, b2, b3] = rule.bones;
    const J1 = posOf(b1), J2 = posOf(b2), J3 = posOf(b3);
    const tip = J3.clone().add(J3.clone().sub(J2).normalize().multiplyScalar(0.03));
    const s = arcParam(p, [J1, J2, J3, tip]);
    const a2 = J1.distanceTo(J2), a3 = a2 + J2.distanceTo(J3);
    const bw = b1.includes('thumb') ? 0.011 : 0.0055;
    const w = new Map();
    const add = (b, x) => { if (x > 1e-4) w.set(b, (w.get(b) ?? 0) + x); };
    const f1 = sstep(-bw - (b1.includes('thumb') ? 0.006 : 0), bw, s), f2 = sstep(a2 - bw, a2 + bw, s), f3 = sstep(a3 - bw, a3 + bw, s);
    add(hand, 1 - f1); add(b1, f1 * (1 - f2)); add(b2, f2 * (1 - f3)); add(b3, f3);
    return [...w.entries()];
  }
  throw new Error(`rule ${rule.type}`);
}

// ── the arms mesh ──
const armParts = P.parts.filter((p) => p.rule.type !== 'rigid');
let nV = 0;
for (const p of armParts) nV += p.pos.length / 3;
const pos = new Float32Array(nV * 3), col = new Float32Array(nV * 3), jnt = new Uint8Array(nV * 4), wgt = new Float32Array(nV * 4);
let v = 0;
const worst = { sum: 0 };
for (const p of armParts) {
  for (let i = 0; i < p.pos.length / 3; i++, v++) {
    const q = new Vector3(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
    pos.set([q.x, q.y, q.z], v * 3);
    col.set([p.col[i * 3], p.col[i * 3 + 1], p.col[i * 3 + 2]], v * 3);
    const ws = weightsFor(p.rule, q).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = ws.reduce((s, [, x]) => s + x, 0);
    ws.forEach(([b, x], k) => {
      const j = jIndex.get(b);
      if (j === undefined) throw new Error(`weight on ${b}: not a joint`);
      jnt[v * 4 + k] = j; wgt[v * 4 + k] = x / sum;
    });
    worst.sum = Math.max(worst.sum, Math.abs(1 - wgt.slice(v * 4, v * 4 + 4).reduce((s, x) => s + x, 0)));
  }
}
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', pos)).setAttribute('COLOR_0', acc('VEC3', col))
  .setAttribute('JOINTS_0', acc('VEC4', jnt)).setAttribute('WEIGHTS_0', acc('VEC4', wgt));
const ibm = new Float32Array(joints.length * 16);
joints.forEach((n, i) => { ibm.set(bindW.get(n).clone().invert().toArray(), i * 16); });
const skin = doc.createSkin('arms').setInverseBindMatrices(acc('MAT4', ibm)).setSkeleton(vmRoot);
for (const n of joints) skin.addJoint(node(n));
const armsNode = doc.createNode('arms').setMesh(doc.createMesh('arms').addPrimitive(prim)).setSkin(skin);
vmRoot.addChild(armsNode);

// ── the swords: rigid on R_weapon (weapon-local), iron with its metalness per vertex ──
for (const p of P.parts.filter((q) => q.rule.type === 'rigid')) {
  const kind = p.name.split('.')[1];
  const pr = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(p.pos))).setAttribute('COLOR_0', acc('VEC3', new Float32Array(p.col)));
  if (p.metal !== undefined) pr.setAttribute('_METAL', acc('SCALAR', new Float32Array(p.metal)));
  node('R_weapon').addChild(doc.createNode(`sword_${kind}`).setMesh(doc.createMesh(`sword_${kind}`).addPrimitive(pr)));
}

// ── the swim clips: wrist paths → the rig's IK ──
const spec = { R: RIGHT_HAND, L: LEFT_HAND };
const owner = (side) => { // the hand's owner frame at bind (right: the jian, left: the gauntlet): hand × T(−wrist)
  const hw = bindW.get(`${side}_hand`), t = new Vector3(), q = new Quaternion(), s = new Vector3();
  hw.decompose(t, q, s);
  return { pos: t.clone().sub(spec[side].wrist.clone().applyQuaternion(q)), quat: q };
};
const consts = {};
for (const side of ['R', 'L']) {
  const S = posOf(`${side}_upperarm`), E = posOf(`${side}_forearm`);
  consts[side] = armConst(side === 'R' ? 1 : -1, spec[side], owner(side), S, S.distanceTo(E), new Vector3());
}
/** the hand's rotation (hand-local → rig) that points its fingers along f and its back along b */
function handQ(side, f, b) {
  const L = spec[side].long.clone().normalize(), B = spec[side].back.clone().normalize();
  const Bl = B.clone().addScaledVector(L, -B.dot(L)).normalize();
  const ml = new Matrix4().makeBasis(L, Bl, new Vector3().crossVectors(L, Bl));
  const F = f.clone().normalize(), Bt = b.clone().addScaledVector(F, -b.dot(F)).normalize();
  const mt = new Matrix4().makeBasis(F, Bt, new Vector3().crossVectors(F, Bt));
  return new Quaternion().setFromRotationMatrix(mt.multiply(ml.transpose()));
}
const v3 = (x, y, z) => new Vector3(x, y, z);
/** periodic Catmull-Rom over keys [t, value] (t in [0, 1)) */
function loopCR(keys, t, pick) {
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= t) i = k;
  const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
  const t1 = k1[0], t2 = k2[0] <= t1 ? k2[0] + 1 : k2[0];
  const u = ((t < t1 ? t + 1 : t) - t1) / (t2 - t1);
  const a = pick(k0), b = pick(k1), c = pick(k2), d = pick(k3);
  const u2 = u * u, u3 = u2 * u;
  return new Vector3()
    .addScaledVector(a, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(b, 1.5 * u3 - 2.5 * u2 + 1)
    .addScaledVector(c, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(d, 0.5 * u3 - 0.5 * u2);
}
/** the water plane the swim clips are framed on (rig space, level view): the runtime's water line (Hands.ts) */
const WATER_Y = -0.16;
// Keys are anatomical, like the rig gate reads them (rig.ts `measure`): the wrist W, the elbow's pole (out, down, back),
// and the hand from the forearm: pronation (0 = thumb up, + = palm turning down), flexion (+ extension / - toward the
// palm), deviation (+ radial / - ulnar), inside rig.ts's LIMITS. The left arm mirrors x.
// breaststroke, right hand: glide (palms down, together) -> sweep out (palms out, thumbs down) -> pull in and down (palms
// back) -> recover under the chin (palms in) -> shoot forward
const STROKE = [
  [0.00, { w: v3(0.078, WATER_Y + 0.004, -0.570), pron: 62, flex: 4, dev: 0, pole: v3(0.30, -0.38, 0.12) }],
  [0.28, { w: v3(0.105, WATER_Y + 0.000, -0.515), pron: 72, flex: -8, dev: -14, pole: v3(0.34, -0.34, 0.10) }],
  [0.50, { w: v3(0.115, WATER_Y - 0.026, -0.415), pron: 48, flex: -40, dev: -24, pole: v3(0.34, -0.40, 0.08) }],
  [0.73, { w: v3(0.085, WATER_Y - 0.018, -0.39), pron: 30, flex: 6, dev: -22, pole: v3(0.28, -0.45, 0.08) }],
];
const TREAD_T = 2.4;
function treadKey(t) {
  const a = t * Math.PI * 2;
  return {
    w: v3(0.112 + Math.sin(a) * 0.028, WATER_Y + 0.003 + Math.sin(a + 0.8) * 0.008, -0.46 + Math.sin(2 * a) * 0.02),
    pron: 55 + Math.sin(a) * 18, flex: -6 + Math.sin(a + 1.2) * 10, dev: -4, pole: v3(0.30, -0.40, 0.10),
  };
}
const mirror = (k) => ({ ...k, w: v3(-k.w.x, k.w.y, k.w.z), pole: v3(-k.pole.x, k.pole.y, k.pole.z) });
function strokeKey(t) {
  const vec = (name) => (k) => k[1][name];
  const num = (name) => (k) => v3(k[1][name], 0, 0);
  return { w: loopCR(STROKE, t, vec('w')), pole: loopCR(STROKE, t, vec('pole')), pron: loopCR(STROKE, t, num('pron')).x, flex: loopCR(STROKE, t, num('flex')).x, dev: loopCR(STROKE, t, num('dev')).x };
}
/** the hand's rotation from the forearm and the anatomical angles (the inverse of rig.ts `measure`) */
function anatHand(side, S, E, W, k) {
  const sd = side === 'R' ? 1 : -1, D = Math.PI / 180;
  const upper = E.clone().sub(S).normalize(), fore = W.clone().sub(E).normalize(), yF = fore.clone().negate();
  const hinge = new Vector3().crossVectors(upper, fore);
  if (hinge.lengthSq() < 1e-8) hinge.set(sd, 0, 0);
  hinge.normalize();
  const zN = hinge.multiplyScalar(sd); zN.addScaledVector(yF, -zN.dot(yF)).normalize();
  const zD = zN.clone().applyAxisAngle(yF, sd * k.pron * D);
  const xR = new Vector3().crossVectors(yF, zD).multiplyScalar(sd);
  const long = fore.clone().addScaledVector(xR, Math.tan(k.dev * D)).addScaledVector(zD, Math.tan(k.flex * D)).normalize();
  return handQ(side, long, zD);
}
const gate = { reach: [], angles: [] };
/** one arm's bone locals for a key: shoulder t, upperarm / forearm / twists / hand q */
function armLocals(side, k) {
  const c = consts[side];
  const S = posOf(`${side}_upperarm`);
  const r = twoBone(S, k.w, k.w.clone().add(k.pole), c.Lu, spec[side].foreLen);
  const q = anatHand(side, S, r.E, r.W, k);
  const w = buildBones(c, S, r.E, r.W, q, 0);
  gate.reach.push(r.W.distanceTo(k.w));
  gate.angles.push(measure(c.side, S, r.E, r.W, q, spec[side]));
  const inv = (m) => m.clone().invert();
  const dq = (m) => { const t = new Vector3(), qq = new Quaternion(), s = new Vector3(); m.decompose(t, qq, s); return { t, q: qq }; };
  return {
    [`${side}_shoulder`]: dq(w.shoulder),
    [`${side}_upperarm`]: dq(inv(w.shoulder).multiply(w.upper)),
    [`${side}_forearm`]: dq(inv(w.upper).multiply(w.fore)),
    [`${side}_twist1`]: dq(inv(w.fore).multiply(w.twists[0])),
    [`${side}_twist2`]: dq(inv(w.fore).multiply(w.twists[1])),
    [`${side}_twist3`]: dq(inv(w.fore).multiply(w.twists[2])),
    [`${side}_hand`]: dq(inv(w.fore).multiply(w.hand)),
  };
}
function addClip(name, duration, keyAt, fingerPose, lagL) {
  const fps = 60, n = Math.round(duration * fps) + 1;
  const times = new Float32Array(n);
  const tracks = new Map(); // "bone.path" → number[]
  const push = (k, arr) => { let t = tracks.get(k); if (t === undefined) { t = []; tracks.set(k, t); } t.push(...arr); };
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) % 1; // the last sample repeats the first: a seamless loop
    times[i] = (i / (n - 1)) * duration;
    const R = armLocals('R', keyAt(u));
    const L = armLocals('L', mirror(keyAt((u - lagL + 1) % 1)));
    for (const [b, x] of Object.entries({ ...R, ...L })) {
      if (b.endsWith('_shoulder')) push(`${b}.translation`, x.t.toArray());
      else push(`${b}.rotation`, x.q.toArray());
    }
  }
  const anim = doc.createAnimation(name);
  const input = acc('SCALAR', times);
  for (const [k, arr] of tracks) {
    const [b, path] = k.split('.');
    const s = doc.createAnimationSampler().setInput(input).setOutput(acc(path === 'translation' ? 'VEC3' : 'VEC4', new Float32Array(arr))).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node(b)).setTargetPath(path).setSampler(s));
  }
  // the fingers hold the swim pose (two keys)
  const t2 = acc('SCALAR', new Float32Array([0, duration]));
  for (const side of ['R', 'L']) for (const b of P.hands[side].bones) {
    const q = fingerLocal.get(b.name).q.clone().multiply(deltaQ(side, fingerPose, b.name)).toArray();
    const s = doc.createAnimationSampler().setInput(t2).setOutput(acc('VEC4', new Float32Array([...q, ...q]))).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node(b.name)).setTargetPath('rotation').setSampler(s));
  }
}
addClip('swimStroke', 0.85, strokeKey, 'swim', 0.03);
addClip('swimTread', TREAD_T, treadKey, 'tread', 0.5);

// ── the scene's extras: the clips' metadata (ND's 16 + the swim clips), the blade, the water line ──
const ex = vmRoot.getExtras();
const clips = { ...ex.clips, swimStroke: { side: 'B', loop: true, timing: null, trailFrom: null }, swimTread: { side: 'B', loop: true, timing: null, trailFrom: null } };
vmRoot.setExtras({
  rig: 'driftwood-fp', version: 1, from: 'nine-dragon-fp (fp-rig.glb, round 13): its skeleton and 16 clips; castaway meshes, finger bones, swim clips (E334)',
  canon: ex.canon, clips, swords: P.swords, water: { y: WATER_Y },
});

await doc.transform(prune(), ...(RAW ? [] : [meshopt({ encoder: MeshoptEncoder, level: 'medium' })]));
await io.write(outPath, doc);
const tris = nV / 3;
const swordTris = Object.fromEntries(P.parts.filter((q) => q.rule.type === 'rigid').map((q) => [q.name, q.pos.length / 9]));
const ang = gate.angles;
const range = (k) => [Math.min(...ang.map((a) => a[k])), Math.max(...ang.map((a) => a[k]))].map((x) => Math.round(x));
console.log(JSON.stringify({ out: outPath, joints: joints.length, armsTris: tris, swordTris, weightSumErr: worst.sum, reachMiss: Math.max(...gate.reach).toFixed(4),
  swimAngles: { elbow: range('elbow'), pronation: range('pronation'), flexion: range('flexion'), deviation: range('deviation') } }));
