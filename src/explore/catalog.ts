/**
 * The Model Explorer's catalog (project/archive/2026-09-23-explore-world.md X3, made generic in X10).
 *
 *   registerDriftwoodModels(handles)          // Driftwood's setup (main.ts, at boot): the hut, wreck, … into the registry
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

type Grouped = { group: THREE.Object3D } | null | undefined;
type Meshed = { mesh: THREE.Object3D } | null | undefined;

export interface DriftwoodModels {
  sky: Sky;
  hut?: Grouped; lookout?: Grouped; wreck?: Grouped; shrine?: Grouped; pier?: Grouped; boat?: Grouped; cove?: Grouped;
  jetties?: readonly { group: THREE.Object3D }[];
  bridge?: Meshed; palms?: Meshed; bushes?: Meshed;
  palmSpecs?: readonly PalmSpec[];
}

export function registerDriftwoodModels(h: DriftwoodModels): void {
  const live = (id: string, name: string, category: Category, file: string, o: THREE.Object3D | null | undefined): void => {
    if (o) registerModel({ id, name, category, file, live: true, object: () => o });
  };
  live('hut', 'Hut', 'buildings', 'src/world/Hut.ts', h.hut?.group);
  live('lookout', 'Lookout tower', 'buildings', 'src/world/Lookout.ts', h.lookout?.group);
  live('wreck', 'Shipwreck', 'buildings', 'src/world/Wreck.ts', h.wreck?.group);
  live('shrine', 'Ring shrine', 'buildings', 'src/world/Shrine.ts', h.shrine?.group);
  live('pier', 'Pier', 'buildings', 'src/world/Pier.ts', h.pier?.group);
  live('jetty', 'Jetty', 'buildings', 'src/world/Pier.ts', h.jetties?.[0]?.group);
  live('boat', 'Sailboat', 'buildings', 'src/world/Boat.ts', h.boat?.group);
  live('bridge', 'Rope bridge', 'buildings', 'src/world/RopeBridge.ts', h.bridge?.mesh);
  live('cove', 'Wreck cove', 'nature', 'src/world/Cove.ts', h.cove?.group);

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
