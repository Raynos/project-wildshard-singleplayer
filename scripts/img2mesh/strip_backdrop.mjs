#!/usr/bin/env node
// strip_backdrop.mjs — repair a post-processed image-to-3D creature hull whose generation modelled the reference's white
// backdrop as a thin sheet under the hooves (E322 F-M1, the Antler King's upright hull: art/pine-hollow/round-25-e322-king-rig/).
// Runs between scripts/img2mesh/driftwood_post.py and scripts/creature-color.mjs:
//   1. cut every triangle lying within `ymax` of the ground that samples the atlas white (the sheet), and ground slivers
//      (the sheet's torn edge: longer than 6 cm, thinner than a tenth of that);
//   2. cut the sheet's small loose leftovers (welded pieces under 60 triangles, all below 15 cm);
//   3. cap the hoof soles: every open edge low on the hull (the soles the cut opened, or the generator never closed) is
//      fanned to its hoof's sole centre, wound against its neighbour, so a raised hoof shows a sole and not the background.
//
//   node scripts/img2mesh/strip_backdrop.mjs <post.glb> <out.glb> [ymax=0.12]
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(new URL('../..', import.meta.url).pathname);
const req = createRequire(realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { MeshoptDecoder, MeshoptEncoder } = req('meshoptimizer');
const { prune, compactPrimitive } = req('@gltf-transform/functions');
const sharp = req('sharp');
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const args = process.argv.slice(2);
const [src, out] = args;
if (!src || !out) throw new Error('usage: strip_backdrop.mjs <post.glb> <out.glb> [ymax]');
const ymax = args.length > 2 ? Number(args[2]) : 0.12;
const doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
const idx = I.getArray(), keep = [];
const pos = (i) => P.getElement(i, []);
const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture();
const img = await sharp(Buffer.from(tex.getImage())).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const W = img.info.width, Hh = img.info.height;
const texel = (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(Hh - 1, Math.max(0, Math.floor(v * Hh))); const o = (y * W + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
const white = (t) => [0, 1, 2].some((k) => { const uv = UV.getElement(idx[t + k], []); const c = texel(uv[0], uv[1]); return Math.min(...c) > 170 && Math.max(...c) - Math.min(...c) < 40; });

// 1. the sheet and its slivers
let cut = 0;
for (let t = 0; t < idx.length; t += 3) {
  const v = [0, 1, 2].map((k) => pos(idx[t + k]));
  const top = Math.max(v[0][1], v[1][1], v[2][1]);
  if (top < ymax && white(t)) { cut++; continue; }
  if (top < 0.06) {
    const e = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const L = Math.max(e(v[0], v[1]), e(v[1], v[2]), e(v[2], v[0]));
    const ax = v[1][0] - v[0][0], ay = v[1][1] - v[0][1], az = v[1][2] - v[0][2], bx = v[2][0] - v[0][0], by = v[2][1] - v[0][1], bz = v[2][2] - v[0][2];
    const area2 = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
    if (L > 0.06 && area2 / L < 0.1 * L) { cut++; continue; }
  }
  keep.push(idx[t], idx[t + 1], idx[t + 2]);
}

// welded ids (uv seams join)
const wkey = new Map(), wid = new Int32Array(P.getCount()), rep = [];
for (let i = 0; i < P.getCount(); i++) { const k = pos(i).map((x) => Math.round(x * 1e4)).join(','); let w = wkey.get(k); if (w === undefined) { w = wkey.size; wkey.set(k, w); rep.push(i); } wid[i] = w; }

// 2. the small low leftovers
{
  const par = Array.from({ length: wkey.size }, (_, i) => i);
  const find = (a0) => { let a = a0; while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < keep.length; t += 3) { par[find(wid[keep[t]])] = find(wid[keep[t + 1]]); par[find(wid[keep[t + 1]])] = find(wid[keep[t + 2]]); }
  const count = new Map(), top = new Map();
  for (let t = 0; t < keep.length; t += 3) { const r = find(wid[keep[t]]); count.set(r, (count.get(r) ?? 0) + 1); top.set(r, Math.max(top.get(r) ?? -1, ...[0, 1, 2].map((k) => pos(keep[t + k])[1]))); }
  const out2 = [];
  for (let t = 0; t < keep.length; t += 3) { const r = find(wid[keep[t]]); if ((count.get(r) ?? 0) < 60 && (top.get(r) ?? 0) < 0.15) { cut++; continue; } out2.push(keep[t], keep[t + 1], keep[t + 2]); }
  keep.length = 0; keep.push(...out2);
}

// 3. cap the low open loops: a boundary edge is a welded edge one triangle uses; its direction there is a → b
const edgeUse = new Map();
for (let t = 0; t < keep.length; t += 3) for (const [a, b] of [[keep[t], keep[t + 1]], [keep[t + 1], keep[t + 2]], [keep[t + 2], keep[t]]]) {
  const wa = wid[a], wb = wid[b], k = wa < wb ? `${wa},${wb}` : `${wb},${wa}`;
  const e = edgeUse.get(k); if (e) e.n++; else edgeUse.set(k, { n: 1, a: wa, b: wb, ia: a, ib: b });
}
// every open edge low on the hull (a sole's rim, loops or broken chains alike) is fanned to its hoof's sole centre: the
// edges are grouped by hoof (the quadrant: side × front / back), each fan triangle wound against its edge's own triangle
const newPos = [], newNrm = [], newUv = [];
const groups = new Map();
for (const e of edgeUse.values()) {
  if (e.n !== 1) continue;
  const pa = pos(e.ia), pb = pos(e.ib);
  if (Math.max(pa[1], pb[1]) > 0.3) continue;
  const g = `${Math.sign(pa[0] + pb[0])},${Math.sign(pa[2] + pb[2])}`;
  let list = groups.get(g); if (!list) { list = []; groups.set(g, list); } list.push(e);
}
let capTris = 0;
for (const list of groups.values()) {
  const c = [0, 0, 0]; let lo = Infinity;
  for (const e of list) for (const i of [e.ia, e.ib]) { const q = pos(i); c[0] += q[0]; c[2] += q[2]; lo = Math.min(lo, q[1]); }
  c[0] /= list.length * 2; c[2] /= list.length * 2; c[1] = lo;
  const ci = P.getCount() + newPos.length / 3;
  newPos.push(...c); newNrm.push(0, -1, 0); newUv.push(...UV.getElement(list[0].ia, []));
  for (const e of list) { keep.push(e.ib, e.ia, ci); capTris++; }
}
const capped = groups.size, openLeft = [...edgeUse.values()].filter((e) => e.n === 1).length - capTris;
if (newPos.length > 0) {
  const grow = (acc, extra, size) => { const n = acc.getCount(), arr = new Float32Array((n + extra.length / size) * size); for (let i = 0; i < n; i++) arr.set(acc.getElement(i, []), i * size); arr.set(extra, n * size); acc.setArray(arr).setNormalized(false); };
  grow(P, newPos, 3); grow(N, newNrm, 3); grow(UV, newUv, 2);
}
I.setArray(Uint32Array.from(keep));
compactPrimitive(prim);
await doc.transform(prune());
await io.write(out, doc);
console.log(`strip_backdrop: ${idx.length / 3} tris → ${keep.length / 3}: ${cut} cut, ${capped} hoof soles capped (${capTris} tris), ${openLeft} open edges left higher up`);
