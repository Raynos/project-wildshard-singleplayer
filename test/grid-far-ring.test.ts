// SHARD-PLATFORM SF23: the far view. Every grid shard's baked far proxy is inside the §3.2 far caps and draws its 16
// regions in one draw; the far ring is bounded, so boot residency at the centre of a 3 × 3 and a 5 × 5 synthetic
// catalogue is equal, every shard of the 3 × 3 shows its proxy from every cell, and a drive across a 5 × 5 never holds
// more than FAR_RING.count proxies.
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the committed baked far proxies.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Baked artifact paths are repo-relative.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_CAPS as C } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { buildFarProxy, FAR_QUADS, FAR_REGIONS, FAR_RING, farRingCatalogue, type FarLookSource } from '../src/game/grid/farProxy';
import { RenderRings, type RingCell, type RingLevel, type RingView } from '../src/game/grid/rings';

const SHARDS = ['_template', 'driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'sunscar-dunes', 'far-reach'] as const;
interface FarJson { far: { files: string[]; decoded: number; gpu: number; compressed: number; triangles: number; draws: number }; file: { hash: string; compressed: number }; look: { family: string } }
const manifest = (slug: string): FarJson => JSON.parse(readFileSync(join('public/assets/baked', slug, 'far.json'), 'utf8')) as FarJson;

/** A GLB's JSON chunk and binary chunk. */
function glb(bytes: Buffer): { json: { meshes: { primitives: { attributes: Record<string, number> }[] }[]; accessors: { bufferView: number; count: number }[]; bufferViews: { byteOffset: number; byteLength: number }[] }; bin: Buffer } {
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as ReturnType<typeof glb>['json'];
  return { json, bin: bytes.subarray(28 + jsonLength) };
}

describe('SF23 far proxies', () => {
  it.each([...SHARDS, 'nine-dragon-stack'])('%s: baked, inside the far caps, one draw, all 16 regions', (slug) => {
    const { far, file } = manifest(slug), bytes = readFileSync(join('public/assets/baked', slug, 'far.glb'));
    expect(far.files).toEqual([file.hash]);
    expect(bytes.length).toBe(file.compressed);
    expect(far.decoded + far.gpu).toBeLessThanOrEqual(C.far.resident);
    expect(far.compressed).toBeLessThanOrEqual(C.far.compressed);
    expect(far.triangles).toBeLessThanOrEqual(C.far.triangles);
    expect(far.draws).toBe(1);
    const { json, bin } = glb(bytes), primitive = json.meshes[0]?.primitives[0], uv = primitive?.attributes['TEXCOORD_0'];
    expect(json.meshes.length).toBe(1);
    const accessor = uv === undefined ? undefined : json.accessors[uv], view = accessor === undefined ? undefined : json.bufferViews[accessor.bufferView];
    if (accessor === undefined || view === undefined) throw new Error('far proxy has no region channel');
    const regions = new Set<number>();
    for (let i = 0; i < accessor.count; i++) regions.add(bin.readFloatLE(view.byteOffset + i * 8));
    expect([...regions].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, r) => r));
  });

  it('keeps each region inside its L1 footprint, skirted', () => {
    const look: FarLookSource = { family: 'toon', colourAt: () => [0.5, 0.5, 0.5], haze: { colour: [1, 1, 1], near: 1, far: 2, max: 0.5 } };
    const res = 33, mesh = buildFarProxy({ res, size: 500, heights: new Float32Array(res * res).fill(4), splat: null }, look);
    const size = 500 / FAR_REGIONS;
    for (let v = 0; v < mesh.region.length; v++) {
      const r = mesh.region[v] ?? -1, x = mesh.positions[v * 3] ?? Number.NaN, z = mesh.positions[v * 3 + 2] ?? Number.NaN;
      expect(x).toBeGreaterThanOrEqual(-250 + (r % 4) * size - 1e-6); expect(x).toBeLessThanOrEqual(-250 + (r % 4 + 1) * size + 1e-6);
      expect(z).toBeGreaterThanOrEqual(-250 + Math.floor(r / 4) * size - 1e-6); expect(z).toBeLessThanOrEqual(-250 + (Math.floor(r / 4) + 1) * size + 1e-6);
    }
    expect(mesh.triangles).toBe(16 * (FAR_QUADS * FAR_QUADS * 2 + 4 * FAR_QUADS * 2));
    expect(Math.min(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeLessThan(4);
  });

  it('SF49: merges model parts into the one mesh, each riding the region under its centre', () => {
    const look: FarLookSource = { family: 'toon', quads: 1, colourAt: () => [0.5, 0.5, 0.5], haze: { colour: [1, 1, 1], near: 1, far: 2, max: 0.5 } };
    const grid = { res: 2, size: 500, heights: new Float32Array(4).fill(-40), splat: null };
    // a floating triangle over region (2, 1) = 6, straddling into region 7 at one corner
    const part = { positions: Float32Array.from([10, 30, -100, 140, 32, -100, 20, 40, -60]), colours: new Float32Array(9).fill(0.4), index: Uint32Array.from([0, 2, 1]) }; // counter-clockwise from above: faces up
    const mesh = buildFarProxy(grid, look, [part]);
    expect(mesh.triangles).toBe(16 * (2 + 4 * 2) + 1);
    expect(Array.from(mesh.region.slice(-3))).toEqual([6, 6, 6]);
    expect(mesh.normals[mesh.normals.length - 2]).toBeGreaterThan(0.9);
    expect(() => buildFarProxy(grid, look, [{ ...part, positions: Float32Array.from([10, 30, -100, 260, 32, -100, 20, 40, -60]) }])).toThrow(/outside the cell/u);
  });
});

/** Rings over an n × n synthetic catalogue: the grid's six far proxies cycled over the cells, tiles at the caps. */
function rings(n: number): { rings: RenderRings<number>; allocator: ResidencyAllocator } {
  const half = (n - 1) / 2, cells: RingCell[] = [], far = new Map<string, number>();
  for (let z = -half; z <= half; z++) for (let x = -half; x <= half; x++) {
    // the shard at a cell depends only on the cell, so the inner 3 × 3 is the same in every catalogue
    const instance = `c${x}:${z}`, slug = SHARDS[(((x % 3) + 3) % 3 + (((z % 3) + 3) % 3) * 3) % SHARDS.length] ?? '_template', { far: row } = manifest(slug);
    cells.push({ instance, origin: { x: x * C.pitch, z: z * C.pitch } }); far.set(instance, row.decoded + row.gpu);
  }
  const farBytes = farRingCatalogue(far), tile = { l1: C.l1.resident, l0: C.l0.resident } as const;
  const catalogue = (instance: string, level: RingLevel): number | null => level === 'far' ? farBytes(instance, level) : tile[level];
  const view = (): RingView => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined });
  const allocator = new ResidencyAllocator();
  return { allocator, rings: new RenderRings<number>(cells, allocator, catalogue, { fetch: (_tile, done) => { done(1); }, upload: view }, { farCount: FAR_RING.count, viewDistance: FAR_RING.viewDistance, farPrefetch: FAR_RING.farPrefetch, residentCaps: { far: FAR_RING.count } }) };
}
function settle(r: RenderRings<number>, x: number, z: number, frames = 400): void { for (let f = 0; f < frames; f++) r.step({ x, z, vx: 0, vz: 0 }); }
const farKeys = (r: RenderRings<number>): string[] => r.resident().filter((k) => k.endsWith(':far'));

describe('SF23 far ring', () => {
  it('boot residency does not grow with the grid: 3 × 3 and 5 × 5 hold the same', () => {
    const small = rings(3), large = rings(5);
    settle(small.rings, 0, 0); settle(large.rings, 0, 0);
    expect(small.rings.ready()).toBe(true); expect(large.rings.ready()).toBe(true);
    expect(large.rings.stats().resident).toEqual(small.rings.stats().resident);
    expect(farKeys(large.rings)).toHaveLength(FAR_RING.count);
    expect(large.allocator.cost().input.far).toBe(small.allocator.cost().input.far);
    expect(large.allocator.cost().playing).toBe(small.allocator.cost().playing);
    expect(large.allocator.cost().playing).toBeLessThanOrEqual(C.playing);
  });

  it('every shard of the 3 × 3 shows its proxy from every cell', () => {
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
      const { rings: r } = rings(3); settle(r, x * C.pitch, z * C.pitch);
      expect(farKeys(r)).toHaveLength(9);
    }
  });

  it('a drive across the 5 × 5 never holds more than FAR_RING.count proxies', () => {
    const { rings: r, allocator } = rings(5); let most = 0;
    for (let s = 0; s <= 1500; s++) {
      const t = s / 1500, x = -2 * C.pitch + t * 4 * C.pitch, z = -2 * C.pitch + t * 4 * C.pitch;
      r.step({ x, z, vx: 30, vz: 30 }); most = Math.max(most, r.stats().resident.far);
      expect(allocator.cost().playing).toBeLessThanOrEqual(C.playing);
    }
    expect(most).toBeLessThanOrEqual(FAR_RING.count);
  });
});
