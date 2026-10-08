/**
 * The minimap at the road boundary (SHARD-PLATFORM SF28, Jake's G107 "A terrain faded, but only on the road") and the grid's
 * full map (SF66). It feeds the engine minimap's data-only overlay (`Minimap.setExtras`) in the home frame's metres:
 *
 * - **inside a shard's cell**: that shard (the home's own minimap ground, or a neighbour's baked map at full strength), the
 *   road network, and each neighbour's NAME across the road once that road is near (no neighbour terrain);
 * - **on the road / no-man's land**: every cell in view as faded terrain (~50 %) on both sides, so a roundabout shows all four.
 *
 * The full map (`FullMap.setExtras`) lays out every cell's baked map at its cell, the road network and each shard's name.
 * Each cell's ground is its shard's map baked from the world (SF66, `ShardManifest.minimap.image`): the home's at full size
 * as the minimap's own ground, each other shard's decoded once, downscaled to CELL_PX and shared by its copies; they go
 * with the grid's scope.
 */
import type { MapExtras, MapExtraImage, MapExtraLabel, MapExtraRect } from '@wildshard/engine/ui/Minimap';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { GridAssembly, GridCell, GridSide } from './assembly';
import type { GridCellEvents } from './boot';
import { GAP_HALF, RAIL_OFFSET, ROAD_HALF } from './roadLayout';

/** On the road the neighbours' terrain shows at this opacity (G107: "faded ~50 %"). */
export const ROAD_TERRAIN_ALPHA = 0.5;
/** A neighbour's name shows once the road to it is this close (m from the feet to the road's centre line). */
const NAME_RANGE = 140;
/** A neighbour's baked map is kept at this many px a side (0.8 px per metre, 0.64 MB): the minimap shows it ~110 m across */
export const CELL_PX = 400;
const STRIP = '#3b4038', ROAD = '#2a2e35', LINE = '#c9a640', VOID = '#0b1016', NAME = '#eaf6ff';

/** Each shard's baked map, loaded the first time a cell of it is drawn, downscaled once and shared by its copies. */
export class CellMinimaps {
  private readonly maps = new Map<string, { image: HTMLCanvasElement | null }>();
  private disposed = false;
  constructor(scope: Scope, private readonly url: (slug: string) => string | undefined) {
    scope.onDispose(() => { this.disposed = true; for (const m of this.maps.values()) if (m.image !== null) m.image.width = m.image.height = 0; this.maps.clear(); });
  }
  /** the shard's map, or null while it loads (or when it names none) */
  image(slug: string): HTMLCanvasElement | null {
    const hit = this.maps.get(slug);
    if (hit !== undefined) return hit.image;
    const entry: { image: HTMLCanvasElement | null } = { image: null };
    this.maps.set(slug, entry);
    const url = this.url(slug);
    if (url !== undefined && typeof document !== 'undefined') void this.load(url, entry);
    return null;
  }
  /** bytes held now (RGBA), for the memory readouts */
  get bytes(): number { let n = 0; for (const m of this.maps.values()) if (m.image !== null) n += m.image.width * m.image.height * 4; return n; }
  private async load(url: string, entry: { image: HTMLCanvasElement | null }): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const full = await createImageBitmap(await res.blob());
      try {
        if (this.disposed) return;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = CELL_PX;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(full, 0, 0, CELL_PX, CELL_PX);
        entry.image = canvas;
      } finally { full.close(); }
    } catch (error) { if (!this.disposed) console.warn(`[grid] the baked map ${url} did not load:`, error); }
  }
}

/** The road network as overlay rectangles in the home frame: the strips' ground over the grid's box, each road band and its centre line. */
export function roadRects(assembly: GridAssembly, home: GridCell): MapExtraRect[] {
  const xs = assembly.cells.map((c) => c.cell[0]), zs = assembly.cells.map((c) => c.cell[1]), p = assembly.pitch;
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const x0 = minX * p - p / 2 - RAIL_OFFSET, x1 = maxX * p + p / 2 + RAIL_OFFSET, z0 = minZ * p - p / 2 - RAIL_OFFSET, z1 = maxZ * p + p / 2 + RAIL_OFFSET;
  const ox = home.origin.x, oz = home.origin.z, cx = (x0 + x1) / 2 - ox, cz = (z0 + z1) / 2 - oz, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const out: MapExtraRect[] = [{ x: cx, z: cz, hx, hz, color: STRIP }];
  for (let i = minX - 1; i <= maxX; i++) out.push({ x: (i + 0.5) * p - ox, z: cz, hx: ROAD_HALF, hz: hz - (RAIL_OFFSET - ROAD_HALF), color: ROAD });
  for (let j = minZ - 1; j <= maxZ; j++) out.push({ x: cx, z: (j + 0.5) * p - oz, hx: hx - (RAIL_OFFSET - ROAD_HALF), hz: ROAD_HALF, color: ROAD });
  for (let i = minX - 1; i <= maxX; i++) out.push({ x: (i + 0.5) * p - ox, z: cz, hx: 0.35, hz: hz - RAIL_OFFSET, color: LINE });
  for (let j = minZ - 1; j <= maxZ; j++) out.push({ x: cx, z: (j + 0.5) * p - oz, hx: hx - RAIL_OFFSET, hz: 0.35, color: LINE });
  return out;
}

const SIDES: readonly { side: GridSide; dx: number; dz: number }[] = [{ side: 'north', dx: 0, dz: 1 }, { side: 'south', dx: 0, dz: -1 }, { side: 'east', dx: 1, dz: 0 }, { side: 'west', dx: -1, dz: 0 }];

/** What the blend reads: the grid, the cell events, the feet (grid metres), each cell's map (null for the home: the minimap's
 *  own ground) and its shard name. */
export interface MinimapBlendHost {
  readonly assembly: GridAssembly; readonly home: GridCell; readonly cells: GridCellEvents;
  readonly worldFeet: () => { readonly x: number; readonly z: number };
  readonly image: (instance: string) => CanvasImageSource | null;
  readonly name: (cell: GridCell) => string;
}
/** The overlay for the feet now (pure but for the rasters; the home frame's metres). */
export function minimapOverlay(host: MinimapBlendHost, rects: readonly MapExtraRect[]): MapExtras {
  const { assembly, home } = host, feet = host.worldFeet(), ox = home.origin.x, oz = home.origin.z;
  const inside = host.cells.cell === null ? undefined : assembly.at(feet.x, feet.z);
  const homeImage = host.image(home.instance);
  const images: MapExtraImage[] = [], labels: MapExtraLabel[] = [];
  if (inside === undefined) {
    // G107 on the road: every cell in view faded, the home's own layer too
    for (const cell of assembly.cells) {
      if (cell.instance === home.instance && homeImage === null) continue;
      const image = host.image(cell.instance);
      if (image !== null) images.push({ image, x: cell.origin.x - ox, z: cell.origin.z - oz, size: 2 * CHUNK_HALF, alpha: ROAD_TERRAIN_ALPHA });
    }
    return { outside: VOID, baseAlpha: homeImage === null ? ROAD_TERRAIN_ALPHA : 0, rects, images, labels };
  }
  // inside a cell: that shard at full strength, the road, the neighbours' names across it
  if (inside.instance !== home.instance || homeImage !== null) {
    const image = host.image(inside.instance);
    if (image !== null) images.push({ image, x: inside.origin.x - ox, z: inside.origin.z - oz, size: 2 * CHUNK_HALF, alpha: 1 });
  }
  const lx = feet.x - inside.origin.x, lz = feet.z - inside.origin.z, edgeToRoad = CHUNK_HALF + GAP_HALF;
  for (const { side, dx, dz } of SIDES) {
    const next = assembly.neighbour(inside, side);
    if (!('instance' in next)) continue;
    const toRoad = dx !== 0 ? edgeToRoad - dx * lx : edgeToRoad - dz * lz;
    if (toRoad > NAME_RANGE) continue;
    const along = Math.max(-CHUNK_HALF + 40, Math.min(CHUNK_HALF - 40, dx !== 0 ? lz : lx)), across = edgeToRoad + GAP_HALF + 30;
    labels.push({ x: inside.origin.x - ox + (dx !== 0 ? dx * across : along), z: inside.origin.z - oz + (dz !== 0 ? dz * across : along), text: host.name(next), color: NAME });
  }
  return { outside: VOID, baseAlpha: inside.instance === home.instance && homeImage === null ? 1 : 0, rects, images, labels };
}

/** The grid's full map (SF66): every cell's baked map at its cell, the road network, each shard's name near its cell's north
 *  edge; the home's own ground is the map's base layer. Home-frame metres. */
export function fullMapOverlay(host: MinimapBlendHost, rects: readonly MapExtraRect[]): MapExtras {
  const { assembly, home } = host, ox = home.origin.x, oz = home.origin.z, homeImage = host.image(home.instance);
  const images: MapExtraImage[] = [], labels: MapExtraLabel[] = [];
  for (const cell of assembly.cells) {
    const x = cell.origin.x - ox, z = cell.origin.z - oz;
    labels.push({ x, z: z + CHUNK_HALF - 28, text: host.name(cell), color: NAME });
    if (cell.instance === home.instance && homeImage === null) continue;
    const image = host.image(cell.instance);
    if (image !== null) images.push({ image, x, z, size: 2 * CHUNK_HALF, alpha: 1 });
  }
  return { outside: VOID, baseAlpha: homeImage === null ? 1 : 0, rects, images, labels };
}

interface ExtrasSink { setExtras: (source: (() => MapExtras | null) | null) => void }
/** Feed the page's minimap (and its full map) while the grid runs; the overlays leave with the scope. */
export function installMinimapBlend(minimap: ExtrasSink, host: MinimapBlendHost, scope: Scope, fullMap?: ExtrasSink): () => MapExtras {
  const rects = roadRects(host.assembly, host.home);
  let last: MapExtras = { rects, images: [], labels: [] };
  minimap.setExtras(() => { last = minimapOverlay(host, rects); return last; });
  fullMap?.setExtras(() => fullMapOverlay(host, rects));
  scope.onDispose(() => { minimap.setExtras(null); fullMap?.setExtras(null); });
  return () => last;
}
