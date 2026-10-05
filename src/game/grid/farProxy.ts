/**
 * The far view (SHARD-PLATFORM SF23): one baked low-poly proxy per shard, drawn in the render rings' bounded far ring
 * (`RenderRings`, at most `CONTENT_CAPS.farCount` proxies, charged through the one `ResidencyAllocator` as category `far`).
 * The 3 × 3 grid's longest sightline is ≈ 2.4 km, so Part A has no impostors (R3-C20; S6b adds them for larger grids).
 *
 * A proxy is the shard's baked terrain (its `terrain.bin` heights and splat) resampled onto 4 × 4 regions, one per L1
 * footprint (125 m), each a 12 × 12 quad lattice with skirts on all four sides, plus a water sheet where the ground dips
 * under the shard's water level. Every vertex carries its region (0..15, x + 4z from the cell's −x −z corner, the rings'
 * mask numbering), so the renderer hides a refined region in the same single draw (`farView.ts`). Colour comes from the
 * shard's own far look (`src/shards/<slug>/look/far.ts`): its palette by height, slope and splat, an optional canopy
 * lift (a forest reads as a dark mass above the ground, not painted on it) and its haze. Node-safe; no three.js.
 */
import { CHUNK_HALF, CONTENT_CAPS } from '@wildshard/engine/core/config';

/** Linear RGB, 0..1. */
export type FarRgb = readonly [number, number, number];
/** The material family a proxy draws with; each shard keeps its own style. */
export type FarFamily = 'toon' | 'painterly' | 'pbr';
/** Distance haze on the proxy alone (independent of a shard's near fog, which would hide its neighbours). */
export interface FarHaze { readonly colour: FarRgb; readonly near: number; readonly far: number; readonly max: number }
/**
 * A shard's far look, authored in its folder and read only at bake time. `colourAt` gets cell-local metres, the height,
 * the slope (1 − n.y) and the normalised splat weights (the shard's own four channels).
 */
export interface FarLookSource {
  readonly family: FarFamily;
  readonly colourAt: (x: number, z: number, h: number, slope: number, splat: readonly [number, number, number, number]) => FarRgb;
  /** metres of canopy above the ground (forests), 0 for open ground */
  readonly canopyAt?: (x: number, z: number, h: number, slope: number, splat: readonly [number, number, number, number]) => number;
  readonly water?: { readonly level: number; readonly colour: FarRgb };
  readonly haze: FarHaze;
  /**
   * quads per region side in its terrain lattice (default `FAR_QUADS`): a shard whose ground is one sheet (a cloud sea
   * over a void, its land all models) spends 1 and gives its triangles to its parts instead (SF49)
   */
  readonly quads?: number;
  /** its grade under the one frame while it owns the frame (SF19a / SF19b, G158) */
  readonly grade?: FarGrade;
  /** a haze band at its border under the one frame (SF19b, G94) */
  readonly band?: FarBand;
}
/**
 * A shard's declared grade under SF19a's one frame, applied to the whole frame while the player stands in its cell (G158;
 * after the camera's tone mapping; neutral when absent):
 * exposure in stops, saturation and contrast as factors, an optional linear RGB tint.
 */
export interface FarGrade { readonly exposure: number; readonly saturation: number; readonly contrast: number; readonly tint?: FarRgb | undefined }
/**
 * SF19b (G94 / G95): a shard keeps its own mood inside the one frame without a second sky, through a band of its own
 * haze rising at its border (a dusk dust haze, a border fog). `own` (0..1) was how much of its declared haze its proxy
 * kept against the camera's air under the per-pixel frame; G158 retired that (the owner's air hazes every proxy), so the
 * frame no longer reads it.
 */
export interface FarBand { readonly colour: FarRgb; readonly height: number; readonly opacity: number; readonly own: number }
/** What the runtime needs beside the proxy's mesh (stored in `far.json`). */
export interface FarLookRuntime { readonly family: FarFamily; readonly haze: FarHaze; readonly grade?: FarGrade | undefined; readonly band?: FarBand | undefined }
/** A baked grid as `terrain.bin` holds it: res² heights over size metres, 4 splat bytes per vertex. */
export interface FarGrid { readonly res: number; readonly size: number; readonly heights: Float32Array; readonly splat: Uint8Array | null }
/**
 * A baked model merged into the proxy (SF49: a shard whose land is models, not a heightfield: floating islands, a skyline):
 * cell-local metres and linear RGB per vertex, indexed. The whole part rides the region its centre stands over, so the
 * rings hide it with that region; normals come from its faces.
 */
export interface FarPart { readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array }
/** An indexed proxy mesh; `region` is per vertex. */
export interface FarProxyMesh { positions: Float32Array; normals: Float32Array; colours: Float32Array; region: Float32Array; index: Uint32Array; triangles: number }

/** Regions per side (one per L1 tile) and quads per region side. */
export const FAR_REGIONS = 4, FAR_QUADS = 12;
/** Skirt depth (m) under every region edge: hides the cracks against L1 tiles and neighbouring regions. */
export const FAR_SKIRT = 8;
/**
 * The cell's outer edge drops to this height (m) instead: a shard whose border stands high (Pine Hollow's north ridge,
 * Nalati's snow-ring berm) reads as a solid cliff down past road level from a neighbour, never as ground over a void.
 */
export const FAR_EDGE_FLOOR = -20;
/**
 * The far ring (SF23 owns its parameters; SF18b's `RenderRings` owns the scheduler). The ring keeps at most `count`
 * proxies, nearest first, for cells within `viewDistance + farPrefetch` of the camera (the rings' defaults: 1.5 pitches,
 * plus SF18d's 435 m readiness distance), so boot residency is the same for any grid larger than 3 × 3. `drawDistance`
 * is the camera far plane the proxies need: the 3 × 3 grid's corner-to-corner sightline (≈ 2.4 km) with margin.
 */
export const FAR_RING = { count: CONTENT_CAPS.farCount, viewDistance: 1.5 * CONTENT_CAPS.pitch, farPrefetch: 435, drawDistance: 2600 } as const;

/** Bilinear height / splat over the baked grid, clamped to the cell. */
function sampler(grid: FarGrid): { height: (x: number, z: number) => number; splat: (x: number, z: number) => [number, number, number, number] } {
  const { res, size, heights, splat } = grid, half = size / 2, inv = (res - 1) / size, last = res - 2;
  if (!Number.isInteger(res) || res < 2 || heights.length !== res * res || (splat !== null && splat.length !== res * res * 4)) throw new RangeError('Invalid far grid');
  const at = (x: number, z: number): { i: number; fx: number; fz: number } => {
    const ux = Math.min(res - 1, Math.max(0, (x + half) * inv)), uz = Math.min(res - 1, Math.max(0, (z + half) * inv));
    const ix = Math.min(last, Math.floor(ux)), iz = Math.min(last, Math.floor(uz));
    return { i: iz * res + ix, fx: ux - ix, fz: uz - iz };
  };
  const mix = (a: number, b: number, c: number, d: number, fx: number, fz: number): number => { const top = a + (b - a) * fx; return top + (c + (d - c) * fx - top) * fz; };
  return {
    height: (x, z) => { const { i, fx, fz } = at(x, z); return mix(heights[i] ?? 0, heights[i + 1] ?? 0, heights[i + res] ?? 0, heights[i + res + 1] ?? 0, fx, fz); },
    splat: (x, z) => {
      if (splat === null) return [1, 0, 0, 0];
      const { i, fx, fz } = at(x, z), w: [number, number, number, number] = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) w[c] = mix(splat[i * 4 + c] ?? 0, splat[(i + 1) * 4 + c] ?? 0, splat[(i + res) * 4 + c] ?? 0, splat[(i + res + 1) * 4 + c] ?? 0, fx, fz);
      const sum = w[0] + w[1] + w[2] + w[3]; return sum > 0 ? [w[0] / sum, w[1] / sum, w[2] / sum, w[3] / sum] : [1, 0, 0, 0];
    },
  };
}

/**
 * Bake one shard's proxy mesh from its grid, far look and model parts. Deterministic; refuses output over the far triangle
 * cap and a part outside the cell.
 */
export function buildFarProxy(grid: FarGrid, look: FarLookSource, parts: readonly FarPart[] = []): FarProxyMesh {
  const quads = look.quads ?? FAR_QUADS;
  if (!Number.isInteger(quads) || quads < 1) throw new RangeError('Invalid far lattice');
  const sample = sampler(grid), regionSize = (CHUNK_HALF * 2) / FAR_REGIONS, step = regionSize / quads, n = quads + 1;
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], region: number[] = [], index: number[] = [];
  const clamp = (c: number): number => Math.min(1, Math.max(0, c));
  // the surface the proxy shows: ground + canopy, its slope from the ground alone (a canopy is not a cliff)
  const ground = (x: number, z: number): { h: number; top: number; slope: number; normal: [number, number, number]; rgb: FarRgb } => {
    const h = sample.height(x, z), hx = sample.height(x + step, z) - sample.height(x - step, z), hz = sample.height(x, z + step) - sample.height(x, z - step);
    const len = Math.hypot(hx, 2 * step, hz), normal: [number, number, number] = [-hx / len, (2 * step) / len, -hz / len], slope = 1 - normal[1], splat = sample.splat(x, z);
    const canopy = Math.max(0, look.canopyAt?.(x, z, h, slope, splat) ?? 0), rgb = look.colourAt(x, z, h, slope, splat);
    if (!Number.isFinite(h) || !Number.isFinite(canopy) || rgb.some((c) => !Number.isFinite(c))) throw new RangeError('Invalid far look sample');
    return { h, top: h + canopy, slope, normal, rgb: [clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2])] };
  };
  const vertex = (x: number, y: number, z: number, normal: readonly number[], rgb: FarRgb, r: number): number => {
    positions.push(x, y, z); normals.push(normal[0] ?? 0, normal[1] ?? 1, normal[2] ?? 0); colours.push(...rgb); region.push(r);
    return region.length - 1;
  };
  for (let rz = 0; rz < FAR_REGIONS; rz++) for (let rx = 0; rx < FAR_REGIONS; rx++) {
    const r = rx + rz * FAR_REGIONS, x0 = -CHUNK_HALF + rx * regionSize, z0 = -CHUNK_HALF + rz * regionSize, base = region.length, edge: number[][] = [[], [], [], []];
    let low = Infinity;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + i * step, z = z0 + j * step, g = ground(x, z), id = vertex(x, g.top, z, g.normal, g.rgb, r); low = Math.min(low, g.h);
      if (j === 0) edge[0]?.push(id); if (i === n - 1) edge[1]?.push(id); if (j === n - 1) edge[2]?.push(id); if (i === 0) edge[3]?.push(id);
    }
    for (let j = 0; j < quads; j++) for (let i = 0; i < quads; i++) {
      const a = base + j * n + i, b = a + 1, c = a + n, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    // skirts: each edge vertex drops FAR_SKIRT (on the cell's border, to FAR_EDGE_FLOOR), darkened; wound outward (south
    // edge faces −z, east +x, north +z, west −x)
    const border = [rz === 0, rx === FAR_REGIONS - 1, rz === FAR_REGIONS - 1, rx === 0];
    const outward = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]] as const;
    edge.forEach((ids, side) => {
      const drop = (y: number): number => border[side] === true ? Math.min(y - FAR_SKIRT, FAR_EDGE_FLOOR) : y - FAR_SKIRT;
      const bottom = ids.map((id) => vertex(positions[id * 3] ?? 0, drop(positions[id * 3 + 1] ?? 0), positions[id * 3 + 2] ?? 0, outward[side] ?? [0, 1, 0], [(colours[id * 3] ?? 0) * 0.7, (colours[id * 3 + 1] ?? 0) * 0.7, (colours[id * 3 + 2] ?? 0) * 0.7], r));
      for (let k = 0; k + 1 < ids.length; k++) {
        const a = ids[k] ?? 0, b = ids[k + 1] ?? 0, c = bottom[k] ?? 0, d = bottom[k + 1] ?? 0;
        // south / east run with +x / +z along the edge, north / west too: flip the winding for the sides facing −
        if (side === 0 || side === 1) index.push(a, b, c, b, d, c); else index.push(a, c, b, b, c, d);
      }
    });
    // water: one sheet over the region where any ground lies under the water level
    if (look.water !== undefined && low < look.water.level) {
      const y = look.water.level, up = [0, 1, 0], rgb = look.water.colour;
      const a = vertex(x0, y, z0, up, rgb, r), b = vertex(x0 + regionSize, y, z0, up, rgb, r), c = vertex(x0, y, z0 + regionSize, up, rgb, r), d = vertex(x0 + regionSize, y, z0 + regionSize, up, rgb, r);
      index.push(a, c, b, b, c, d);
    }
  }
  for (const part of parts) addPart(part, regionSize, { positions, normals, colours, region, index });
  const triangles = index.length / 3;
  if (triangles > CONTENT_CAPS.far.triangles) throw new RangeError(`Far proxy has ${triangles} triangles, over the ${CONTENT_CAPS.far.triangles} cap`);
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals), colours: Float32Array.from(colours), region: Float32Array.from(region), index: Uint32Array.from(index), triangles };
}

/** Append a model part: its region from its centre, area-weighted vertex normals from its faces. */
function addPart(part: FarPart, regionSize: number, out: { positions: number[]; normals: number[]; colours: number[]; region: number[]; index: number[] }): void {
  const { positions: p, colours: c, index: idx } = part, count = p.length / 3;
  if (!Number.isInteger(count) || c.length !== p.length || idx.length % 3 !== 0) throw new RangeError('Invalid far part');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let v = 0; v < count; v++) {
    const x = p[v * 3] ?? Number.NaN, y = p[v * 3 + 1] ?? Number.NaN, z = p[v * 3 + 2] ?? Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || Math.abs(x) > CHUNK_HALF || Math.abs(z) > CHUNK_HALF) throw new RangeError('Far part outside the cell');
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const cell = (u: number): number => Math.min(FAR_REGIONS - 1, Math.max(0, Math.floor((u + CHUNK_HALF) / regionSize)));
  const r = cell((minX + maxX) / 2) + cell((minZ + maxZ) / 2) * FAR_REGIONS, normal = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] ?? 0, b = idx[t + 1] ?? 0, d = idx[t + 2] ?? 0;
    if (a >= count || b >= count || d >= count) throw new RangeError('Invalid far part index');
    const ux = (p[b * 3] ?? 0) - (p[a * 3] ?? 0), uy = (p[b * 3 + 1] ?? 0) - (p[a * 3 + 1] ?? 0), uz = (p[b * 3 + 2] ?? 0) - (p[a * 3 + 2] ?? 0);
    const vx = (p[d * 3] ?? 0) - (p[a * 3] ?? 0), vy = (p[d * 3 + 1] ?? 0) - (p[a * 3 + 1] ?? 0), vz = (p[d * 3 + 2] ?? 0) - (p[a * 3 + 2] ?? 0);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, d]) { normal[i * 3] = (normal[i * 3] ?? 0) + nx; normal[i * 3 + 1] = (normal[i * 3 + 1] ?? 0) + ny; normal[i * 3 + 2] = (normal[i * 3 + 2] ?? 0) + nz; }
  }
  const base = out.region.length;
  for (let v = 0; v < count; v++) {
    const nx = normal[v * 3] ?? 0, ny = normal[v * 3 + 1] ?? 0, nz = normal[v * 3 + 2] ?? 0, len = Math.hypot(nx, ny, nz);
    out.positions.push(p[v * 3] ?? 0, p[v * 3 + 1] ?? 0, p[v * 3 + 2] ?? 0);
    if (len > 0) out.normals.push(nx / len, ny / len, nz / len); else out.normals.push(0, 1, 0);
    out.colours.push(Math.min(1, Math.max(0, c[v * 3] ?? 0)), Math.min(1, Math.max(0, c[v * 3 + 1] ?? 0)), Math.min(1, Math.max(0, c[v * 3 + 2] ?? 0)));
    out.region.push(r);
  }
  for (const i of idx) out.index.push(base + i);
}

/** The far level of a ring catalogue: an instance's proxy resident bytes (decoded + GPU), null when it has none. */
export function farRingCatalogue(resident: ReadonlyMap<string, number>): (instance: string, level: 'far' | 'l1' | 'l0') => number | null {
  return (instance, level) => level === 'far' ? resident.get(instance) ?? null : null;
}
