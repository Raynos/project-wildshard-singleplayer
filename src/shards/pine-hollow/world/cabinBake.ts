/**
 * Pine Hollow's log buildings drawn from their offline bake (G285, SF72 "bake the code-built worlds"). The shapes are built
 * at build time (`../generators/logCabin.ts`, `src/shards/pine-hollow/generators/bake-pine-cabins.mjs`): the binary holds every geometry (zlib, read
 * behind the loading screen), `../data/cabins.json` every building's record. Here a record becomes the building the
 * homestead (./homestead.ts) and `place` (./cabins.ts) work with: its root with what draws on its own (the door on its pivot,
 * the glows, the fire pit and lantern model copies, smoke and flames, the wheel, its lights or the phone's anchors), its
 * parts per material for the weld, its colliders, floors and live parts handed to its owner, in the order the builder
 * handed them: the SDK's baked buildings (@wildshard/sdk/props/bakedBuilding) over the look row ../data/cabinBuild.ts.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { loadSiteTimbers } from './timberSites';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { BakedBuildingAssembly, NO_BUILDING_OWNER, type BakedBuildingOwner, type BakedBuildingRole, type BakedBuildingTier } from '../runtime/props/bakedBuilding';
import { CABIN_BUILD } from '../runtime/props/cabinBuild';
import rows from '../data/cabins.json' with { type: 'json' };
import { CabinRowsSchema, type CabinRows, type BakedBuilding, type KitMat, type PropKind } from './logKit';
import type { Mats } from './homestead';

/** Unchanged native owner rows, parsed strictly once. */
export const CABIN_ROWS: CabinRows = v.parse(CabinRowsSchema, rows);

const Seed = v.strictObject({ ordinal: v.pipe(v.number(), v.integer(), v.minValue(0)), width: v.literal(4), values: v.array(v.pipe(v.number(), v.finite())) });
/** Original meshes and particle seeds; each native building receives its own geometry copy. */
export class CabinGeometries {
  private readonly views: Awaited<ReturnType<typeof loadSiteTimbers>>;
  private readonly seeds: ReadonlyMap<number, readonly number[]>;
  constructor(views: Awaited<ReturnType<typeof loadSiteTimbers>>, seeds: unknown = authored.cabins.seeds) {
    this.views = views; this.seeds = new Map(v.parse(v.array(Seed), seeds).map(seed => [seed.ordinal, seed.values]));
  }
  /** Preserve geometry ordinals, typed channels and the original particle seed blocks. */
  geometry(ordinal: number): THREE.BufferGeometry {
    const seeds = this.seeds.get(ordinal);
    if (seeds !== undefined) return new THREE.BufferGeometry().setAttribute('seed', new THREE.BufferAttribute(Float32Array.from(seeds), 4));
    const view = this.views.get(`cabin-geometry-${String(ordinal)}`);
    if (view === undefined) throw new Error(`[cabins] missing original geometry ${String(ordinal)}`);
    return view.geometry.clone();
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

/** What a log building hands its owner as it is assembled: the homestead (./homestead.ts `Cabins`). */
export type BuildingOwner = BakedBuildingOwner;
/** the owner that keeps nothing (a specimen's) */
export const NO_OWNER: BuildingOwner = NO_BUILDING_OWNER;
/** `standalone`: one of the three cabins; `member`: a mill-hamlet building; `specimen`: the Model Explorer's copy */
export type BuildingRole = BakedBuildingRole;

/** small parts drawn only within the detail distance (TIER_CONFIG.cabinDetailDist): their depth only through the near proxy */
export const DETAIL_KEYS = new Set<KitMat>(CABIN_BUILD.detail);
/** merged parts that go past 2× the detail distance (log ends, woodpile bark, door frame) */
export const FAR_KEYS = new Set<KitMat>(CABIN_BUILD.far);

/** the tier's cabin settings, read live */
const TIER: BakedBuildingTier = {
  get detailDist() { return TIER_CONFIG.cabinDetailDist; },
  get detailShadows() { return TIER_CONFIG.cabinDetailShadows; },
  get sharedLights() { return TIER_CONFIG.sharedCabinLights; },
};
const matrix = (e: readonly number[]): THREE.Matrix4 => new THREE.Matrix4().fromArray(e);

/** One log building assembled from its record where it stands (the SDK's baked building), and the props it set about. */
export class LogBuilding extends BakedBuildingAssembly<KitMat, 'flame' | 'ember' | 'smoke'> {
  /** the props it set about (world matrices) */
  readonly props: Record<PropKind, THREE.Matrix4[]>;

  /** `b` its record, `role` how it draws (see BuildingRole) */
  constructor(owner: BuildingOwner, b: BakedBuilding, geometries: CabinGeometries, mats: Mats, sky: Pick<Sky, 'setupMaterial'>, models: { firePit: THREE.Object3D; lantern: THREE.Object3D }, role: BuildingRole) {
    super({ owner, record: b, geometries, mats: { parts: mats, particles: mats, glass: mats.glass, glow: mats.glow }, sky, models, role, look: CABIN_BUILD, tier: TIER });
    this.props = { crate: b.props.crate.map(matrix), barrel: b.props.barrel.map(matrix), bucket: b.props.bucket.map(matrix), hatchet: b.props.hatchet.map(matrix) };
  }
}
