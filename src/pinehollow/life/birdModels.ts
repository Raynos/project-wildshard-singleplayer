/**
 * Pine Hollow's modelled birds (PINE-HOLLOW-REMASTER §5 Polish): the raven, the great grey owl and the pileated woodpecker,
 * each PERCHED (wings folded) and FLYING (wings spread flat), generated from codex references (image-to-3D, PBR texture,
 * `art/pine-hollow/round-16-birds/`) into ONE GLB of six meshes sharing ONE atlas (4 × 2 tiles of 512², 1024 × 512 on the
 * phone: `birds.phone.glb` through tierUrl), plus a sidecar `birds.json` of the pivots measured on each mesh (the wing
 * roots, the body's half-width, the neck, the head's axis, the feet).
 *
 *   const set = await loadBirdModels();     // null: Debug ▸ Pine Hollow birds = Procedural, or the load failed — the procedural birds stay
 *   wild.useBirds(set, renderer);           // WildlifeMesh swaps its geometry + binds the atlas: same draw, same program
 *
 * Each mesh is put into the frame the life code poses (lifeMath / index.ts are unchanged): model space forward +z, up +y,
 * the body centre at the pose point. A PERCHED model stands as generated — the raven and the owl keep their own stance
 * (pre-tilted by the pitch index.ts gives them perched, so that pitch stands them back up), the woodpecker's body axis is
 * laid level first so its perch pitch (1.3 rad) stands it against the trunk, belly to the bark — and its feet sit at the
 * height the procedural bird's did (RAVEN_STAND / OWL_STAND), so every perch spot and landing lines up.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KIND, type WildKind } from './wildlifeMesh';
import { setting } from '../../ui/Settings';

export const BIRDS_URL = '/assets/pine-hollow/life/birds.glb';
export const BIRDS_JSON_URL = '/assets/pine-hollow/life/birds.json';

type V3 = readonly [number, number, number];
/** one mesh, in the pose frame, with what WildlifeMesh needs to tell its parts */
export interface BirdMesh {
  kind: WildKind; fly: boolean; geo: THREE.BufferGeometry;
  /** per vertex: 0 body, 1 left wing, 2 right wing, 3 head (told in the generated frame, before the pose tilt) */
  parts: Uint8Array;
  shoulderL: V3; shoulderR: V3; neck: V3;
  rough: number; eyes: boolean;
}
export interface BirdSet { meshes: BirdMesh[]; atlas: THREE.Texture }

interface Side {
  shoulderL: V3; shoulderR: V3; bodyHalfWidth: number; neck: V3; headAxis?: V3; feetY: number;
  tailRoot?: V3; beakTip?: V3;
}
interface Sidecar { meshes: Record<string, Side | undefined> }

/** per bird: its kind, the perched pitch index.ts gives it and the head pitch it holds against that (the procedural owl's
 *  head is pitched back down 1.1 on its tipped-up body), its feet under the body centre (model units: the stand height ÷
 *  the pose scale), roughness (a raven's glossy black, an owl's matte down), whether its eyes shine */
const BIRDS = [
  { name: 'raven', kind: KIND.raven, perchPitch: 0.12, headPitch: 0, feet: 0.2 / 1.1, level: false, rough: 0.62, eyes: false },
  { name: 'owl', kind: KIND.owl, perchPitch: 1.1, headPitch: 1.1, feet: 0.16 / 1.05, level: false, rough: 0.9, eyes: true },
  { name: 'wood', kind: KIND.woodpecker, perchPitch: 1.3, headPitch: 0, feet: 0.115, level: true, rough: 0.6, eyes: false },
] as const;

/** Debug ▸ Creatures & NPCs ▸ Pine Hollow birds = Procedural keeps the procedural birds (the fallback, and the before of
 *  the polish board; E162: undecided, so a Debug row, not a URL switch) */
export function birdModelsWanted(): boolean {
  return setting('birds') !== 'proc';
}

export async function loadBirdModels(): Promise<BirdSet | null> {
  if (!birdModelsWanted()) return null;
  try {
    const [gltf, side] = await Promise.all([
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(BIRDS_URL),
      fetch(BIRDS_JSON_URL).then(async (r) => { if (!r.ok) throw new Error(`${BIRDS_JSON_URL}: ${r.status}`); return (await r.json()) as Sidecar; }),
    ]);
    return parseBirds(gltf.scene, side);
  } catch (e: unknown) {
    console.warn('[birds] the modelled birds did not load — the procedural ones stay:', e);
    return null;
  }
}

/** a decimated generation reads faceted (its normals split along every uv seam and hard edge): one normal per position,
 *  area-weighted over the faces round it, keeping the vertices (and their uvs) split */
function smoothNormals(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  const key = (i: number): string => `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`;
  const acc = new Map<string, THREE.Vector3>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tri = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const n = c.sub(b).cross(a.sub(b)); // area-weighted
    for (const i of [i0, i1, i2]) { const k = key(i); const v = acc.get(k); if (v) v.add(n); else acc.set(k, n.clone()); }
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i));
    if (!v) continue;
    const l = v.length() || 1;
    out[i * 3] = v.x / l; out[i * 3 + 1] = v.y / l; out[i * 3 + 2] = v.z / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const tf = (m: THREE.Matrix4, p: V3): V3 => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); return [_v.x, _v.y, _v.z]; };

function parseBirds(root: THREE.Object3D, side: Sidecar): BirdSet {
  root.updateMatrixWorld(true);
  const found = new Map<string, THREE.Mesh>();
  root.traverse((o) => { if ('isMesh' in o && o.isMesh === true) found.set(o.name, o as THREE.Mesh); });
  let atlas: THREE.Texture | null = null;
  const meshes: BirdMesh[] = [];
  for (const b of BIRDS) {
    for (const fly of [false, true]) {
      const name = `${b.name}_${fly ? 'fly' : 'perch'}`, mesh = found.get(name), s = side.meshes[name];
      if (!mesh || !s) throw new Error(`[birds] no '${name}' in the GLB / sidecar`);
      const mat = mesh.material;
      if (!Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial && mat.map) atlas ??= mat.map;
      // plain float geometry (meshopt's quantised streams decoded, the node's transform applied)
      const src = mesh.geometry, g = new THREE.BufferGeometry();
      for (const [attr, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
        const a = src.getAttribute(attr) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
        if (!a) throw new Error(`[birds] ${name}: no ${attr}`);
        const out = new Float32Array(a.count * size);
        for (let i = 0; i < a.count; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size === 3) out[i * size + 2] = a.getZ(i); }
        g.setAttribute(attr, new THREE.BufferAttribute(out, size));
      }
      const idx = src.getIndex();
      if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
      g.applyMatrix4(mesh.matrixWorld);
      smoothNormals(g);
      // the parts, in the generated frame: flying, outboard of the body's half-width a wing; the head past the plane
      // through the neck across its axis (+z flying; up-and-forward on the upright perched birds)
      const pos = g.getAttribute('position'), parts = new Uint8Array(pos.count);
      const N = s.neck, A = s.headAxis ?? [0, 0, 1];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (fly && Math.abs(x) > s.bodyHalfWidth) parts[i] = x < 0 ? 1 : 2;
        else if ((x - N[0]) * A[0] + (y - N[1]) * A[1] + (z - N[2]) * A[2] > 0) parts[i] = 3;
      }
      // into the pose frame (identity for the flying ones)
      _m.identity();
      if (!fly) {
        // the feet at the procedural stand height, then the tilt: the perch pitch undone (the raven / owl stand as
        // modelled), or the body axis laid level (the woodpecker: its perch pitch then stands it up the trunk)
        const lift = new THREE.Matrix4().makeTranslation(0, -b.feet - s.feetY, 0);
        let tilt: number = b.perchPitch;
        if (b.level && s.tailRoot && s.beakTip) tilt = Math.atan2(s.beakTip[1] - s.tailRoot[1], s.beakTip[2] - s.tailRoot[2]);
        // three's rotation about +x by +a turns the nose (+z) down: the instance's nose-up pitch takes it back
        _m.makeRotationX(tilt).multiply(lift);
        g.applyMatrix4(_m);
        // the head held back by the pitch the life code pitches it down by (the owl's 1.1 on its perch)
        if (b.headPitch !== 0) {
          const n = tf(_m, s.neck), r = new THREE.Matrix4().makeTranslation(n[0], n[1], n[2]).multiply(new THREE.Matrix4().makeRotationX(-b.headPitch)).multiply(new THREE.Matrix4().makeTranslation(-n[0], -n[1], -n[2]));
          const rn = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(-b.headPitch));
          const pa = g.getAttribute('position'), na = g.getAttribute('normal'), v = new THREE.Vector3();
          for (let i = 0; i < pa.count; i++) {
            if (parts[i] !== 3) continue;
            v.fromBufferAttribute(pa, i).applyMatrix4(r); pa.setXYZ(i, v.x, v.y, v.z);
            v.fromBufferAttribute(na, i).applyMatrix3(rn); na.setXYZ(i, v.x, v.y, v.z);
          }
        }
      }
      g.computeBoundingSphere();
      meshes.push({
        kind: b.kind, fly, geo: g, parts,
        shoulderL: tf(_m, s.shoulderL), shoulderR: tf(_m, s.shoulderR), neck: tf(_m, s.neck), rough: b.rough, eyes: b.eyes,
      });
    }
  }
  if (!atlas) throw new Error('[birds] the GLB carries no atlas');
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  return { meshes, atlas };
}
