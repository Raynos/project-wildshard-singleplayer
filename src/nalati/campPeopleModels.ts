/**
 * The camp's people as generated + rigged models (NALATI-MERGE D2) — a Look Lab variant beside Q2's procedural figures,
 * which stay the default (the user's rule: taste is his call). Settings `campPeople` (`?people=proc|blender|gen`):
 *
 *   blender  main's pipeline: the image-to-3D mesh through scripts/img2mesh/driftwood_post.py (Blender headless) —
 *            faceted, one flat colour per facet, Cycles AO in the vertex alpha, no texture
 *   gen      Nalati's pipeline: the image-to-3D mesh with its base-colour atlas (TRELLIS.2 / Hunyuan3D-2 → Blender
 *            normalise → gltf-transform), the five atlases packed into one texture here
 *
 * Files: `public/assets/nalati/models/people/<person>.<look>[.phone].glb` (metres, +Y up, feet on y = 0, facing +z;
 * references art/nalati-grasslands/round-10-models-merge/). Loaded only when the variant is picked.
 *
 * The rig is the procedural figures' own (src/nalati/campPeople.ts): per figure a ROOT (the feet: its yaw + breath), a
 * HEAD bone at the neck and a right-ARM bone at the shoulder — so the one runtime (turn to you, glance, nod, gesture, the
 * cook's stir, the child's skip) drives either look. All five figures are ONE SkinnedMesh on a 15-bone skeleton: 1 draw +
 * 1 shadow draw, as the procedural BatchedMesh. The weights are made at load, per figure, from its own mesh:
 *   1. fit     scaled to the procedural figure's height, feet on y = 0, centred;
 *   2. pivots  the neck at the narrowest cross-section near the procedural neck, the shoulder at the torso's edge below it;
 *   3. seed    head = above the neck; arm = the figure's right (−x) past the shoulder and near the shoulder → hand line
 *              (the hand: the lowest far-right point), anything it holds (the ladle, the whip) with it;
 *   4. smooth  Laplacian passes over the welded surface blur the head and arm borders into a soft neck and shoulder;
 *   5. unpose  the A-pose arm swung down to the procedural arm's rest (blended by its weight), so the same swings read.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TIER } from '../core/tier';
import { painterlyMaterial } from '../world/painterly';
import { rawFromGltf } from '../world/nalati/glbPaint';
import type { Sky } from '../world/Sky';

export type PeopleLook = 'proc' | 'blender' | 'gen';
export type ModelPeopleLook = Exclude<PeopleLook, 'proc'>;

/** a figure's procedural frame: its height and the two pivots (feet at the origin, facing +z, +x = its LEFT) */
export interface PersonFrame { height: number; neck: THREE.Vector3; shoulder: THREE.Vector3 }

/** the rig of one figure: root (feet), head (neck), arm (right shoulder) — world matrices written by the runtime */
export interface PersonBones { root: THREE.Bone; head: THREE.Bone; arm: THREE.Bone; neck: THREE.Vector3; shoulder: THREE.Vector3 }
export interface PeopleRig<K extends string> { mesh: THREE.SkinnedMesh; bones: Record<K, PersonBones>; look: ModelPeopleLook }

const DIR = '/assets/nalati/models/people/';
let loader: GLTFLoader | null = null;

/** the model file of each figure (the ids are campPeople.ts's) */
export const PERSON_FILE = { elder: 'elder', herderGate: 'herder-dauren', herderRail: 'herder-erlan', child: 'child', cook: 'cook' } as const;
export type PersonKey = keyof typeof PERSON_FILE;

export function peopleModelUrl(key: PersonKey, look: ModelPeopleLook): string {
  return `${DIR}${PERSON_FILE[key]}.${look}${TIER === 'phone' ? '.phone' : ''}.glb`;
}

interface Figure { key: PersonKey; geometry: THREE.BufferGeometry; map: THREE.Texture | null; neck: THREE.Vector3; shoulder: THREE.Vector3; head: Float32Array; arm: Float32Array }

const _v = new THREE.Vector3();

/** weld by position (1 mm): the surface graph for the smoothing (uv / facet seams split the vertices) */
function weld(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): { of: Int32Array; n: number } {
  const of = new Int32Array(pos.count), map = new Map<string, number>();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    let w = map.get(k);
    if (w === undefined) { w = n++; map.set(k, w); }
    of[i] = w;
  }
  return { of, n };
}

/** fit a loaded figure into its procedural frame and weight it (see the header) */
function fitFigure(key: PersonKey, geometry: THREE.BufferGeometry, map: THREE.Texture | null, frame: PersonFrame): Figure {
  const g = geometry;
  g.computeBoundingBox();
  const box = g.boundingBox ?? new THREE.Box3();
  const k = frame.height / Math.max(1e-3, box.max.y - box.min.y);
  const c = box.getCenter(new THREE.Vector3());
  g.translate(-c.x, -box.min.y, -c.z);
  g.scale(k, k, k);
  const pos = g.getAttribute('position'), n = pos.count, H = frame.height;
  // ── pivots: the neck = the narrowest torso cross-section near the procedural neck; the shoulder = the torso's right edge
  //    a little below it (the A-pose arm leaves the body there)
  const widthAt = (y: number, band: number, lim: number): number => {
    let w = 0;
    for (let i = 0; i < n; i++) { const vy = pos.getY(i), vx = pos.getX(i); if (Math.abs(vy - y) < band && Math.abs(vx) < lim) w = Math.max(w, Math.abs(vx)); }
    return w;
  };
  let neckY = frame.neck.y, best = Infinity;
  for (let y = frame.neck.y - 0.07 * H; y <= frame.neck.y + 0.05 * H; y += 0.005 * H) {
    const w = widthAt(y, 0.006 * H, 0.14 * H);
    if (w > 0 && w < best) { best = w; neckY = y; }
  }
  const shY = neckY - (frame.neck.y - frame.shoulder.y);
  let shX = 0;
  for (let i = 0; i < n; i++) { const vy = pos.getY(i), vx = pos.getX(i); if (Math.abs(vy - shY) < 0.02 * H && vx < 0 && vx > -0.2 * H) shX = Math.min(shX, vx); }
  if (shX > -0.05 * H) shX = frame.shoulder.x;
  const neck = new THREE.Vector3(0, neckY, frame.neck.z), shoulder = new THREE.Vector3(shX * 0.85, shY, 0);
  // the hand: the lowest point of the far right (−x beyond the shoulder, above the knee)
  let hand = new THREE.Vector3(shoulder.x - 0.12 * H, shY - 0.35 * H, 0.05 * H), handX = Infinity;
  for (let i = 0; i < n; i++) {
    const vx = pos.getX(i), vy = pos.getY(i);
    if (vy < shY - 0.12 * H && vy > shY - 0.5 * H && vx < handX) { handX = vx; hand = new THREE.Vector3(vx, vy, pos.getZ(i)); }
  }
  // ── seeds ──
  const { of, n: nw } = weld(pos);
  const head = new Float32Array(nw), arm = new Float32Array(nw), fixed = new Uint8Array(nw);
  const seg = new THREE.Line3(shoulder, hand), cp = new THREE.Vector3();
  const armR = 0.075 * H;
  for (let i = 0; i < n; i++) {
    const w = of[i] ?? 0;
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (_v.y > neckY + 0.015 * H) { head[w] = 1; fixed[w] = 1; continue; }
    if (_v.y > neckY - 0.03 * H) continue;                     // the neck: smoothed
    seg.closestPointToPoint(_v, true, cp);
    const d = cp.distanceTo(_v);
    const past = _v.x < shoulder.x - 0.01 * H;
    // the arm (and what the hand holds: below / beyond the hand, still out on the right)
    const held = _v.y < hand.y + 0.03 * H && _v.x < hand.x + 0.06 * H && _v.distanceTo(hand) < 0.4 * H;
    if (past && (d < armR || held)) { arm[w] = 1; fixed[w] = 1; }
    else if (d > armR * 1.6 || _v.x > shoulder.x + 0.03 * H) fixed[w] = 1;   // the body, for sure
  }
  // ── smooth: the unfixed band (neck, armpit) takes its neighbours' mean, a few passes ──
  const index = g.getIndex();
  const adj: number[][] = Array.from({ length: nw }, () => []);
  const tri = index ? index.count / 3 : n / 3;
  const vi = (t: number, corner: number): number => (index ? index.getX(t * 3 + corner) : t * 3 + corner);
  for (let t = 0; t < tri; t++) {
    const a = of[vi(t, 0)] ?? 0, b = of[vi(t, 1)] ?? 0, cc = of[vi(t, 2)] ?? 0;
    adj[a]?.push(b, cc); adj[b]?.push(a, cc); adj[cc]?.push(a, b);
  }
  for (let pass = 0; pass < 8; pass++) {
    for (const f of [head, arm]) {
      const next = f.slice();
      for (let w = 0; w < nw; w++) {
        if (fixed[w] === 1) continue;
        const nb = adj[w];
        if (!nb || nb.length === 0) continue;
        let s = 0;
        for (const j of nb) s += f[j] ?? 0;
        next[w] = s / nb.length;
      }
      f.set(next);
    }
  }
  const headV = new Float32Array(n), armV = new Float32Array(n);
  for (let i = 0; i < n; i++) { headV[i] = head[of[i] ?? 0] ?? 0; armV[i] = arm[of[i] ?? 0] ?? 0; }
  // ── unpose: the A-pose arm swung down onto the procedural arm's rest (down and a little forward), blended by its
  //    weight — so the runtime's swings (the gesture, the stir) start from where the procedural figure's arm hangs
  const q = new THREE.Quaternion().setFromUnitVectors(hand.clone().sub(shoulder).normalize(), new THREE.Vector3(0, -1, 0.28).normalize());
  const nrm = g.getAttribute('normal'), p1 = new THREE.Vector3(), n1 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = armV[i] ?? 0;
    if (a <= 0) continue;
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    p1.copy(_v).sub(shoulder).applyQuaternion(q).add(shoulder);
    _v.lerp(p1, a);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
    n1.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    p1.copy(n1).applyQuaternion(q);
    n1.lerp(p1, a).normalize();
    nrm.setXYZ(i, n1.x, n1.y, n1.z);
  }
  pos.needsUpdate = true; nrm.needsUpdate = true;
  return { key, geometry: g, map, neck, shoulder, head: headV, arm: armV };
}

/** the five atlases in one texture (3 × 2 cells, flipY off like glTF): each figure's uv moved into its cell */
function packAtlases(figs: Figure[]): THREE.Texture | null {
  const maps = figs.map((f) => f.map?.image as CanvasImageSource | undefined);
  const first = maps.find((m) => m !== undefined);
  if (first === undefined || typeof document === 'undefined') return null;
  const cell = TIER === 'phone' ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 3; canvas.height = cell * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  figs.forEach((f, i) => {
    const cx = i % 3, cy = Math.floor(i / 3);
    const img = maps[i];
    if (img !== undefined) ctx.drawImage(img, cx * cell, cy * cell, cell, cell);
    const uv = f.geometry.getAttribute('uv');
    if (uv instanceof THREE.BufferAttribute) {
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (cx + uv.getX(v)) / 3, (cy + uv.getY(v)) / 2);
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Load the five figures in one look and rig them as one SkinnedMesh. `frames` = the procedural figures (their heights and
 * pivots; campPeople.ts). The bones' world matrices are the runtime's to write (`matrixWorld`, no parents): root = the
 * body matrix, head = root × (neck, the head turn), arm = root × (shoulder, the arm swing) — as the BatchedMesh pieces.
 */
export async function loadPeopleRig<K extends PersonKey>(sky: Sky, look: ModelPeopleLook, frames: Record<K, PersonFrame>): Promise<PeopleRig<K>> {
  if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
  const gl = loader;
  const keys = Object.keys(frames) as K[];
  const figs = await Promise.all(keys.map(async (key) => {
    const gltf = await gl.loadAsync(peopleModelUrl(key, look));
    const r = rawFromGltf(gltf.scene, `person ${key}`);
    return fitFigure(key, r.geometry, r.map, frames[key]);
  }));
  const map = look === 'gen' ? packAtlases(figs) : null;
  // merge: position, normal, color (+ uv for the atlas look), skinIndex / skinWeight (root / head / arm of its figure)
  let total = 0, totalIdx = 0;
  for (const f of figs) { total += f.geometry.getAttribute('position').count; totalIdx += f.geometry.getIndex()?.count ?? f.geometry.getAttribute('position').count; }
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3), U = new Float32Array(total * 2);
  const SI = new Uint16Array(total * 4), SW = new Float32Array(total * 4), I = new Uint32Array(totalIdx);
  let o = 0, oi = 0;
  const bones = {} as Record<K, PersonBones>;
  const boneList: THREE.Bone[] = [], inverses: THREE.Matrix4[] = [];
  figs.forEach((f, fi) => {
    const key = keys[fi];
    if (key === undefined) return;
    const g = f.geometry, pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), col = g.getAttribute('color'), uv = g.hasAttribute('uv') ? g.getAttribute('uv') : null;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      const j = o + i;
      P[j * 3] = pos.getX(i); P[j * 3 + 1] = pos.getY(i); P[j * 3 + 2] = pos.getZ(i);
      N[j * 3] = nrm.getX(i); N[j * 3 + 1] = nrm.getY(i); N[j * 3 + 2] = nrm.getZ(i);
      C[j * 3] = col.getX(i); C[j * 3 + 1] = col.getY(i); C[j * 3 + 2] = col.getZ(i);
      if (uv) { U[j * 2] = uv.getX(i); U[j * 2 + 1] = uv.getY(i); }
      const h = Math.min(1, f.head[i] ?? 0), a = Math.min(1 - h, f.arm[i] ?? 0);
      SI[j * 4] = fi * 3; SI[j * 4 + 1] = fi * 3 + 1; SI[j * 4 + 2] = fi * 3 + 2;
      SW[j * 4] = 1 - h - a; SW[j * 4 + 1] = h; SW[j * 4 + 2] = a;
    }
    const idx = g.getIndex();
    const m = idx ? idx.count : n;
    for (let t = 0; t < m; t++) I[oi + t] = o + (idx ? idx.getX(t) : t);
    o += n; oi += m;
    const root = new THREE.Bone(), head = new THREE.Bone(), arm = new THREE.Bone();
    for (const b of [root, head, arm]) { b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; }
    root.name = `${f.key}-root`; head.name = `${f.key}-head`; arm.name = `${f.key}-arm`;
    boneList.push(root, head, arm);
    inverses.push(new THREE.Matrix4(), new THREE.Matrix4().makeTranslation(-f.neck.x, -f.neck.y, -f.neck.z), new THREE.Matrix4().makeTranslation(-f.shoulder.x, -f.shoulder.y, -f.shoulder.z));
    bones[key] = { root, head, arm, neck: f.neck, shoulder: f.shoulder };
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (map) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  const mat = painterlyMaterial(sky, { map, rim: 0.35, bands: 0.8 });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = `nalati-camp-people-${look}`;
  mesh.bind(new THREE.Skeleton(boneList, inverses), new THREE.Matrix4());
  mesh.frustumCulled = false;   // five figures spread over the camp, moving: the batch did its own culling, this is 1 draw
  mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, bones, look };
}
