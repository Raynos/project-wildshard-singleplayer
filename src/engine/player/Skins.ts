import * as v from 'valibot';
import { saves } from '../saves/runtime';
import * as THREE from 'three';
import type { WeaponId } from '../combat/Equipment';
import type { Sky } from '../world/Sky';
import { fixIBL, isMesh, VIEWMODEL_GROUP } from '#engine/combat/view/ranged';

const skinSave = saves.define({ key: 'skins', scope: 'shard', version: 1, schema: v.object({ owned: v.array(v.string()), worn: v.record(v.string(), v.string()) }), initial: () => ({ owned: [] as string[], worn: {} as Record<string, string> }) });

/** Material cosmetics supplied by the host's registered rows. */
export type WeaponKind = WeaponId;
export type SkinId = string;

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

// ───────────────────────────── applying ─────────────────────────────

interface SkinState { id: SkinId; originals: Map<THREE.Mesh, THREE.Material | THREE.Material[]>; clones: Map<string, THREE.Material>; extras: THREE.Object3D[] }
const STATE = new WeakMap<THREE.Object3D, SkinState>();

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
  const group = VIEWMODEL_GROUP;
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

// ───────────────────────────── ownership ─────────────────────────────


/** What this level owns and what each weapon wears; persisted independently per namespace. */
export class SkinLocker {
  private owned = new Set<SkinId>();
  private worn: Partial<Record<WeaponKind, SkinId>> = {};
  private readonly rows: ReadonlyMap<string, SkinDef>;
  constructor(private readonly namespace: string, rows: readonly SkinDef[] = []) {
    this.rows = new Map(rows.map((row) => [row.id, row]));
    try {
      const saved = skinSave.read(this.namespace);
      for (const id of saved.owned) if (this.rows.has(id)) this.owned.add(id);
      for (const [weapon, id] of Object.entries(saved.worn)) {
        const row = this.rows.get(id);
        if (row?.weapon === weapon && this.owned.has(id)) this.worn[row.weapon] = id;
      }
    } catch { /* defaults */ }
  }
  private save(): void { try { skinSave.write({ owned: [...this.owned], worn: this.worn }, this.namespace); } catch { /* not persisted */ } }
  has(id: SkinId): boolean { return this.owned.has(id); }
  own(id: SkinId): void { if (this.rows.has(id) && !this.owned.has(id)) { this.owned.add(id); this.save(); } }
  /** The row this weapon wears, if any. */
  wearing(weapon: WeaponKind): SkinDef | null { const id = this.worn[weapon]; return id === undefined ? null : this.rows.get(id) ?? null; }
  wear(weapon: WeaponKind, id: SkinId | null): void {
    if (id !== null && (!this.owned.has(id) || this.rows.get(id)?.weapon !== weapon)) return;
    if (id !== null) this.worn[weapon] = id; else delete this.worn[weapon];
    this.save();
  }
}
