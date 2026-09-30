/**
 * The Model Explorer's catalog (project/archive/2026-09-23-explore-world.md X3, made generic in X10).
 *
 *   registerDriftwoodModels(handles)          // Driftwood's setup (main.ts, at boot): the batch models + tap targets
 *   registerPineHollowModels(handles)         // Pine Hollow's (E66): the cabins, the pond, a pine, a boulder / stump / log
 *   catalogEntries(sky, animals, style, at)   // Explore: every registered model + one creature per species present
 *   measure(object)                           // tris / draw calls
 *
 * A registered model is either LIVE (already in the scene; the Model Explorer isolates it in place) or one of a batch
 * built alone on first view (one palm out of the merged palms), with a builder per detail tier. Creatures are not
 * registered: each species the shard's AnimalManager has gets its own rig from the factory in the shard's style, with
 * no AI — it stands on the turntable and plays what it is told (clips, variants, X8).
 */
import * as THREE from 'three';
import { Palms, type PalmSpec } from '../world/Palms';
import { Bushes } from '../world/Bushes';
import { AnimalFactory, type AnimalStyle } from '../entities/AnimalFactory';
import { Animal } from '../entities/Animal';
import { speciesDef } from '../entities/species/registry';
import type { Sky } from '../world/Sky';
import type { Forest, TreeInstance } from '../world/Forest';
import type { Props, PropKind } from '../world/Props';
import { heightAt } from '../world/Heightfield';
import type { DrawnAs, Pipeline } from '../world/registry';
import { creatureHull } from '../entities/glbCreatures';
import { pineHull } from '../entities/pineCreatures';
import { HULL_PIPELINE, SPECIES_PIPELINE } from '../models/provenance';
import { withTier } from './tiers';
import { registerModel, registerPick, registeredModels, type ModelCategory, type RegisteredModel } from './registry';

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

// ── Driftwood's models (registered by the shard's setup — Explore reads the registry, never this function) ──
// The built pieces (hut, lookout, wreck, shrine, pier, a jetty, the boat, the rope bridge, the cove) are models already:
// main.ts registers each once in the world registry with `model` (src/world/registry.ts). The shore boulder is a model
// on the contract (src/models/, E306 M0b): place() registers it. What is left here is what the world doesn't build one
// by one yet: a palm, a bush out of their batches, and the taps on those batch meshes (M1 moves them onto the contract).

/** a built batch: its mesh, and how many copies it holds */
type Meshed = { mesh: THREE.Object3D; count?: number } | null | undefined;

export interface DriftwoodModels {
  sky: Sky;
  palms?: Meshed; bushes?: Meshed;
  palmSpecs?: readonly PalmSpec[];
}

export function registerDriftwoodModels(h: DriftwoodModels): void {

  // one of a batch: built alone, once, the first time it is viewed; `buildAt` rebuilds it as another tier would
  const fresh = (id: string, name: string, category: Category, file: string, copies: number | undefined, build: () => THREE.Object3D): void => {
    let o: THREE.Object3D | null = null;
    registerModel({ id, name, category, file, live: false, object: () => (o ??= build()), buildAt: (tier) => withTier(tier, build), pipeline: 'code', drawnAs: 'merged', ...(copies === undefined ? {} : { copies }) });
  };
  const specs = h.palmSpecs ?? [];
  const palm = specs.find((p) => p.h > 7) ?? specs[0];
  if (palm) fresh('palm', 'Coconut palm', 'nature', 'src/world/Palms.ts', h.palms?.count, () => new Palms(h.sky).build([{ ...palm, lean: Math.min(palm.lean, 0.2) }]).mesh);
  const beach = specs[3] ?? { x: 20, z: -170 };
  fresh('bush', 'Hibiscus bush', 'nature', 'src/world/Bushes.ts', h.bushes?.count, () => new Bushes(h.sky).build([{ x: beach.x - 6, z: beach.z, r: 1.3, flowers: true }]).mesh);

  // a tap on the merged palms / bushes selects the one under the finger
  const around = (p: THREE.Vector3, r: number, hgt: number): THREE.Box3 => new THREE.Box3(new THREE.Vector3(p.x - r, p.y - 0.2, p.z - r), new THREE.Vector3(p.x + r, p.y + hgt, p.z + r));
  if (h.palms) registerPick({
    object: h.palms.mesh, entry: 'palm',
    boxAt: (pt) => {
      let best = specs[0], bd = Infinity;
      for (const s of specs) { const d = (s.x - pt.x) ** 2 + (s.z - pt.z) ** 2; if (d < bd) { bd = d; best = s; } }
      return best ? around(new THREE.Vector3(best.x, pt.y - best.h * 0.9, best.z), 2.4, best.h + 1.6) : around(pt, 2, 8);
    },
  });
  if (h.bushes) registerPick({ object: h.bushes.mesh, entry: 'bush', boxAt: (pt) => around(new THREE.Vector3(pt.x, pt.y - 1, pt.z), 1.4, 1.8) });
}

// ── Pine Hollow's models (E66): the three log cabins, the pond, one Scots pine out of the forest, one of each prop ──

export interface PineHollowModels {
  sky: Sky;
  cabins?: { roots: readonly THREE.Object3D[] } | null;
  water?: Meshed;
  forest?: Forest | null;
  props?: Props | null;
  /** where the fresh ones are built (they stand on the terrain there; the studio floor follows them) */
  at: { x: number; z: number };
}

const CABIN_NAMES = ['Log cabin · hollow', 'Log cabin · east', 'Log cabin · ridge'] as const;

export function registerPineHollowModels(h: PineHollowModels): void {
  // the cabins' cores are merged across the three by material (Cabins.batchCores): each card is one copy of that batch
  (h.cabins?.roots ?? []).forEach((root, i) => {
    registerModel({ id: `cabin-${i + 1}`, name: CABIN_NAMES[i] ?? `Log cabin ${i + 1}`, category: 'buildings', file: 'src/world/Cabin.ts', live: true, object: () => root, pipeline: 'code', drawnAs: 'merged', copies: 1 });
  });
  const pond = h.water?.mesh;
  if (pond) registerModel({ id: 'pond', name: 'Still pond', category: 'nature', file: 'src/world/Water.ts', live: true, object: () => pond, pipeline: 'code', drawnAs: 'single', copies: 1 });

  const fresh = (id: string, name: string, file: string, facts: { pipeline: Pipeline; drawnAs: DrawnAs; copies: number }, build: () => THREE.Object3D): void => {
    let o: THREE.Object3D | null = null;
    registerModel({ id, name, category: 'nature', file, live: false, object: () => (o ??= build()), ...facts });
  };
  const { forest, props } = h;
  if (forest && forest.factory.variants.length > 0) {
    // the Blender tree set's Scots pines (a variant with no species is the runtime pine, drawn the same way)
    const isPine = (v: number): boolean => { const s = forest.factory.variants[v]?.species; return s === undefined || s === 'pine'; };
    const pines = forest.trees.filter((t) => isPine(t.variant)).length;
    fresh('pine', 'Scots pine', 'src/world/TreeFactory.ts', { pipeline: 'blender', drawnAs: forest.path, copies: pines }, () => pineSpecimen(forest, h.at.x, h.at.z));
  }
  const part = (kind: PropKind, id: string, name: string): void => {
    const parts = props?.parts[kind];
    // the Poly Haven photoscans: the rocks share one BatchedMesh (or instanced without multi-draw), stumps and logs are instanced
    let copies = 0, drawnAs: DrawnAs = 'instanced';
    for (const m of props?.meshes ?? []) {
      if (m.kind !== kind) continue;
      const o = m.mesh as Partial<THREE.InstancedMesh & THREE.BatchedMesh>;
      if (o.isBatchedMesh === true) { drawnAs = 'batched'; copies += o.instanceCount ?? 0; }
      else if (o.isInstancedMesh === true) copies = Math.max(copies, o.instanceMatrix?.count ?? 0);
    }
    if (parts && parts.length > 0) fresh(id, name, 'src/world/Props.ts', { pipeline: 'cc0', drawnAs, copies }, () => propSpecimen(kind, parts, h.at.x, h.at.z));
  };
  part('rock', 'boulder', 'Mossy boulder');
  part('stump', 'stump', 'Tree stump');
  part('log', 'log', 'Fallen log');

  // a tap on the forest / the props selects the one under the finger
  const around = (x: number, y: number, z: number, r: number, hgt: number): THREE.Box3 => new THREE.Box3(new THREE.Vector3(x - r, y - 0.2, z - r), new THREE.Vector3(x + r, y + hgt, z + r));
  if (forest) registerPick({
    object: forest.group, entry: 'pine',
    boxAt: (pt) => {
      let best: TreeInstance | undefined, bd = Infinity;
      for (const t of forest.nearby(pt.x, pt.z, 10)) { const d = (t.x - pt.x) ** 2 + (t.z - pt.z) ** 2; if (d < bd) { bd = d; best = t; } }
      return best ? around(best.x, best.y, best.z, Math.max(2, best.height * 0.16), best.height) : around(pt.x, pt.y - 10, pt.z, 3, 14);
    },
  });
  const ids: Record<PropKind, string> = { rock: 'boulder', stump: 'stump', log: 'log' };
  for (const m of props?.meshes ?? []) registerPick({ object: m.mesh, entry: ids[m.kind], boxAt: (pt) => around(pt.x, pt.y - (m.kind === 'rock' ? 1.2 : 0.6), pt.z, m.kind === 'log' ? 2.6 : 1.2, m.kind === 'rock' ? 2 : 1) });
}

/**
 * the tallest pine variant on its own: the forest's own geometry and materials, full detail (cards + twigs + trunk),
 * standing exactly on the nearest real tree of that variant — so VIEW IN WORLD lands on a pine that is there
 */
function pineSpecimen(forest: Forest, x: number, z: number): THREE.Object3D {
  const f = forest.factory;
  let vi = 0;
  const pine = (c: { species?: string | undefined }) => c.species === undefined || c.species === 'pine'; // the species set: the tallest Scots pine
  f.variants.forEach((c, i) => { if (pine(c) && (!pine(f.variants[vi] ?? {}) || c.height > (f.variants[vi]?.height ?? 0))) vi = i; });
  const v = f.variants[vi];
  const g = new THREE.Group();
  if (!v) return g;
  let real: TreeInstance | undefined, bd = Infinity;
  for (const t of forest.trees) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (t.variant === vi && d < bd) { bd = d; real = t; } }
  const crown = new THREE.Mesh(v.cardsHi, f.needleMaterial), twigs = new THREE.Mesh(v.twigs, f.twigMaterial);
  crown.customDepthMaterial = f.needleDepth; twigs.customDepthMaterial = f.twigDepth;
  for (const m of [new THREE.Mesh(v.trunk, f.barkMaterial), crown, twigs]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  if (real) { g.position.set(real.x, real.y, real.z); g.rotation.y = real.rot; g.scale.setScalar(real.scale); }
  else g.position.set(x, heightAt(x, z), z);
  return g;
}

/** one prop on its own: the largest part of the set (the boulders are six shapes), standing on its base */
function propSpecimen(kind: PropKind, parts: NonNullable<Props['parts'][PropKind]>, x: number, z: number): THREE.Object3D {
  const g = new THREE.Group();
  const pick = kind === 'rock' ? [...parts].sort((a, b) => volume(b.geometry) - volume(a.geometry)).slice(0, 1) : parts;
  for (const p of pick) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.applyMatrix4(p.matrix);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  for (const m of g.children) m.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  g.position.set(x, heightAt(x, z), z);
  if (kind === 'log') g.scale.setScalar(1.4);
  return g;
}

function volume(geo: THREE.BufferGeometry): number {
  geo.computeBoundingBox();
  const s = geo.boundingBox?.getSize(new THREE.Vector3());
  return s ? s.x * s.y * s.z : 0;
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
