/**
 * The Model Explorer's catalog (project/archive/2026-09-23-explore-world.md X3, made generic in X10).
 *
 *   registerPineHollowModels(handles)         // Pine Hollow's (E66): the cabins (everything else there is a model: E315 M2)
 *   catalogEntries(sky, animals, style, at)   // Explore: every registered model + one creature per species present
 *   measure(object)                           // tris / draw calls
 *
 * A registered model is either LIVE (already in the scene; the Model Explorer isolates it in place) or one of a batch
 * built alone on first view (one palm out of the merged palms), with a builder per detail tier. Creatures are not
 * registered: each species the shard's AnimalManager has gets its own rig from the factory in the shard's style, with
 * no AI — it stands on the turntable and plays what it is told (clips, variants, X8).
 */
import * as THREE from 'three';
import { AnimalFactory, type AnimalStyle } from '../entities/AnimalFactory';
import { Animal } from '../entities/Animal';
import { speciesDef } from '../entities/species/registry';
import type { Sky } from '../world/Sky';
import { heightAt } from '../world/Heightfield';
import type { DrawnAs, Pipeline } from '../world/registry';
import { creatureHull } from '../entities/glbCreatures';
import { pineHull } from '../entities/pineCreatures';
import { HULL_PIPELINE, SPECIES_PIPELINE } from '../models/provenance';
import { registerModel, registeredModels, type ModelCategory, type RegisteredModel } from './registry';

export type Category = ModelCategory;
export const CATEGORIES: readonly { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'buildings', label: 'Buildings' }, { id: 'nature', label: 'Nature' }, { id: 'creatures', label: 'Creatures' },
  { id: 'props', label: 'Props' },
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
  /** creatures: the Animal on the turntable, the species' variants and a rebuild on one of them (also how DIE is undone) */
  animal?: Animal;
  variants?: readonly { id: string; label: string }[];
  rebuild?: (variant?: string) => void;
  tick?: (dt: number, t: number) => void;
}

// ── Driftwood's models are on the model contract (E306 / E315 M1, src/models/): `place` registers each one, its copies
// and its tap targets, so the shard's setup registers nothing here.

// ── Pine Hollow's cabins (E66): the three log cabins, until their models land (E315 M2 placed everything else there: its
// props, TRELLIS props, crags, landmarks, trees and forest floor are models in src/chunks/pine-hollow/models/) ──

export interface PineHollowModels {
  cabins?: { roots: readonly THREE.Object3D[] } | null;
}

const CABIN_NAMES = ['Log cabin · hollow', 'Log cabin · east', 'Log cabin · ridge'] as const;

export function registerPineHollowModels(h: PineHollowModels): void {
  // the cabins' cores are merged across the three by material (Cabins.batchCores): each card is one copy of that batch
  (h.cabins?.roots ?? []).forEach((root, i) => {
    registerModel({ id: `cabin-${i + 1}`, name: CABIN_NAMES[i] ?? `Log cabin ${i + 1}`, category: 'buildings', file: 'src/world/Cabin.ts', live: true, object: () => root, pipeline: 'code', drawnAs: 'merged', copies: 1 });
  });
}

// ── the catalog Explore shows: every registered model + a creature per species on the shard ──

export function catalogEntries(sky: Sky, animals: readonly { kind: string }[], style: AnimalStyle, at: { x: number; z: number; y?: number }): CatalogEntry[] {
  const near = new THREE.Vector3(at.x, at.y ?? heightAt(at.x, at.z), at.z); // VIEW IN WORLD lands on the real copy nearest the spawn
  const out: CatalogEntry[] = registeredModels().map((m) => {
    const drawn = m.live ? drawnFacts(m.object()) : null;
    const e: CatalogEntry = {
      id: m.id, name: m.name, category: m.category, file: m.file, live: m.live, object: m.object, buildMs: 0,
      pipeline: pipelines(m.pipeline), copies: m.copies ?? drawn?.copies ?? 1, drawnAs: m.drawnAs ?? drawn?.drawnAs ?? 'single',
    };
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
  for (const kind of new Set(animals.map((a) => a.kind))) {
    const sp = speciesDef(kind);
    // the rig is code; a generated hull (Nalati's, Pine Hollow's) or mesh (the Drowned Captain) is how it looks
    const v0 = sp.variants[0]?.id ?? '', hull = creatureHull(kind, v0) ?? pineHull(kind, v0);
    const made = (hull === null ? undefined : HULL_PIPELINE[hull]) ?? SPECIES_PIPELINE[kind] ?? 'code';
    const e: CatalogEntry = {
      id: kind, name: sp.label, category: 'creatures', file: `src/entities/species/${kind}.ts`, live: false, buildMs: 0, object: () => new THREE.Group(),
      pipeline: [made], copies: animals.filter((a) => a.kind === kind).length, drawnAs: 'skinned',
    };
    const group = new THREE.Group();
    let built = false;
    e.variants = sp.variants.map((v) => ({ id: v.id, label: v.label }));
    // a fresh rig (the variant's paint + scale), standing where the last one stood: the turntable's treadmill keeps it there
    e.rebuild = (v = sp.variants[0]?.id) => {
      const t0 = performance.now();
      factory ??= new AnimalFactory(sky, { style });
      const model = factory.model(kind, v);
      const a = new Animal(factory.instantiate(model, 0.5), model, 7, 1);
      a.prepareMaterial = (m) => { sky.setupMaterial(m); };
      const old = e.animal;
      a.place(old ? old.position.x : at.x, old ? old.position.z : at.z, old ? old.yaw : Math.PI * 0.8);
      a.sampleTerrain();
      if (kind === 'sailor') { a.mem['init'] = 1; a.mem['rise'] = 1; } // it waits sunk under the wreck's deck until the hold wakes it (sailor.ts): on the turntable it stands
      if (old) old.mesh.removeFromParent();
      group.add(a.mesh);
      e.animal = a;
      e.tick = (dt, t) => { a.update(dt, t, true); };
      e.buildMs = performance.now() - t0;
    };
    e.object = () => { if (!built) { built = true; e.rebuild?.(); } return group; };
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
