/**
 * Driftwood Isle's fixed-site buildings (E306 / E315 M1: models on the contract, src/engine/models/model.ts), all fixed
 * bakes (SHARD-PLATFORM M3, G285): their builders run offline where each stands, over the native terrain
 * (generators/bake-driftwood-fixed-models.mjs), and the page reads back their geometry (baked/fixed-models/*.glb) and
 * their layouts (the product's custom/fixedLayouts: the legacy boxes, the physics descriptors, the anchors and the floor
 * rectangles engine/physics/box#floorAtRects reads), all in own space. A changed site needs a rebake; `bakedSite`
 * refuses one it was not baked for.
 *
 * - hut (generators/hut.ts): the castaway's stilt cabin on the plateau; the kit mesh and the unlit flames. Anchors: npc,
 *   hutChest, door, porch.
 * - lookout (generators/lookout.ts): the headland tower, its zipline pulley facing the sea cave (`zipTo`); one kit mesh
 *   with the banner's sway channel (its shadow moves with it, M5). Anchors (y = platform unless noted): beacon, shard,
 *   zipTop (the cable leaves the pulley 2.5 m above it), stairFoot.
 * - shrine (generators/shrine.ts): the Ring Shrine on its knoll and its flat Explorer specimen; the kit, the pool (its
 *   graph, lent before the world builds) and the glyphs (runtime/world/Shrine.ts pulses them). Anchors: altar, pool,
 *   stairFoot, ring.
 * - shipwreck (generators/shipwreck.ts): the wreck's Explorer card; the world copy is world/Wreck.ts's site.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import type { ModelSiteLayout } from '@wildshard/engine/models/place';
import { floorAtRects } from '@wildshard/engine/physics/box';
import { libraryModel, type LibraryDraw } from '@wildshard/game/models/libraryModel';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { driftwoodRows } from '../boot/rows';
import { SHRINE_POOL_LOOK, SHRINE_SITES, WRECK_SITES } from '../const';
import { fixedGeometryReady, loadFixedGeometry, HUT_KIT_GEOMETRY, HUT_FLAMES_GEOMETRY, LOOKOUT_GEOMETRY, WRECK_KIT_GEOMETRY,
  WRECK_GLOW_GEOMETRY, SHIPWRECK_KIT_GEOMETRY, SHIPWRECK_GLOW_GEOMETRY, SHRINE_KIT_GEOMETRY, SHRINE_WATER_GEOMETRY,
  SHRINE_GLYPHS_GEOMETRY, SHRINE_SPECIMEN_KIT_GEOMETRY, SHRINE_SPECIMEN_WATER_GEOMETRY, SHRINE_SPECIMEN_GLYPHS_GEOMETRY } from '../boot/fixedGeometry';

/** Where a building stands: its centre (world xz) and which way its front faces (rot, radians about +Y). */
export interface ShrineSite { readonly x: number; readonly z: number; readonly rot: number }
/** A site and, for the tower, the world point its pulley faces. */
export interface SitePlacement { readonly site: ShrineSite; readonly zipTo?: { readonly x: number; readonly z: number } }
/** A placement's params (assets/contracts/shrine.ts, wreck.ts): its admitted site and the ground there. */
export interface ShrineParams { readonly site: ShrineSite; readonly ground: (x: number, z: number) => number }
/** Where a wreck lies: heading, heel (`roll`), trim (`pitch`) and hold floor y (world). */
export interface WreckSpec { x: number; z: number; heading: number; roll?: number; pitch?: number; floorY?: number }
type Kind = 'hut' | 'lookout' | 'shrine';
type Layouts = ReturnType<typeof driftwoodRows<'custom/fixedLayouts'>>;

const layouts = () => driftwoodRows('custom/fixedLayouts');
const same = (a: ShrineSite, b: ShrineSite): boolean => a.x === b.x && a.z === b.z && a.rot === b.rot;
const descsOf = (kind: Kind, rows: readonly unknown[]) => readColliderRows(rows, kind === 'shrine'
  ? { kinds: ['box', 'treads'], surfaces: ['stone'], requireSurface: true } : { kinds: ['box', 'treads'], surfaces: [] });

/** The shrine's admitted site (the knoll or the flat Explorer specimen); runtime callers never build a procedural substitute. */
export function shrineSiteKind(site: ShrineSite): 'world' | 'specimen' {
  const rows = layouts().shrine;
  if (same(site, rows.world.site)) return 'world';
  if (same(site, rows.specimen.site)) return 'specimen';
  throw new Error('Shrine site changed; regenerate its authored geometry');
}
/** The shrine's baked row at an admitted site (its base and top terrace levels with the rest). */
export const shrineRow = (site: ShrineSite): Layouts['shrine']['world'] => layouts().shrine[shrineSiteKind(site)];

/** The baked site's origin (its centre on the ground, world) and its layout (fresh copies: the caller may place them). */
export function bakedSite(kind: Kind, p: SitePlacement): { origin: { x: number; y: number; z: number }; layout: ModelSiteLayout } {
  const rows = layouts(), row = kind === 'shrine' ? shrineRow(p.site) : rows[kind], zip = kind === 'lookout' ? rows.lookout.zipTo : undefined;
  if (!same(p.site, row.site) || p.zipTo?.x !== zip?.x || p.zipTo?.z !== zip?.z) throw new Error(`Driftwood ${kind} site changed; regenerate its fixed geometry`);
  return { origin: { ...row.origin }, layout: { colliders: structuredClone(row.colliders), anchors: structuredClone(row.anchors),
    floorHeightAt: (x, z) => floorAtRects(row.floors, x, z, 'first') } };
}

/** Select the world landmark or flat-ground Explorer wreck; a new site needs an authored bake. */
export function wreckSiteKind(site: WreckSpec): keyof typeof WRECK_SITES {
  for (const kind of ['world', 'specimen'] as const) {
    const row = WRECK_SITES[kind];
    if (site.x === row.x && site.z === row.z && site.heading === row.heading && site.floorY === row.floorY
      && (site.roll ?? -0.2) === row.roll && (site.pitch ?? 0.05) === row.pitch) return kind;
  }
  throw new Error('Shipwreck site changed; regenerate its authored geometry');
}

export const SHRINE_RUNE = new THREE.Color('#7fd9ff');
let poolLook: THREE.Material | null = null;
/** hand the pool its compiled graph (look.materials, data/poolLook.ts: the ripples; its toon look follows the day clock with
 *  the cove's pools) before the world builds */
export function setShrinePoolLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(SHRINE_POOL_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the shrine pool graph');
  poolLook = material;
}
/** the shrine's pool (its lent graph; a shrine built before that refuses) and its glyphs, which the world pulses */
export function shrineMaterials(ctx: ModelContext): { water: THREE.Material; glyphs: THREE.MeshBasicMaterial } {
  return ctx.once('driftwood-isle/shrine:materials', () => {
    if (poolLook === null) throw new Error('Driftwood shrine: no pool graph material lent (the runtime compiles it before the world builds)');
    return { water: poolLook, glyphs: new THREE.MeshBasicMaterial({ color: SHRINE_RUNE, side: THREE.DoubleSide }) };
  });
}

const DRAWS = { 'hut-kit': HUT_KIT_GEOMETRY, 'hut-flames': HUT_FLAMES_GEOMETRY, lookout: LOOKOUT_GEOMETRY,
  'wreck-world-kit': WRECK_KIT_GEOMETRY, 'wreck-world-glow': WRECK_GLOW_GEOMETRY, 'wreck-specimen-kit': SHIPWRECK_KIT_GEOMETRY, 'wreck-specimen-glow': SHIPWRECK_GLOW_GEOMETRY,
  'shrine-world-kit': SHRINE_KIT_GEOMETRY, 'shrine-world-water': SHRINE_WATER_GEOMETRY, 'shrine-world-glyphs': SHRINE_GLYPHS_GEOMETRY,
  'shrine-specimen-kit': SHRINE_SPECIMEN_KIT_GEOMETRY, 'shrine-specimen-water': SHRINE_SPECIMEN_WATER_GEOMETRY, 'shrine-specimen-glyphs': SHRINE_SPECIMEN_GLYPHS_GEOMETRY };
type Draw = LibraryDraw<'kit' | 'still' | 'glow' | 'water' | 'glyphs', keyof typeof DRAWS>;
const shadowed = (draw: Draw['draw'], material: Draw['material']): Draw => ({ draw, material, castShadow: true, receiveShadow: true });

/** One fixed-site model: its baked draws, the shared materials, its bake's colliders and its late-loading card. */
const fixedModel = <P extends object>(id: string, name: string, surface: 'planks' | 'stone', size: readonly [number, number, number], defaults: P,
  draws: (p: P) => readonly Draw[], colliders?: (p: P) => ReturnType<typeof readColliderRows>) => defineModel<P>({
  id: `driftwood-isle/${id}`, name, category: 'buildings', pipeline: 'code', file: 'src/shards/driftwood-isle/runtime/models/fixedSites.ts', surface, defaults,
  ...libraryModel<P, Draw['material'], Draw['draw']>({
    draws, geometry: (_, draw) => DRAWS[draw].copy(),
    material: (ctx, key) => key === 'kit' ? lowPolyLookMaterial(ctx.sky) : key === 'still' ? lowPolyLookMaterial(ctx.sky, 'still')
      : key === 'glow' ? ctx.once('driftwood-isle/fixed:glow', () => new THREE.MeshBasicMaterial({ vertexColors: true })) : shrineMaterials(ctx)[key],
    ...(colliders === undefined ? {} : { colliders }),
    loading: { id: `driftwood-isle/${id}`, ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [...size] },
  }),
});

export const hut = fixedModel('hut', 'Hut', 'planks', [11, 7, 8], {}, () => [shadowed('hut-kit', 'still'), { draw: 'hut-flames', material: 'glow' }],
  () => descsOf('hut', layouts().hut.descs));
export const lookout = fixedModel('lookout', 'Lookout tower', 'planks', [6, 11, 9], {}, () => [shadowed('lookout', 'kit')], () => descsOf('lookout', layouts().lookout.descs));
/** The world copy's colliders and draw are the Wreck site's (world/Wreck.ts: `drawnInto`); this draws its Explorer card. */
export const shipwreck = fixedModel<{ readonly site: WreckSpec; readonly ground: (x: number, z: number) => number }>('shipwreck', 'Shipwreck', 'planks', [12, 15, 24],
  { site: WRECK_SITES.specimen, ground: () => 0 }, p => { const k = wreckSiteKind(p.site); return [shadowed(`wreck-${k}-kit`, 'kit'), { draw: `wreck-${k}-glow`, material: 'glow' }]; });
export const shrine = fixedModel<ShrineParams>('shrine', 'Ring shrine', 'stone', [20, 13, 30], { site: SHRINE_SITES.specimen, ground: () => 0 }, p => {
  const k = shrineSiteKind(p.site);
  return [shadowed(`shrine-${k}-kit`, 'still'), { draw: `shrine-${k}-water`, material: 'water', receiveShadow: true, renderOrder: 1 }, { draw: `shrine-${k}-glyphs`, material: 'glyphs', renderOrder: 1 }];
}, p => descsOf('shrine', shrineRow(p.site).descs));
