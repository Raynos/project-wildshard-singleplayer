/**
 * The Model Explorer's catalog (EXPLORE-WORLD.md X3): every Driftwood model the viewer can put on the turntable.
 *
 *   const entries = driftwoodCatalog(handles);   // handles = main.ts's world dressing (+ sky, animals' factory)
 *   entry.object()   → the Object3D to show: the LIVE one already in the scene (hut, wreck, pier …) or, for the
 *                      batched ones (one palm / boulder / bush out of a merged mesh) and the creatures, a fresh single
 *                      instance built once on first view
 *   entry.anchor     → where it stands in the world (VIEW IN WORLD flies there)
 *   entry.tick(dt,t) → animate it on the turntable (creatures breathe / walk)
 *
 * Only reads the model modules' public build APIs — the Driftwood remaster owns their insides.
 */
import * as THREE from 'three';
import { Palms, type PalmSpec } from '../world/Palms';
import { Boulders } from '../world/Boulders';
import { Bushes } from '../world/Bushes';
import { AnimalFactory, type AnimalKind } from '../entities/AnimalFactory';
import { Animal } from '../entities/Animal';
import type { Sky } from '../world/Sky';
import { speciesDef } from '../entities/species/registry';
import { withTier } from './tiers';
import type { Tier } from '../core/tier';

export type Category = 'buildings' | 'nature' | 'creatures';
export const CATEGORIES: readonly { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'buildings', label: 'Buildings' }, { id: 'nature', label: 'Nature' }, { id: 'creatures', label: 'Creatures' },
];

export interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  /** the source module an agent edits for this model */
  file: string;
  /** true: `object()` is already in the scene (the Model Explorer isolates it in place) */
  live: boolean;
  object: () => THREE.Object3D;
  /** where it stands in the world — VIEW IN WORLD flies here */
  anchor: THREE.Vector3;
  /** ms the fresh instance took to build (live ones were built at boot) */
  buildMs: number;
  /** a batch member's builder at a given detail tier (DETAIL TIERS view, X7); absent → one build for every tier */
  buildAt?: (tier: Tier) => THREE.Object3D;
  /** creatures: the Animal on the turntable (clips, variants — X8) */
  animal?: Animal;
  /** creatures: the species' variants (id + label) and a rebuild on one of them (also how DIE is undone) */
  variants?: readonly { id: string; label: string }[];
  rebuild?: (variant?: string) => void;
  tick?: (dt: number, t: number) => void;
}

type Grouped = { group: THREE.Object3D } | null | undefined;
type Meshed = { mesh: THREE.Object3D } | null | undefined;

/** what main.ts hands over: the dressing it built at boot (all optional: a shard without the POI simply has no entry) */
export interface CatalogHandles {
  sky: Sky;
  scene: THREE.Scene;
  hut?: Grouped; lookout?: Grouped; wreck?: Grouped; shrine?: Grouped; pier?: Grouped; boat?: Grouped; cove?: Grouped;
  jetties?: { group: THREE.Object3D }[];
  bridge?: Meshed;
  palmSpecs?: PalmSpec[];
}

const centreOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());

export function driftwoodCatalog(h: CatalogHandles): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const live = (id: string, name: string, category: Category, file: string, o: THREE.Object3D | null | undefined): void => {
    if (!o) return;
    out.push({ id, name, category, file, live: true, object: () => o, anchor: centreOf(o), buildMs: 0 });
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

  // one of a batch: built alone, once, the first time it is viewed
  const fresh = (id: string, name: string, category: Category, file: string, anchor: THREE.Vector3, build: () => THREE.Object3D, extra: Partial<CatalogEntry> = {}): void => {
    let o: THREE.Object3D | null = null;
    const e: CatalogEntry = {
      id, name, category, file, live: false, anchor, buildMs: 0, buildAt: (tier) => withTier(tier, build), ...extra,
      object: () => { if (!o) { const t0 = performance.now(); o = build(); e.buildMs = performance.now() - t0; } return o; },
    };
    out.push(e);
  };
  const palm = h.palmSpecs?.find((p) => p.h > 7) ?? h.palmSpecs?.[0];
  if (palm) fresh('palm', 'Coconut palm', 'nature', 'src/world/Palms.ts', new THREE.Vector3(palm.x, 0, palm.z), () => new Palms(h.sky).build([{ ...palm, lean: Math.min(palm.lean, 0.2) }]).mesh);
  const beach = h.palmSpecs?.[3] ?? { x: 20, z: -170 };
  fresh('boulder', 'Boulder', 'nature', 'src/world/Boulders.ts', new THREE.Vector3(beach.x + 6, 0, beach.z), () => new Boulders(h.sky).build([{ x: beach.x + 6, z: beach.z, r: 1.8, rot: 0.6, squash: 0.72 }]).mesh);
  fresh('bush', 'Hibiscus bush', 'nature', 'src/world/Bushes.ts', new THREE.Vector3(beach.x - 6, 0, beach.z), () => new Bushes(h.sky).build([{ x: beach.x - 6, z: beach.z, r: 1.3, flowers: true }]).mesh);

  // creatures: their own rig from the low-poly factory, no AI — they stand on the turntable and play what they are told
  let factory: AnimalFactory | null = null;
  const creature = (kind: AnimalKind, name: string, variant?: string): void => {
    const e: CatalogEntry = { id: kind, name, category: 'creatures', file: `src/entities/species/${kind}.ts`, live: false, anchor: new THREE.Vector3(), buildMs: 0, object: () => new THREE.Group() };
    const group = new THREE.Group();
    let built = false;
    e.variants = speciesDef(kind).variants.map((v) => ({ id: v.id, label: v.label }));
    // a fresh rig (the variant's paint + scale), standing where the last one stood: the turntable's treadmill keeps it there
    e.rebuild = (v = variant) => {
      const t0 = performance.now();
      factory ??= new AnimalFactory(h.sky, { style: 'lowpoly' });
      const model = factory.model(kind, v);
      const a = new Animal(factory.instantiate(model, 0.5), model, 7, 1);
      a.prepareMaterial = (m) => { h.sky.setupMaterial(m); };
      const old = e.animal;
      a.place(old ? old.position.x : beach.x, old ? old.position.z : beach.z, old ? old.yaw : Math.PI * 0.8);
      a.sampleTerrain();
      if (kind === 'sailor') { a.mem['init'] = 1; a.mem['rise'] = 1; } // it waits sunk under the wreck's deck until the hold wakes it (sailor.ts): on the turntable it stands
      if (old) old.mesh.removeFromParent();
      group.add(a.mesh);
      e.animal = a;
      e.anchor = a.position.clone();
      e.tick = (dt, t) => { a.update(dt, t, true); };
      e.buildMs = performance.now() - t0;
    };
    e.object = () => { if (!built) { built = true; e.rebuild?.(); } return group; };
    out.push(e);
  };
  creature('boar', 'Boar');
  creature('bear', 'Bear');
  creature('crab', 'Reef crab', 'big');
  creature('monkey', 'Coconut monkey');
  creature('sailor', 'Drowned sailor', 'sailor');
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
