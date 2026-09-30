/**
 * The Model Explorer's catalog (project/archive/2026-09-23-explore-world.md X3, made generic in X10).
 *
 *   catalogEntries(sky, animals, style, at)   // Explore: every registered model + one creature per species present
 *   measure(object)                           // tris / draw calls
 *
 * A registered model is either LIVE (already in the scene; the Model Explorer isolates it in place) or one of a batch
 * built alone on first view (one palm out of the merged palms), with a builder per detail tier. Creatures (E315 M5) are
 * the shard's roster, listed at boot on the species rigs (src/models/live.ts `listRoster`: every species it can spawn,
 * alive now or not): each gets its own rig from the factory in the shard's style, with no AI — it stands on the turntable
 * and plays what it is told (clips, variants, X8). A live animal of a species the shard does not list still gets a card.
 */
import * as THREE from 'three';
import { AnimalFactory, type AnimalStyle } from '../entities/AnimalFactory';
import { Animal } from '../entities/Animal';
import { hasSpecies, speciesDef } from '../entities/species/registry';
import type { Sky } from '../world/Sky';
import { heightAt } from '../world/Heightfield';
import type { DrawnAs, Pipeline } from '../world/registry';
import { creatureHull } from '../entities/glbCreatures';
import { pineHull } from '../entities/pineCreatures';
import { HULL_PIPELINE, SPECIES_PIPELINE } from '../models/provenance';
import { registeredModels, type ModelCategory, type RegisteredModel } from './registry';

export type Category = ModelCategory;
export const CATEGORIES: readonly { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'buildings', label: 'Buildings' }, { id: 'nature', label: 'Nature' }, { id: 'creatures', label: 'Creatures' },
  { id: 'people', label: 'People' }, { id: 'gear', label: 'Gear' }, { id: 'props', label: 'Props' },
];

export interface CatalogEntry extends Omit<RegisteredModel, 'worldBox'> {
  /** ms the fresh instance took to build (live ones were built at boot) */
  buildMs: number;
  /** how it's made — the card's badge (E306); `code` unless the registration says otherwise */
  pipeline: readonly Pipeline[];
  /** how many copies this shard draws, and how (E306) */
  copies: number;
  drawnAs: DrawnAs;
  /** VIEW IN WORLD's target: the real copy nearest the spawn (absent: the catalog object's own box) */
  worldBox?: () => THREE.Box3 | null;
  /** a `shared/…` model (src/models/), used by several shards: its card says so (E315 M5) */
  shared?: boolean;
  /** creatures: the Animal on the turntable, the species' variants and a rebuild on one of them (also how DIE is undone) */
  animal?: Animal;
  variants?: readonly { id: string; label: string }[];
  rebuild?: (variant?: string) => void;
  tick?: (dt: number, t: number) => void;
}

// ── Driftwood's models are on the model contract (E306 / E315 M1, src/models/): `place` registers each one, its copies
// and its tap targets, so the shard's setup registers nothing here.

// ── Pine Hollow's models are on the contract (E315 M2, src/chunks/pine-hollow/models/): `place` registers each one.

// ── the catalog Explore shows: every registered model + a creature per species on the shard ──

export function catalogEntries(sky: Sky, animals: readonly { kind: string }[], style: AnimalStyle, at: { x: number; z: number; y?: number }): CatalogEntry[] {
  const near = new THREE.Vector3(at.x, at.y ?? heightAt(at.x, at.z), at.z); // VIEW IN WORLD lands on the real copy nearest the spawn
  const out: CatalogEntry[] = registeredModels().map((m) => {
    const drawn = m.live ? drawnFacts(m.object()) : null;
    const e: CatalogEntry = {
      id: m.id, name: m.name, category: m.category, file: m.file, live: m.live, object: m.object, buildMs: 0,
      pipeline: pipelines(m.pipeline), copies: m.copies ?? drawn?.copies ?? 1, drawnAs: m.drawnAs ?? drawn?.drawnAs ?? 'single', shared: m.id.startsWith('shared/'),
    };
    if (m.species !== undefined) e.species = m.species;
    const wb = m.worldBox;
    if (wb) e.worldBox = () => wb(near);
    if (m.buildAt) e.buildAt = m.buildAt;
    if (m.variants) e.variants = m.variants;
    if (m.rebuild) e.rebuild = m.rebuild;
    if (m.worldView === false) e.worldView = false;
    if (!m.live) {
      let built = false;
      e.object = () => { if (!built) { built = true; const t0 = performance.now(); const o = m.object(); e.buildMs = performance.now() - t0; return o; } return m.object(); };
    }
    return e;
  });
  let factory: AnimalFactory | null = null;
  /** a creature's card: an Animal of its species on the turntable, rebuilt per variant */
  const standUp = (e: CatalogEntry, kind: string): void => {
    const sp = speciesDef(kind);
    const group = new THREE.Group();
    let built = false;
    e.variants ??= sp.variants.map((v) => ({ id: v.id, label: v.label }));
    const first = e.variants[0]?.id ?? sp.variants[0]?.id;
    // a fresh rig (the variant's paint + scale), standing where the last one stood: the turntable's treadmill keeps it there
    e.rebuild = (v = first) => {
      const t0 = performance.now();
      factory ??= new AnimalFactory(sky, { style });
      const model = factory.model(kind, v);
      const a = new Animal(factory.instantiate(model, 0.5), model, 7, 1);
      a.prepareMaterial = (m) => { sky.setupMaterial(m); };
      const old = e.animal;
      a.place(old ? old.position.x : at.x, old ? old.position.z : at.z, old ? old.yaw : Math.PI * 0.8);
      a.sampleTerrain();
      if (kind === 'sailor' || kind === 'captain') { a.mem['init'] = 1; a.mem['rise'] = 1; } // they wait sunk (under the wreck's deck, in the Captain's pool) until woken (sailor.ts, captain.ts): on the turntable they stand
      if (old) old.mesh.removeFromParent();
      group.add(a.mesh);
      e.animal = a;
      e.tick = (dt, t) => { a.update(dt, t, true); };
      e.buildMs = performance.now() - t0;
    };
    e.object = () => { if (!built) { built = true; e.rebuild?.(); } return group; };
  };
  // the roster's creatures (E315 M5): listed on the species rigs, alive now or not
  const listed = new Set<string>();
  for (const e of out) if (e.species !== undefined && hasSpecies(e.species)) { listed.add(e.species); standUp(e, e.species); } // (a species registered later — a boss's — keeps the model's own specimen)
  // a live animal whose species the shard does not list: a card off the live list, as before M5
  for (const kind of new Set(animals.map((a) => a.kind))) {
    if (listed.has(kind)) continue;
    const sp = speciesDef(kind);
    // the rig is code; a generated hull (Nalati's, Pine Hollow's) or mesh (the Drowned Captain) is how it looks
    const v0 = sp.variants[0]?.id ?? '', hull = creatureHull(kind, v0) ?? pineHull(kind, v0);
    const made = (hull === null ? undefined : HULL_PIPELINE[hull]) ?? SPECIES_PIPELINE[kind] ?? 'code';
    const e: CatalogEntry = {
      id: kind, name: sp.label, category: 'creatures', file: `src/entities/species/${kind}.ts`, live: false, buildMs: 0, object: () => new THREE.Group(),
      pipeline: [made], copies: animals.filter((a) => a.kind === kind).length, drawnAs: 'skinned', shared: false, species: kind,
    };
    standUp(e, kind);
    out.push(e);
  }
  return out;
}

/** a registration's pipeline(s) as a list; `code` when it says nothing (the procedural builders registered before E306) */
function pipelines(p: Pipeline | readonly Pipeline[] | undefined): readonly Pipeline[] {
  if (p === undefined) return ['code'];
  return typeof p === 'string' ? [p] : p;
}

/**
 * copies and drawing read off a live object: a rig is skinned; when every part is instanced, the copies are its distinct
 * instance positions (the parts of one copy stand on the same spot); anything else is one copy
 */
function drawnFacts(o: THREE.Object3D): { copies: number; drawnAs: DrawnAs } {
  const meshes: THREE.Object3D[] = [];
  o.traverse((c) => { if ((c as Partial<THREE.Mesh>).isMesh === true) meshes.push(c); });
  if (meshes.some((c) => (c as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true)) return { copies: 1, drawnAs: 'skinned' };
  if (meshes.some((c) => (c as Partial<THREE.BatchedMesh>).isBatchedMesh === true)) return { copies: 1, drawnAs: 'batched' };
  const instanced = meshes.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  if (meshes.length > 0 && instanced.length === meshes.length) {
    const spots = new Set<string>(), m4 = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const c of instanced) for (let i = 0; i < c.instanceMatrix.count; i++) { c.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); spots.add(`${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`); }
    return { copies: spots.size, drawnAs: 'instanced' };
  }
  return { copies: 1, drawnAs: 'single' };
}

/** triangles and draw calls of an object (instanced meshes count every instance) */
export function measure(o: THREE.Object3D): { tris: number; calls: number; meshes: number } {
  let tris = 0, calls = 0, meshes = 0;
  o.traverse((c) => {
    if (!(c instanceof THREE.Mesh) || !c.visible) return;
    const g = c.geometry as THREE.BufferGeometry;
    const n = g.index ? g.index.count : g.getAttribute('position').count;
    const inst = c instanceof THREE.InstancedMesh ? c.count : 1;
    tris += (n / 3) * inst;
    calls += Array.isArray(c.material) ? c.material.length : 1;
    meshes++;
  });
  return { tris: Math.round(tris), calls, meshes };
}
