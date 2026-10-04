/**
 * The minimap at the road boundary (SHARD-PLATFORM SF28, Jake's G107 "A terrain faded, but only on the road"; G84: there
 * is no grid map, MAP / BAG / the menu stay the shard's own). It feeds the engine minimap's data-only overlay
 * (`Minimap.setExtras`) in the home frame's metres:
 *
 * - **inside a shard's cell**: that shard (the home's own minimap layer, or a neighbour's top-down raster at full strength),
 *   the road network, and each neighbour's NAME across the road once that road is near (no neighbour terrain);
 * - **on the road / no-man's land**: every cell in view as faded terrain (~50 %) on both sides, so a roundabout shows all four.
 *
 * A neighbour's raster is its baked far proxy (`public/assets/baked/<slug>/far.glb`, the shard's own far look over its
 * baked heightfield) drawn top-down once when the far ring loads it (`farMapImage`), about 0.8 px per metre.
 */
import type { BufferGeometry } from 'three';
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
const RASTER_PX = 400;
const STRIP = '#3b4038', ROAD = '#2a2e35', LINE = '#c9a640', VOID = '#0b1016', NAME = '#eaf6ff';

const toSrgb = (c: number): number => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

/**
 * A far proxy's top-down raster (the minimap's orientation: top = +Z, left = +X), each triangle in its vertex colours with
 * a light hillshade, lowest first so the water sheet lies over the ground it covers. Null without a 2D context.
 */
export function farMapImage(geometry: BufferGeometry): HTMLCanvasElement | null {
  const position = geometry.getAttribute('position'), colour = geometry.getAttribute('color'), index = geometry.getIndex();
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = RASTER_PX;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;
  const ppm = RASTER_PX / (2 * CHUNK_HALF), count = index === null ? position.count : index.count;
  const tris: { y: number; i: readonly [number, number, number] }[] = [];
  const at = (k: number): number => (index === null ? k : index.getX(k));
  for (let t = 0; t + 2 < count; t += 3) {
    const a = at(t), b = at(t + 1), c = at(t + 2);
    tris.push({ y: (position.getY(a) + position.getY(b) + position.getY(c)) / 3, i: [a, b, c] });
  }
  tris.sort((p, q) => p.y - q.y);
  for (const { i: [a, b, c] } of tris) {
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a), bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    // the face normal's light: a sun from the north-west, high; vertical skirts come out dark and thin
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const shade = 0.72 + 0.34 * Math.max(0, nx * 0.45 + ny * 0.8 + nz * 0.4);
    const r = toSrgb(Math.min(1, ((colour.getX(a) + colour.getX(b) + colour.getX(c)) / 3) * shade));
    const g = toSrgb(Math.min(1, ((colour.getY(a) + colour.getY(b) + colour.getY(c)) / 3) * shade));
    const bl = toSrgb(Math.min(1, ((colour.getZ(a) + colour.getZ(b) + colour.getZ(c)) / 3) * shade));
    const fill = `rgb(${r},${g},${bl})`;
    ctx.beginPath();
    ctx.moveTo((CHUNK_HALF - ax) * ppm, (CHUNK_HALF - az) * ppm); ctx.lineTo((CHUNK_HALF - bx) * ppm, (CHUNK_HALF - bz) * ppm); ctx.lineTo((CHUNK_HALF - cx) * ppm, (CHUNK_HALF - cz) * ppm);
    ctx.closePath(); ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
  }
  return canvas;
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

/** What the blend reads: the grid, the cell events, the feet (grid metres), each cell's raster and its shard name. */
export interface MinimapBlendHost {
  readonly assembly: GridAssembly; readonly home: GridCell; readonly cells: GridCellEvents;
  readonly worldFeet: () => { readonly x: number; readonly z: number };
  readonly image: (instance: string) => HTMLCanvasElement | null;
  readonly name: (cell: GridCell) => string;
}
/** The overlay for the feet now (pure but for the rasters; the home frame's metres). */
export function minimapOverlay(host: MinimapBlendHost, rects: readonly MapExtraRect[]): MapExtras {
  const { assembly, home } = host, feet = host.worldFeet(), ox = home.origin.x, oz = home.origin.z;
  const inside = host.cells.cell === null ? undefined : assembly.at(feet.x, feet.z);
  const images: MapExtraImage[] = [], labels: MapExtraLabel[] = [];
  if (inside === undefined) {
    // G107 on the road: every cell in view faded, the home's own layer too
    for (const cell of assembly.cells) {
      if (cell.instance === home.instance) continue;
      const image = host.image(cell.instance);
      if (image !== null) images.push({ image, x: cell.origin.x - ox, z: cell.origin.z - oz, size: 2 * CHUNK_HALF, alpha: ROAD_TERRAIN_ALPHA });
    }
    return { outside: VOID, baseAlpha: ROAD_TERRAIN_ALPHA, rects, images, labels };
  }
  // inside a cell: that shard at full strength, the road, the neighbours' names across it
  if (inside.instance !== home.instance) {
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
  return { outside: VOID, baseAlpha: inside.instance === home.instance ? 1 : 0, rects, images, labels };
}

/** Feed the page's minimap while the grid runs; the overlay leaves with the scope. */
export function installMinimapBlend(minimap: { setExtras: (source: (() => MapExtras | null) | null) => void }, host: MinimapBlendHost, scope: Scope): () => MapExtras {
  const rects = roadRects(host.assembly, host.home);
  let last: MapExtras = { rects, images: [], labels: [] };
  minimap.setExtras(() => { last = minimapOverlay(host, rects); return last; });
  scope.onDispose(() => { minimap.setExtras(null); });
  return () => last;
}
