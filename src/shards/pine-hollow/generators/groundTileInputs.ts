import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakePlantedForest } from '@wildshard/sdk/bake/forest';
import { bakeSplatGround, splatGroundSource, splatLayerFiles } from '@wildshard/sdk/bake/splatGround';
import { parseKtx2 } from '@wildshard/sdk/assets';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import declared from '../data/publicInputs.json' with { type: 'json' };
import bindings from '../data/terrainBindings.json' with { type: 'json' };
import manifest from '../manifest.json' with { type: 'json' };
import { GPU_FILES } from '../ktx2.generated';
import { pineForestRows } from './forestRows';
import { pineGeographyRows } from './geographyRows';
import { PINE_GROUND, type PineGroundRows } from './groundTiles';
import * as LAYOUT from './layout';

/** The retained terrain's URL (its public path under `/assets/`). */
const TERRAIN_URL = `/${bindings.terrain.replace(/^public\//u, '')}`;
/** The ground's four splat layers (the manifest's `assets`, in splat channel order). */
const LAYERS = manifest.assets.groundLayers;

/** One cave opening: a box in the cave's frame (half extents in plan, a height band). */
interface Hole { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number }
/** The cave's drawn openings as the page punches them (game `terrainOpeningHits` over world/crag-cave.json's holes): a
 *  triangle is left out when its plan box in the cave's frame and its height band overlap an opening. */
function openingHits(frame: { x: number; z: number; yaw: number }, holes: readonly Hole[]) {
  const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw);
  const local = (x: number, z: number): [number, number] => { const dx = x - frame.x, dz = z - frame.z; return [dx * c - dz * s, dx * s + dz * c]; };
  return (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): boolean => {
    const [alx, alz] = local(ax, az), [blx, blz] = local(bx, bz), [clx, clz] = local(cx, cz);
    const x0 = Math.min(alx, blx, clx), x1 = Math.max(alx, blx, clx), z0 = Math.min(alz, blz, clz), z1 = Math.max(alz, blz, clz), y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
    return holes.some(h => !(x1 < h.lx - h.hw || x0 > h.lx + h.hw || z1 < h.lz - h.hd || z0 > h.lz + h.hd || y1 < h.y0 || y0 > h.y1));
  };
}
/** The cave sidecar's openings (`holes`), refusing a malformed one. */
function caveHoles(input: unknown): Hole[] {
  if (typeof input !== 'object' || input === null || !('holes' in input) || !Array.isArray(input.holes)) throw new Error('Pine cave has no openings');
  return input.holes.map((row: unknown): Hole => {
    const value = (key: keyof Hole): number => {
      const found: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, key) : undefined;
      if (typeof found !== 'number' || !Number.isFinite(found)) throw new Error(`Pine cave opening has no ${key}`);
      return found;
    };
    return { lx: value('lx'), lz: value('lz'), hw: value('hw'), hd: value('hd'), y0: value('y0'), y1: value('y1') };
  });
}

/** GR8: Pine's splat ground, as the retired bake-pine-ground.mjs made it. The 64 L0 + 16 L1 tiles are cut from the retained
 *  bake with the planted forest's canopy as a channel (`bakePlantedForest`) and the bear cave's openings left out; the four
 *  layers' KTX2 files are resolved on each tier as the runtime's texture arrays do (`splatLayerFiles` over the public layer
 *  folders, listed through `ctx.inputFiles`). Every input is read through `ctx.cached`; the rows name each tile and layer
 *  file by its bytes' hash, and `assets` carries those bytes for the product. */
export async function pineGroundTiles(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<{ rows: PineGroundRows; assets: Uint8Array[] }> {
  const listed = ctx.inputFiles?.(LAYERS.map(id => `${declared.groundLayers}${id}/`));
  if (listed === undefined) throw new Error('Pine ground needs its declared layer inventory');
  const inventory: Record<string, true> = Object.fromEntries(listed.map(url => [url, true]));
  const paths = splatLayerFiles(LAYERS, GPU_FILES, inventory);
  const urls = new Set<string>();
  for (const set of [paths.desktop, paths.phone]) for (const url of [set.colour, set.normal, set.arm].flat()) urls.add(url);
  const inputs = [TERRAIN_URL, declared.cave, ...urls];
  const files = await ctx.cached({ id: 'ground-inputs', inputs }, read => new Map(inputs.map((url, index) => {
    const bytes = read.get(url);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine ground input ${url}`);
    return [String(index), bytes];
  })));
  const file = (url: string): Uint8Array => {
    const bytes = files.get(String(inputs.indexOf(url)));
    if (bytes === undefined) throw new Error(`Missing cached Pine ground input ${url}`);
    return bytes;
  };
  const terrain = file(TERRAIN_URL), ground = pineGeographyRows().ground;
  const planted = bakePlantedForest({
    seed: manifest.seed, treeCount: manifest.treeCount, forest: manifest.forest, candidates: pineForestRows(manifest),
    ground: { seed: ground.terrain.seed, trails: ground.trails, cabinSites: ground.cabinSites, pond: ground.pond, water: ground.water },
    terrain, variants: manifest.trees.setVariants.map(row => ({ trunkRadius: row.trunk, height: row.height, species: row.species, collider: row.collider })),
  });
  const cave: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(file(declared.cave)));
  const holes = openingHits({ x: LAYOUT.BEAR_CAVE.x, z: LAYOUT.BEAR_CAVE.z, yaw: LAYOUT.BEAR_CAVE.rot }, caveHoles(cave));
  const tiles = await bakeSplatGround(splatGroundSource(terrain, planted.canopy, holes), PINE_GROUND);
  const textures = new Map<string, PineGroundRows['textures'][number]>(), assets: Uint8Array[] = [];
  const layerFile = (url: string): string => {
    const bytes = file(url), ref = hashImmutableBytes(bytes);
    if (!textures.has(ref)) { assets.push(bytes); textures.set(ref, { hash: ref, kind: 'ktx2', compressed: bytes.length, ...parseKtx2(bytes), dependencies: [], critical: false }); }
    return ref;
  };
  const roles = (set: typeof paths.desktop) => ({ colour: set.colour.map(layerFile), normal: set.normal.map(layerFile), arm: set.arm.map(layerFile) });
  const layers = roles(paths.desktop), phone = roles(paths.phone);
  const { boreal } = manifest.assets;
  const splat = { material: PINE_GROUND.material, layers, ...(JSON.stringify(phone) === JSON.stringify(layers) ? {} : { phone }),
    tints: manifest.assets.groundTints, boreal: { normalK: boreal.normalK, trailDust: boreal.trailDust } };
  // the L0 splat tiles draw with the layers; the coarse L1 tiles carry their own colours and depend on nothing
  const dependencies = [...textures.keys()];
  const rows = tiles.map(({ tile, bytes, cost, geometricError }) => {
    assets.push(bytes);
    return { lod: tile.lod, x: tile.x, z: tile.z, bounds: tile.bounds, geometricError,
      file: { hash: hashImmutableBytes(bytes), kind: 'glb', compressed: bytes.length, ...cost, dependencies: tile.lod === 0 ? dependencies : [], critical: false } };
  });
  return { rows: { splat, tiles: rows, textures: [...textures.values()] }, assets };
}
