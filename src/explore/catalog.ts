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
import { Boulders } from '../world/Boulders';
import { Bushes } from '../world/Bushes';
import { AnimalFactory, type AnimalStyle } from '../entities/AnimalFactory';
import { Animal } from '../entities/Animal';
import { speciesDef } from '../entities/species/registry';
import type { Sky } from '../world/Sky';
import type { Forest, TreeInstance } from '../world/Forest';
import type { Props, PropKind } from '../world/Props';
import { heightAt } from '../world/Heightfield';
import { withTier } from './tiers';
import { registerModel, registerPick, registeredModels, type ModelCategory, type RegisteredModel } from './registry';

export type Category = ModelCategory;
export const CATEGORIES: readonly { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'buildings', label: 'Buildings' }, { id: 'nature', label: 'Nature' }, { id: 'creatures', label: 'Creatures' },
];

export interface CatalogEntry extends RegisteredModel {
  /** ms the fresh instance took to build (live ones were built at boot) */
  buildMs: number;
  /** creatures: the Animal on the turntable, the species' variants and a rebuild on one of them (also how DIE is undone) */
  animal?: Animal;
  variants?: readonly { id: string; label: string }[];
  rebuild?: (variant?: string) => void;
  tick?: (dt: number, t: number) => void;
}

// ── Driftwood's models (registered by the shard's setup — Explore reads the registry, never this function) ──
// The built pieces (hut, lookout, wreck, shrine, pier, a jetty, the boat, the rope bridge, the cove) are models already:
// main.ts registers each once in the world registry with `model` (src/world/registry.ts). What is left here is what the
// world doesn't build one by one: a palm, a boulder, a bush out of their batches, and the taps on those batch meshes.

type Meshed = { mesh: THREE.Object3D } | null | undefined;

export interface DriftwoodModels {
  sky: Sky;
  palms?: Meshed; bushes?: Meshed;
  palmSpecs?: readonly PalmSpec[];
}

export function registerDriftwoodModels(h: DriftwoodModels): void {

  // one of a batch: built alone, once, the first time it is viewed; `buildAt` rebuilds it as another tier would
  const fresh = (id: string, name: string, category: Category, file: string, build: () => THREE.Object3D): void => {
    let o: THREE.Object3D | null = null;
    registerModel({ id, name, category, file, live: false, object: () => (o ??= build()), buildAt: (tier) => withTier(tier, build) });
  };
  const specs = h.palmSpecs ?? [];
  const palm = specs.find((p) => p.h > 7) ?? specs[0];
  if (palm) fresh('palm', 'Coconut palm', 'nature', 'src/world/Palms.ts', () => new Palms(h.sky).build([{ ...palm, lean: Math.min(palm.lean, 0.2) }]).mesh);
  const beach = specs[3] ?? { x: 20, z: -170 };
  fresh('boulder', 'Boulder', 'nature', 'src/world/Boulders.ts', () => new Boulders(h.sky).build([{ x: beach.x + 6, z: beach.z, r: 1.8, rot: 0.6, squash: 0.72 }]).mesh);
  fresh('bush', 'Hibiscus bush', 'nature', 'src/world/Bushes.ts', () => new Bushes(h.sky).build([{ x: beach.x - 6, z: beach.z, r: 1.3, flowers: true }]).mesh);

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
  (h.cabins?.roots ?? []).forEach((root, i) => {
    registerModel({ id: `cabin-${i + 1}`, name: CABIN_NAMES[i] ?? `Log cabin ${i + 1}`, category: 'buildings', file: 'src/world/Cabin.ts', live: true, object: () => root });
  });
  const pond = h.water?.mesh;
  if (pond) registerModel({ id: 'pond', name: 'Still pond', category: 'nature', file: 'src/world/Water.ts', live: true, object: () => pond });

  const fresh = (id: string, name: string, file: string, build: () => THREE.Object3D): void => {
    let o: THREE.Object3D | null = null;
    registerModel({ id, name, category: 'nature', file, live: false, object: () => (o ??= build()) });
  };
  const { forest, props } = h;
  if (forest && forest.factory.variants.length > 0) fresh('pine', 'Scots pine', 'src/world/TreeFactory.ts', () => pineSpecimen(forest, h.at.x, h.at.z));
  const part = (kind: PropKind, id: string, name: string): void => {
    const parts = props?.parts[kind];
    if (parts && parts.length > 0) fresh(id, name, 'src/world/Props.ts', () => propSpecimen(kind, parts, h.at.x, h.at.z));
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

export function catalogEntries(sky: Sky, animals: readonly { kind: string }[], style: AnimalStyle, at: { x: number; z: number }): CatalogEntry[] {
  const out: CatalogEntry[] = registeredModels().map((m) => {
    const e: CatalogEntry = { id: m.id, name: m.name, category: m.category, file: m.file, live: m.live, object: m.object, buildMs: 0 };
    if (m.buildAt) e.buildAt = m.buildAt;
    if (!m.live) {
      let built = false;
      e.object = () => { if (!built) { built = true; const t0 = performance.now(); const o = m.object(); e.buildMs = performance.now() - t0; return o; } return m.object(); };
    }
    return e;
  });
  let factory: AnimalFactory | null = null;
  for (const kind of new Set(animals.map((a) => a.kind))) {
    const sp = speciesDef(kind);
    const e: CatalogEntry = { id: kind, name: sp.label, category: 'creatures', file: `src/entities/species/${kind}.ts`, live: false, buildMs: 0, object: () => new THREE.Group() };
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
