/**
 * glbCreatures — the generated creature hulls, pre-skinned to the procedural species' skeletons, so the species' own
 * bones, gaits and AI drive them (AnimalFactory 'painterly' style, Nalati; behind `?creatures=glb`).
 *
 *   preloadCreatureGlbs();                                  // at factory construction: fetch the rigs early
 *   const s = skinCreatureGlb(kind, variantId, bones);      // null → keep the procedural mesh (off / not loaded yet)
 *   s.geometry  (position, normal, uv, color, skinIndex, skinWeight; one group)   s.map (the atlas)
 *
 * The rigs are baked offline by `scripts/nalati-rig-bake.mjs` (src/entities/creatureRigBake.ts): each hull fitted to
 * its species' skeleton, its stance (legs mid-stride, a turned head) measured and un-posed to the rest pose, weighted
 * along its own surface — `public/assets/nalati/models/<hull>[.phone].rigged.glb`, a glTF skin whose joints are the
 * species' bones by name and order (JOINTS_0 indexes the AnimalFactory skeleton directly). A rig is only used when its
 * joint names match the variant's bones (in order); its joint positions are the skeleton it is bound to (the bake may
 * slide a leg onto the hull's leg), so the model takes the rig's bones. Otherwise the procedural mesh stays.
 * The hull's coat comes from the atlas; vertex colours are white (the per-animal tint still multiplies via `color`).
 * Which variants swap: only those whose coat the hull shows (the dun wild horse, the camp bay, the grey / tawny /
 * young wolves) — a hull can't be recoloured into a chestnut or a black horse.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TIER } from '../core/tier';
import { modelsOn } from '../world/nalati/glbPaint';
import type { BoneDef } from './species/registry';

/** the rigged hulls (scripts/nalati-rig-bake.mjs RIG_BAKES) */
export type CreatureRigName = 'horse-wild' | 'horse-saddled' | 'wolf' | 'snow-leopard' | 'sheep';

const HULL: Readonly<Record<string, CreatureRigName>> = {
  'horse:dun': 'horse-wild',
  'horse:camp-bay': 'horse-saddled',
  'wolf:grey': 'wolf',
  'wolf:tawny': 'wolf',
  'wolf:scout': 'wolf',
  'leopard:aqbars': 'snow-leopard',
};

/** the rig for (kind, variant) when the creature models are on, else null */
export function creatureHull(kind: string, variant: string): CreatureRigName | null {
  if (!modelsOn('creatures')) return null;
  return HULL[`${kind}:${variant}`] ?? null;
}

export interface SkinnedHull {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null;
  /** the skeleton the hull is bound to: the variant's bones, a leg the bake retargeted onto the hull's leg moved */
  bones: BoneDef[];
}
export interface RigAsset { geometry: THREE.BufferGeometry; map: THREE.Texture | null; joints: { name: string; pos: THREE.Vector3 }[] }

const DIR = '/assets/nalati/models/';
let loader: GLTFLoader | null = null;
const loading = new Map<CreatureRigName, Promise<RigAsset>>();
const ready = new Map<CreatureRigName, RigAsset>();

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

/** load one rig (cached): its geometry in the skeleton's rest space, the atlas, the joints' rest positions */
export function loadCreatureRig(name: CreatureRigName): Promise<RigAsset> {
  let p = loading.get(name);
  if (!p) {
    if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
    p = loader.loadAsync(`${DIR}${name}${TIER === 'phone' ? '.phone' : ''}.rigged.glb`).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const found: THREE.SkinnedMesh[] = [];
      gltf.scene.traverse((o) => { if (isSkinned(o)) found.push(o); });
      const sm = found[0];
      if (!sm) throw new Error(`creature rig ${name}: no skinned mesh`);
      const src = sm.geometry;
      const geometry = new THREE.BufferGeometry();
      for (const key of ['position', 'normal', 'uv', 'skinWeight'] as const) if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
      const si = src.getAttribute('skinIndex');
      const idx16 = new Uint16Array(si.count * 4);
      for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) idx16[i * 4 + c] = si.getComponent(i, c);
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx16, 4));
      const index = src.getIndex();
      if (index) geometry.setIndex(Array.from(index.array));
      const n = geometry.getAttribute('position').count;
      // painterly materials always read vertex colours: a white one (the atlas carries the colour)
      geometry.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(n * 3).fill(255), 3, true));
      geometry.clearGroups(); geometry.addGroup(0, index ? index.count : n, 0);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.6; // animated legs / neck never leave this (as the procedural)
      const mat = Array.isArray(sm.material) ? sm.material[0] : sm.material;
      const map = mat instanceof THREE.MeshStandardMaterial && mat.map ? mat.map : null;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      const joints = sm.skeleton.bones.map((b) => ({ name: b.name, pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) }));
      const out: RigAsset = { geometry, map, joints };
      ready.set(name, out);
      return out;
    });
    loading.set(name, p);
  }
  return p;
}

let preloaded = false;
export function preloadCreatureGlbs(): void {
  if (preloaded || !modelsOn('creatures')) return;
  preloaded = true;
  for (const n of new Set(Object.values(HULL))) loadCreatureRig(n).catch((e: unknown) => { console.warn(`[nalati] creature rig ${n} failed`, e); });
}

/** true when the rig's skin joints are `bones` by name, in order (their rest positions may be retargeted) */
function jointsMatch(rig: RigAsset, bones: readonly BoneDef[]): boolean {
  return rig.joints.length === bones.length && bones.every((b, i) => rig.joints[i]?.name === b.name);
}

/**
 * The rigged hull for (kind, variant), bound to `bones` (the variant's skeleton). Null when the creature models are
 * off, the variant has no hull, the rig hasn't loaded yet, or it was baked against other bones.
 */
export function skinCreatureGlb(kind: string, variant: string, bones: readonly BoneDef[]): SkinnedHull | null {
  const name = creatureHull(kind, variant);
  if (name === null) return null;
  const rig = ready.get(name);
  if (!rig) return null;
  if (!jointsMatch(rig, bones)) { console.warn(`[nalati] creature rig ${name}: baked against other bones than ${kind}:${variant} — re-run scripts/nalati-rig-bake.mjs`); return null; }
  const out: BoneDef[] = bones.map((b, i) => { const p = rig.joints[i]?.pos; return { name: b.name, parent: b.parent, pos: p ? [p.x, p.y, p.z] : b.pos }; });
  return { geometry: rig.geometry, map: rig.map, bones: out };
}
