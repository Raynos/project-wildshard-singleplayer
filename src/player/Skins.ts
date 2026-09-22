import * as THREE from 'three';
import type { Sky } from '../world/Sky';
import { fixIBL, isMesh, VIEWMODEL_GROUP, type Crossbow } from './Crossbow';

/**
 * Weapon skins — the legendary drops (art/skin-*.png). A skin restyles the EXISTING crossbow / AR-15 model: the
 * weapons name their materials ('xbow-wood', 'xbow-prod', 'rifle-alu' …), so a skin is a table of per-material
 * overrides (colour, emissive, roughness, metalness) plus optional extra geometry (the Ghost Stag's antler tines).
 * Overrides are uniforms only and the clones are re-run through `fixIBL` + `sky.setupMaterial`, so a skinned
 * weapon costs no new shader programs.
 *
 *   applySkin(crossbow.model, SKINS['ghost-stag'], sky)     // the viewmodel, in place (idempotent, swaps back with clearSkin)
 *   const item = crossbowDisplayModel(crossbow, sky); applySkin(item, skin, sky)   // a world copy for the floor drop (WeaponPickup)
 *   skinFor(kind, variant)                                   // the skin a legendary kill drops, if any
 *
 * Which skin drops (the user's call): Ghost stag → GHOST STAG crossbow, Old Ironhide → IRONHIDE AR-15. HOLLOW ASH and
 * SCARBACK FURNACE exist in the code but nothing drops them yet. The SkinLocker persists what you own / wear.
 */

export type WeaponKind = 'crossbow' | 'rifle';
export type SkinId = 'ghost-stag' | 'hollow-ash' | 'ironhide' | 'scarback-furnace';

/** `plain` drops the base texture and the vertex-colour wear so `color` / `roughness` / `metalness` are exact (the normal map stays
 *  for relief) — that is a define change, so it costs one program per (weapon material, skin). */
interface MatOverride { color?: number; emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number; envMapIntensity?: number; plain?: boolean }
export interface SkinDef {
  id: SkinId;
  weapon: WeaponKind;
  /** display name ("Ghost Stag") */
  name: string;
  /** one line for the pickup toast */
  blurb: string;
  /** which legendary kill drops it (none = in the code only) */
  dropsFrom?: { kind: string; variant: string };
  /** material name → overrides */
  mats: Record<string, MatOverride>;
  /** extra geometry, built once per root with the skin's cloned materials at hand */
  extras?: (root: THREE.Object3D, mat: (name: string) => THREE.Material | undefined) => THREE.Object3D[];
}

const IVORY = 0xe9dfc6, BONE = 0xd9cfb4, SILVER = 0xc9ced4, GHOST_CYAN = 0x8fe3ff, EMBER = 0xff5a12, BRASS = 0xf2b24c;

export const SKINS: Record<SkinId, SkinDef> = {
  'ghost-stag': {
    id: 'ghost-stag', weapon: 'crossbow', name: 'Ghost Stag', blurb: 'bone-white ash, the stag\'s own antlers for a prod',
    dropsFrom: { kind: 'deer', variant: 'ghost' },
    mats: {
      'xbow-wood': { color: BONE, roughness: 0.6, envMapIntensity: 0.8, emissive: GHOST_CYAN, emissiveIntensity: 0.03, plain: true },
      'xbow-prod': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.6, plain: true },
      'xbow-iron': { color: SILVER, roughness: 0.55, envMapIntensity: 1.1 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0xdad3c4, roughness: 0.9 },
      'xbow-cord': { color: 0xe8fbff, emissive: GHOST_CYAN, emissiveIntensity: 0.9 },
    },
    extras: (root, mat) => antlerTines(root, mat('xbow-prod') ?? mat('xbow-iron')),
  },
  'hollow-ash': {
    id: 'hollow-ash', weapon: 'crossbow', name: 'Hollow Ash', blurb: 'charred ash, cold light in the cracks',
    mats: {
      'xbow-wood': { color: 0x2a2a2e, roughness: 1, emissive: GHOST_CYAN, emissiveIntensity: 0.08 },
      'xbow-prod': { color: 0x1c1d22, roughness: 0.9, envMapIntensity: 0.9 },
      'xbow-iron': { color: 0x15161a, roughness: 0.8 },
      'xbow-brass': { color: SILVER, roughness: 0.5 },
      'xbow-leather': { color: 0x2a2523 },
      'xbow-cord': { color: 0x1a1a1a },
    },
  },
  'ironhide': {
    id: 'ironhide', weapon: 'rifle', name: 'Ironhide', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge',
    dropsFrom: { kind: 'boar', variant: 'ironhide' },
    mats: {
      'rifle-alu': { color: 0x5a3d2e, roughness: 1, metalness: 1, envMapIntensity: 0.9, emissive: EMBER, emissiveIntensity: 0.02 },
      'rifle-poly': { color: IVORY, metalness: 0, roughness: 0.55, envMapIntensity: 0.7, plain: true },
      'rifle-steel': { color: 0x3a2a22, roughness: 0.9, emissive: EMBER, emissiveIntensity: 0.1 },
      'rifle-brass': { color: BRASS, roughness: 0.45, envMapIntensity: 1.2 },
    },
  },
  'scarback-furnace': {
    id: 'scarback-furnace', weapon: 'rifle', name: 'Scarback Furnace', blurb: 'forge-black steel, molten light through the vents',
    mats: {
      'rifle-alu': { color: 0x0c0d11, roughness: 0.7, metalness: 1, envMapIntensity: 1.1, emissive: EMBER, emissiveIntensity: 0.12 },
      'rifle-poly': { color: 0x2b1d16, metalness: 0, roughness: 0.95 },
      'rifle-steel': { color: 0x101114, roughness: 0.6, emissive: EMBER, emissiveIntensity: 0.25 },
      'rifle-brass': { color: BRASS, roughness: 0.35, envMapIntensity: 1.3 },
    },
  },
};

/** the skin a kill of (kind, variant) drops, if any */
export function skinFor(kind: string, variant: string | undefined): SkinDef | null {
  for (const s of Object.values(SKINS)) if (s.dropsFrom?.kind === kind && s.dropsFrom.variant === variant) return s;
  return null;
}

// ───────────────────────────── applying ─────────────────────────────

interface SkinState { id: SkinId; originals: Map<THREE.Mesh, THREE.Material | THREE.Material[]>; clones: Map<string, THREE.Material>; extras: THREE.Object3D[] }
const STATE = new WeakMap<THREE.Object3D, SkinState>();
const GROUP: Record<WeaponKind, string> = { crossbow: VIEWMODEL_GROUP, rifle: VIEWMODEL_GROUP }; // fixIBL's program-cache group — one for every viewmodel (Crossbow.viewmodelMaterial)

let white: THREE.DataTexture | undefined;
function whiteTex() {
  if (!white) { white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true; }
  return white;
}

function cloneWith(orig: THREE.Material, o: MatOverride, group: string, sky: Sky): THREE.Material {
  const m = orig.clone() as THREE.MeshStandardMaterial;
  m.name = orig.name;
  if (o.plain) { m.map = whiteTex(); m.aoMap = m.roughnessMap = m.metalnessMap = whiteTex(); m.vertexColors = false; }
  if (o.color !== undefined) m.color.setHex(o.color);
  if (o.emissive !== undefined) m.emissive.setHex(o.emissive);
  if (o.emissiveIntensity !== undefined) m.emissiveIntensity = o.emissiveIntensity;
  if (o.roughness !== undefined) m.roughness = o.roughness;
  if (o.metalness !== undefined) m.metalness = o.metalness;
  if (o.envMapIntensity !== undefined) m.envMapIntensity = o.envMapIntensity;
  // clone() drops the instance hooks: the dfg fix and the sky / CSM setup must be re-applied (else metals go black)
  fixIBL(m, group);
  sky.setupMaterial(m);
  return m;
}

/** Restyle `root` (a viewmodel or a display copy) as `skin`; a different skin on the same root swaps cleanly. */
export function applySkin(root: THREE.Object3D, skin: SkinDef, sky: Sky): void {
  const prev = STATE.get(root);
  if (prev?.id === skin.id) return;
  if (prev) clearSkin(root);
  const state: SkinState = { id: skin.id, originals: new Map(), clones: new Map(), extras: [] };
  const group = GROUP[skin.weapon];
  const clone = (mat: THREE.Material) => {
    const o = skin.mats[mat.name]; if (!o) return mat;
    let c = state.clones.get(mat.name);
    if (!c) { c = cloneWith(mat, o, group, sky); state.clones.set(mat.name, c); }
    return c;
  };
  root.traverse((mesh) => {
    if (!isMesh(mesh)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => skin.mats[m.name])) return;
    state.originals.set(mesh, mesh.material);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  if (skin.extras) {
    state.extras = skin.extras(root, (n) => state.clones.get(n));
    // extras inherit the root's render flags (a viewmodel draws in the transparent queue after a depth clear)
    const sample = [...state.originals.keys()][0];
    for (const e of state.extras) e.traverse((m) => { if (isMesh(m) && sample) { m.renderOrder = sample.renderOrder; m.frustumCulled = sample.frustumCulled; m.castShadow = sample.castShadow; m.receiveShadow = sample.receiveShadow; } });
  }
  STATE.set(root, state);
}

/** back to the plain weapon */
export function clearSkin(root: THREE.Object3D): void {
  const s = STATE.get(root); if (!s) return;
  for (const [mesh, mat] of s.originals) mesh.material = mat;
  for (const e of s.extras) { e.removeFromParent(); e.traverse((m) => { if (isMesh(m)) m.geometry.dispose(); }); }
  for (const c of s.clones.values()) c.dispose();
  STATE.delete(root);
}

export function skinOf(root: THREE.Object3D): SkinId | null { return STATE.get(root)?.id ?? null; }

// ───────────────────────────── the crossbow as a world item ─────────────────────────────

/** A world-space copy of the crossbow for a floor drop: the viewmodel's meshes with plain render flags, no depth
 *  clearer, no pose / 1.35× scale, unit materials shared (a skin clones what it changes). ~0.85 m long, bow forward (−Z). */
export function crossbowDisplayModel(crossbow: Crossbow, sky: Sky): THREE.Group {
  const g = crossbow.model.clone(true); // children keep their local poses (the string legs as they sit at rest); geometry is shared
  g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.setScalar(1); // the viewmodel's 1.35× and camera pose stay behind
  const drop: THREE.Object3D[] = [];
  g.traverse((m) => {
    if (!isMesh(m)) return;
    const mat = m.material as THREE.Material;
    if (!mat.name || !mat.colorWrite || (!m.visible && mat.name !== 'xbow-bolt')) { drop.push(m); return; } // the depth clearer, hidden effects
    const copy = mat.clone(); copy.name = mat.name; copy.transparent = false; copy.depthWrite = true; // the viewmodel draws in the transparent queue; the drop must not
    fixIBL(copy, VIEWMODEL_GROUP); sky.setupMaterial(copy);
    m.material = copy; m.visible = true;
    m.castShadow = true; m.receiveShadow = true; m.renderOrder = 0; m.frustumCulled = true;
    m.onBeforeRender = () => { /* a world copy needs no depth clear */ };
  });
  for (const d of drop) d.removeFromParent();
  // the string legs are posed per frame by the viewmodel (Crossbow.updateString); a copy taken before the first frame has
  // them unit-length at the origin — pose them at rest here: tip → nock, the serving at the nock
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205), nock = new THREE.Vector3(0, 0.012, -0.07);
  const legs: THREE.Mesh[] = []; let serving: THREE.Mesh | undefined;
  g.traverse((m) => {
    if (!isMesh(m) || (m.material as THREE.Material).name !== 'xbow-cord') return;
    if (m.geometry.boundingBox === null) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox; if (bb === null) return;
    const sz = bb.max.clone().sub(bb.min);
    if (Math.abs(sz.y - 1) < 0.01) legs.push(m); else if (sz.x < 0.07 && sz.x > 0.04 && sz.y < 0.01) serving = m;
  });
  legs.forEach((leg, i) => {
    const from = i === 0 ? tipL : tipR, dir = nock.clone().sub(from), len = dir.length();
    leg.position.copy(from); leg.scale.set(1, len, 1); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
  });
  if (serving) { serving.position.copy(nock); serving.quaternion.identity(); }
  return g;
}

// ───────────────────────────── extras ─────────────────────────────

/** Ghost Stag: antler tines growing up and back from the prod (the limb curve from Crossbow.ts) */
function antlerTines(root: THREE.Object3D, mat: THREE.Material | undefined): THREE.Object3D[] {
  if (!mat) return [];
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  const curve = new THREE.CatmullRomCurve3([tipL, new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR], false, 'catmullrom', 0.5);
  const group = new THREE.Group(); group.name = 'skin-antlers';
  const cone = new THREE.ConeGeometry(1, 1, 7, 1); cone.translate(0, 0.5, 0); // unit tine, base at the origin, pointing +Y
  cone.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cone.getAttribute('position').count * 3).fill(1), 3)); // in case the material reads vertex colours
  const tines: [number, number, number, number][] = [ // [t along the limb, length, lean back (rad), lean out (rad)]
    [0.02, 0.085, 0.55, -0.35], [0.1, 0.07, 0.35, -0.2], [0.2, 0.06, 0.15, 0], [0.31, 0.045, 0.05, 0.15],
  ];
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const side of [0, 1]) for (const [t0, len, back, out] of tines) {
    const t = side ? 1 - t0 : t0;
    const p = curve.getPoint(t);
    const m = new THREE.Mesh(cone, mat);
    m.position.copy(p).add(up.clone().multiplyScalar(0.006));
    m.scale.set(0.007, len, 0.005);
    e.set(back, 0, side ? -out : out); m.quaternion.copy(q.setFromEuler(e));
    group.add(m);
    // a short fork on the two longest tines
    if (len > 0.065) {
      const f = new THREE.Mesh(cone, mat);
      f.position.copy(p).add(up.clone().multiplyScalar(len * 0.45));
      f.scale.set(0.005, len * 0.45, 0.004);
      e.set(back + 0.9, 0, side ? -(out + 0.5) : out + 0.5); f.quaternion.copy(q.setFromEuler(e));
      group.add(f);
    }
  }
  root.add(group);
  return [group];
}

// ───────────────────────────── ownership ─────────────────────────────

const STORE = 'ws.skins.v1';

/** What you own and what each weapon wears; persisted (skins are yours across shards). */
export class SkinLocker {
  private owned = new Set<SkinId>();
  private worn: Partial<Record<WeaponKind, SkinId>> = {};
  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? '{}') as { owned?: SkinId[]; worn?: Partial<Record<WeaponKind, SkinId>> };
      for (const id of s.owned ?? []) if (id in SKINS) this.owned.add(id);
      for (const [w, id] of Object.entries(s.worn ?? {})) if (id in SKINS) this.worn[w as WeaponKind] = id;
    } catch { /* defaults */ }
  }
  private save(): void { try { localStorage.setItem(STORE, JSON.stringify({ owned: [...this.owned], worn: this.worn })); } catch { /* not persisted */ } }
  has(id: SkinId): boolean { return this.owned.has(id); }
  own(id: SkinId): void { if (!this.owned.has(id)) { this.owned.add(id); this.save(); } }
  /** the skin `weapon` wears, if any */
  wearing(weapon: WeaponKind): SkinDef | null { const id = this.worn[weapon]; return id ? SKINS[id] : null; }
  wear(weapon: WeaponKind, id: SkinId | null): void { if (id && !this.owned.has(id)) return; if (id) this.worn[weapon] = id; else delete this.worn[weapon]; this.save(); }
}
