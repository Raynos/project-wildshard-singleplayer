import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
/**
 * Pine Hollow's log buildings drawn from their offline bake (G285, SF72 "bake the code-built worlds"). The shapes are built
 * at build time (`../generators/logCabin.ts`, `src/shards/pine-hollow/generators/bake-pine-cabins.mjs`): the binary holds every geometry (zlib, read
 * behind the loading screen), `../data/cabins.json` every building's record. Here a record becomes the building the
 * homestead (./homestead.ts) and `place` (./cabins.ts) work with: its root with what draws on its own (the door on its pivot,
 * the glows, the fire pit and lantern model copies, smoke and flames, the wheel, its lights or the phone's anchors), its
 * parts per material for the weld, its colliders, floors and live parts handed to its owner, in the order the builder
 * handed them: the game's building assembly over the named building-look row.
 */
import * as THREE from 'three';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { loadSiteTimbers } from './timberSites';
import { mossHint } from '../../world/timberBake';
import authored from '../../data/timberWorld.generated.json' with { type: 'json' };
import { BakedBuildingAssembly } from '@wildshard/game/shardfile/buildingAssembly';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import type { BakedBuildingLook, BakedBuildingRole, BuildingAssemblyRows } from '@wildshard/format/buildings';
import rows from '../../data/cabins.json' with { type: 'json' };
import type { BakedBuilding } from '../productSections.generated.d.ts';
import type { Mats } from './homestead';

/** Unchanged native owner rows, validated by the generator. */
export const CABIN_ROWS = rows;

/** Original meshes and particle seeds; each native building receives its own geometry copy. */
export class CabinGeometries {
  private readonly views: Awaited<ReturnType<typeof loadSiteTimbers>>;
  private readonly seeds: ReadonlyMap<number, readonly number[]>;
  constructor(views: Awaited<ReturnType<typeof loadSiteTimbers>>) {
    this.views = views; this.seeds = new Map(authored.cabins.seeds.map(seed => [seed.ordinal, seed.values]));
  }
  /** Preserve geometry ordinals, typed channels and the original particle seed blocks. */
  geometry(ordinal: number | string): THREE.BufferGeometry {
    const seeds = typeof ordinal === 'number' ? this.seeds.get(ordinal) : undefined;
    if (seeds !== undefined) return new THREE.BufferGeometry().setAttribute('seed', new THREE.BufferAttribute(Float32Array.from(seeds), 4));
    const view = this.views.get(typeof ordinal === 'number' ? `cabin-geometry-${String(ordinal)}` : ordinal);
    if (view === undefined) throw new Error(`[cabins] missing original geometry ${String(ordinal)}`);
    return typeof ordinal === 'number' ? mossHint(view.geometry.clone()) : view.geometry;
  }
}

/** the hamlet's roofs for the map: each building's footprint (+1 m of eave), turned with it */
export function hamletRoofs(): { x: number; z: number; rot: number; w: number; d: number }[] {
  return CABIN_ROWS.buildings.filter((b) => b.hamlet).map((b) => ({ x: b.at[0], z: b.at[2], rot: b.rot, w: b.size[1] + 1, d: b.size[0] + 1 }));
}

/** Read the admitted shape library; a bake that fails to load is a page fault (`console.error`), and the buildings stand absent. */
export async function loadCabinBake(ctx: Parameters<typeof loadSiteTimbers>[0]): Promise<CabinGeometries | null> {
  try {
    const { loadSiteTimbers: readViews } = await import('./timberSites');
    return new CabinGeometries(await readViews(ctx));
  } catch (error: unknown) {
    console.error('[pine-hollow] the baked log buildings did not load:', error);
    return null;
  }
}

/** Native resource publication remains a counted adapter until Z2 owns these static parts. */
export type BuildingRole = BakedBuildingRole;
export type LogBuilding = BakedBuildingAssembly<string, 'flame' | 'ember' | 'smoke'> & { readonly props: { crate: THREE.Matrix4[]; barrel: THREE.Matrix4[]; bucket: THREE.Matrix4[]; hatchet: THREE.Matrix4[] } };
const matrix = (elements: readonly number[]): THREE.Matrix4 => new THREE.Matrix4().fromArray(elements);
export function createLogBuilding(resources: SceneHandles, b: BakedBuilding, geometries: CabinGeometries, mats: Mats,
  models: { firePit: THREE.Object3D; lantern: THREE.Object3D }, role: BuildingRole, look: BakedBuildingLook): LogBuilding {
  const ordinals = new Set([...b.parts.map(([, ordinal]) => ordinal), ...b.glass,
    ...b.nodes.flatMap(node => node.t === 'door' ? [node.leaf, node.iron, node.batten] : node.t === 'glow' || node.t === 'wheel' ? [node.g] : node.t === 'particles' ? [node.seeds] : node.t === 'lantern' ? [node.ring] : [])]);
  const names = Object.fromEntries(Object.entries<THREE.Material>({ ...mats }).map(([key, material]) => [key, resources.lend(material)]));
  const material = (key: keyof Mats): string => { const id = names[key]; if (id === undefined) throw new Error('Missing building material'); return id; };
  const parts = Object.fromEntries(['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'].map(key => [key, names[key] ?? '']));
  const input: BuildingAssemblyRows<string, 'flame' | 'ember' | 'smoke'> = { id: b.id, record: b,
    geometry: Object.fromEntries([...ordinals].map(ordinal => [String(ordinal), resources.lend(geometries.geometry(ordinal))])),
    materials: { parts, particles: { flame: material('flame'), ember: material('ember'), smoke: material('smoke') }, glass: material('glass'), glow: material('glow') },
    models: { firePit: resources.lend(models.firePit), lantern: resources.lend(models.lantern) },
    role, look, tier: { detailDist: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.cabinDetailDist', 'number', TIER_CONFIG), detailShadows: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.cabinDetailShadows', 'boolean', TIER_CONFIG), sharedLights: plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.sharedCabinLights', 'boolean', TIER_CONFIG) } };
  return Object.assign(new BakedBuildingAssembly(resources, input), { props: { crate: b.props.crate.map(matrix), barrel: b.props.barrel.map(matrix), bucket: b.props.bucket.map(matrix), hatchet: b.props.hatchet.map(matrix) } });
}
