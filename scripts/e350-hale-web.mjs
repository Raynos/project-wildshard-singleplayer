#!/usr/bin/env node
// e350-hale-web.mjs — E350 F-X3: the web between a Pine Hollow person's arm and coat, measured on the files the rig loads
// (public/assets/pine-hollow/npcs/<kind>[.phone].glb, rigged by src/shards/pine-hollow/quest/npcRig.ts rigLegs as the game does).
// Poses Hale's point (the clip's own inputs) and reports the edges that stretch: which bones their ends ride, the rest and
// posed lengths, and how many triangles join the forearm chain (twist · elbow · hand) to the torso (hips · spine · chest).
//
//   node --import ./scripts/bake-loader.mjs scripts/e350-hale-web.mjs [--kind=ranger] [--file=<glb>]
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import * as THREE from 'three';
import { rigLegs } from '../src/shards/pine-hollow/quest/npcRig.ts';
import { legBones, legPose, LEG_BONE_NAMES } from '../src/game/systems/npc/npcRig.ts';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const KIND = flag('kind', 'ranger');
const FILES = flag('file', '') ? [flag('file', '')] : [`public/assets/pine-hollow/npcs/${KIND}.glb`, `public/assets/pine-hollow/npcs/${KIND}.phone.glb`];
const cliAbs = realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

async function geometryOf(file) {
  const doc = await io.read(resolvePath(ROOT, file));
  const node = doc.getRoot().listNodes().find((nd) => nd.getMesh() !== null);
  const prim = node.getMesh().listPrimitives()[0], pos = prim.getAttribute('POSITION');
  const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  const n = pos.getCount(), out = new Float32Array(n * 3), e = [0, 0, 0], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { pos.getElement(i, e); v.set(e[0], e[1], e[2]).applyMatrix4(m); out.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setIndex(Array.from(prim.getIndices().getArray()));
  return g;
}
const J = Object.fromEntries(LEG_BONE_NAMES.map((n, i) => [n, i]));
const set = (...names) => new Set(names.map((n) => J[n]));
const FORE = { R: set('twistR', 'elbowR', 'handR'), L: set('twistL', 'elbowL', 'handL') };
const TORSO = set('hips', 'spine', 'chest');
const share = (b, i, s) => { const si = b.geometry.getAttribute('skinIndex'), sw = b.geometry.getAttribute('skinWeight'); let w = 0; for (let k = 0; k < 4; k++) if (s.has(si.getComponent(i, k))) w += sw.getComponent(i, k); return w; };
const domName = (b, i) => { const si = b.geometry.getAttribute('skinIndex'), sw = b.geometry.getAttribute('skinWeight'); let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); } return LEG_BONE_NAMES[best]; };

for (const file of FILES) {
  const b = rigLegs(KIND, await geometryOf(file));
  const bones = legBones(b), mesh = new THREE.SkinnedMesh(b.geometry, new THREE.MeshBasicMaterial());
  mesh.add(bones[0]); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  const pose = legPose(bones, b);
  pose({ t: 1.3, talk: 1, point: 1, pointYaw: 0.6, look: 0, walk: 0, phase: 0 });
  mesh.updateMatrixWorld(true);
  const P = b.geometry.getAttribute('position'), I = b.geometry.getIndex(), n = P.count;
  const posed = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); mesh.applyBoneTransform(i, v); posed.set([v.x, v.y, v.z], i * 3); }
  const len = (A, a, c) => Math.hypot(A[a * 3] - A[c * 3], A[a * 3 + 1] - A[c * 3 + 1], A[a * 3 + 2] - A[c * 3 + 2]);
  const R = new Float32Array(n * 3); for (let i = 0; i < n; i++) R.set([P.getX(i), P.getY(i), P.getZ(i)], i * 3);
  let bridging = 0, stretched = 0, worst = 0;
  const pairs = {};
  const rows = [];
  for (let f = 0; f < I.count; f += 3) {
    const t = [I.getX(f), I.getX(f + 1), I.getX(f + 2)];
    let mx = 0, restAt = 0, ea = 0, ec = 0;
    for (let e = 0; e < 3; e++) { const a = t[e], c = t[(e + 1) % 3]; const r0 = len(R, a, c), r1 = len(posed, a, c); if (r1 / Math.max(r0, 1e-4) > mx / Math.max(restAt, 1e-4)) { mx = r1; restAt = r0; ea = a; ec = c; } }
    const foreR = t.some((i) => share(b, i, FORE.R) > 0.5), torso = t.some((i) => share(b, i, TORSO) > 0.5 && share(b, i, FORE.R) < 0.05);
    if (foreR && torso) bridging++;
    if (mx > 0.3 && mx / Math.max(restAt, 1e-4) > 2.5) {
      stretched++; worst = Math.max(worst, mx);
      const key = [domName(b, ea), domName(b, ec)].sort((left, right) => left.localeCompare(right)).join('-');
      pairs[key] = (pairs[key] ?? 0) + 1;
      if (rows.length < 6) rows.push({ rest: Number(restAt.toFixed(3)), posed: Number(mx.toFixed(3)), a: [R[ea * 3], R[ea * 3 + 1], R[ea * 3 + 2]].map((q) => Number(q.toFixed(2))), c: [R[ec * 3], R[ec * 3 + 1], R[ec * 3 + 2]].map((q) => Number(q.toFixed(2))), key });
    }
  }
  console.log(file, JSON.stringify({ webs: b.webs, verts: n, tris: I.count / 3, H: Number(b.height.toFixed(3)), bridgingForeRToTorso: bridging, trisStretchedPast30cmAnd2p5x: stretched, worstPosedEdge: Number(worst.toFixed(2)), byBonePair: pairs, sample: rows }));
}

// --img=<out.png>: before (the web kept) / after (cut) × idle / point × front / his right 3/4 / his right side, software-
// rendered (Lambert grey, back faces culled as the game's material culls them), front / his right 3/4 / his right / back
if (argv.some((a) => a.startsWith('--img='))) {
  const sharp = req('sharp');
  const file = FILES[0];
  const src = await geometryOf(file);
  const b = rigLegs(KIND, src);
  const RS = 360, views = [0, -45, -90, 180], cells = [];
  for (const [, index] of [['before', Array.from(src.getIndex().array)], ['after', Array.from(b.geometry.getIndex().array)]]) {
    for (const point of [0, 1]) {
      const bones = legBones(b), mesh = new THREE.SkinnedMesh(b.geometry, new THREE.MeshBasicMaterial());
      mesh.add(bones[0]); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
      legPose(bones, b)({ t: 1.3, talk: point, point, pointYaw: 0.6 * point, look: 0, walk: 0, phase: 0 });
      mesh.updateMatrixWorld(true);
      const P = b.geometry.getAttribute('position'), n = P.count, S = new Float32Array(n * 3), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); mesh.applyBoneTransform(i, v); S.set([v.x, v.y, v.z], i * 3); }
      for (const azd of views) {
        const az = azd * Math.PI / 180, c = Math.cos(az), s = Math.sin(az), sc = RS / (argv.includes("--zoom") ? 0.9 : 2.3), cx = RS / 2, cy = RS * (argv.includes("--zoom") ? 1.75 : 0.95);
        const img = Buffer.alloc(RS * RS * 3, 235), zb = new Float32Array(RS * RS).fill(-Infinity);
        const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = S[i * 3], y = S[i * 3 + 1] - b.y0, z = S[i * 3 + 2]; X[i] = cx + (x * c - z * s) * sc; Y[i] = cy - y * sc; Z[i] = x * s + z * c; }
        for (let t = 0; t < index.length; t += 3) {
          const A = index[t], B = index[t + 1], C = index[t + 2];
          const area = (X[B] - X[A]) * (Y[C] - Y[A]) - (X[C] - X[A]) * (Y[B] - Y[A]);
          if (area > -1e-9) continue;   // back-facing: culled, as the game's single-sided material draws it
          const ux = S[B * 3] - S[A * 3], uy = S[B * 3 + 1] - S[A * 3 + 1], uz = S[B * 3 + 2] - S[A * 3 + 2], wx = S[C * 3] - S[A * 3], wy = S[C * 3 + 1] - S[A * 3 + 1], wz = S[C * 3 + 2] - S[A * 3 + 2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          const shade = Math.round(60 + 170 * Math.max(0, nx * 0.3 + ny * 0.6 + (nx * s + nz * c) * 0.7));
          const minX = Math.max(0, Math.floor(Math.min(X[A], X[B], X[C]))), maxX = Math.min(RS - 1, Math.ceil(Math.max(X[A], X[B], X[C])));
          const minY = Math.max(0, Math.floor(Math.min(Y[A], Y[B], Y[C]))), maxY = Math.min(RS - 1, Math.ceil(Math.max(Y[A], Y[B], Y[C])));
          for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
            const qx = px + 0.5, qy = py + 0.5;
            const w0 = ((X[B] - qx) * (Y[C] - qy) - (X[C] - qx) * (Y[B] - qy)) / area, w1 = ((X[C] - qx) * (Y[A] - qy) - (X[A] - qx) * (Y[C] - qy)) / area, w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * Z[A] + w1 * Z[B] + w2 * Z[C], o = py * RS + px;
            if (z <= zb[o]) continue;
            zb[o] = z;
            img[o * 3] = shade; img[o * 3 + 1] = shade; img[o * 3 + 2] = shade;
          }
        }
        cells.push(img);
      }
    }
  }
  const cols = views.length * 2, rows = 2, out = Buffer.alloc(cols * RS * rows * RS * 3, 255);
  cells.forEach((img, k) => { const r = Math.floor(k / cols), cc = k % cols; for (let y = 0; y < RS; y++) img.copy(out, ((r * RS + y) * cols * RS + cc * RS) * 3, y * RS * 3, (y + 1) * RS * 3); });
  await sharp(out, { raw: { width: cols * RS, height: rows * RS, channels: 3 } }).png().toFile(flag('img', 'hale.png'));
}
