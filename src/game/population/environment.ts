import * as v from 'valibot';
import { PopulationEnvironmentSchema, type PopulationEnvironmentRows } from '@wildshard/format/populationEnvironment';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';
import { terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import type { HuntGround, HuntTree } from '@wildshard/engine/ai/hunt';
import { TreeGrid } from '@wildshard/engine/world/forest/placement';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import type { SimHost } from '@wildshard/engine/sim';

/** Wander observations are published by the built-in shelter before roster decisions. */
export interface NativePopulationEnvironment extends HuntGround { readonly wanderGoals: ({ x: number; z: number; r: number } | null)[] }
const installed = new WeakMap<SimHost, Map<string, NativePopulationEnvironment>>();
/** Resolve an immutable native habitat installed on this host. Missing ids refuse. */
export function populationEnvironment(host: SimHost, id: string): NativePopulationEnvironment {
  const ground = installed.get(host)?.get(id);
  if (ground === undefined) throw new Error(`Missing native population environment: ${id}`);
  return ground;
}

type Stream = NonNullable<PopulationEnvironmentRows['stream']>;
function surface(stream: Stream, x: number, z: number): number | null {
  let distance = Infinity, along = 0;
  for (const row of stream.lines) {
    const t = row.l2 > 0 ? Math.min(1, Math.max(0, ((x-row.x)*row.vx+(z-row.z)*row.vz)/row.l2)) : 0;
    const d = Math.hypot(x-row.x-row.vx*t,z-row.z-row.vz*t);
    if (d < distance) { distance = d; along = row.arc+t*row.length; }
  }
  if (distance > stream.halfWidth) return null;
  const values = stream.bands.find(row => row.inclusive ? along <= row.until : along < row.until)?.values ?? stream.last;
  let result = -Infinity;
  for (const value of values) {
    const row = value.profile.pieces.find(piece => along <= piece.until)?.line ?? value.profile.last;
    result = Math.max(result, row.from+(row.to-row.from)*((along-row.start-row.offset)/row.span)+value.add);
  }
  return result;
}

/** Install exact ground, ordered trunk and projected-water observations from data.
 * No terrain, weather, actor or shard callback crosses this boundary. Both triangle
 * and bilinear profiles use the existing native lattice samplers, without a copy. */
export function installPopulationEnvironment(host: SimHost, grid: Pick<BakedGrid, 'res' | 'size' | 'heights'>, input: unknown): void {
  const rows = v.parse(PopulationEnvironmentSchema, input);
  if (!Number.isInteger(grid.res) || grid.res < 2 || grid.res > 1024 || grid.heights.length !== grid.res*grid.res || grid.size !== rows.chunkHalf*2)
    throw new Error('Invalid native population environment lattice');
  const services = installed.get(host) ?? new Map<string, NativePopulationEnvironment>();
  if (services.has(rows.id)) throw new Error('Duplicate native population environment');
  const tile = { resolution: grid.res, size: grid.size, x: -grid.size/2, z: -grid.size/2, heights: grid.heights };
  const heightAt = rows.sampling === 'column-triangles'
    ? (x: number, z: number): number => terrainTileHeight(tile, x, z, { layout: 'column-major', boundary: 'clamp' })
    : bakedSamplers({ ...grid, seed: rows.seed, landscapeHash: 0, splat: new Uint8Array(0), undergrowth: null }).heightAt;
  const stream = rows.stream;
  const field = buildTerrainMetadata(rows.seed, { trails: rows.trails ?? [], cabinSites: rows.cabins.map(row => ({ ...row, rot: 0 })),
    ...(rows.pond === null ? {} : { pond: rows.pond }), ...(stream === null ? {} : { streamAt: (x, z) => surface(stream, x, z) }) }, () => rows.water);
  const trees = new TreeGrid<HuntTree>();
  for (const [x, z, r] of rows.trees) trees.add({ x, z, r });
  const epsilon = rows.normalEpsilon;
  const ground: NativePopulationEnvironment = {
    wanderGoals: [],
    heightAt, normalY: (x, z) => {
      const nx = heightAt(x-epsilon,z)-heightAt(x+epsilon,z), nz = heightAt(x,z-epsilon)-heightAt(x,z+epsilon);
      return 2*epsilon/Math.hypot(nx,2*epsilon,nz);
    },
    trailDistance: rows.trails === null ? () => { throw new Error('Native population environment has no trails'); } : field.trailDistance,
    cabinMask: field.cabinMask, inChunk: (x, z, margin) => Math.abs(x) <= rows.chunkHalf-margin && Math.abs(z) <= rows.chunkHalf-margin,
    streamAt: (x, z) => stream === null ? null : surface(stream,x,z), waterLevel: () => rows.water, pond: () => rows.pond,
    sea: () => rows.sea, wetAt: () => false, trees: (x,z,r) => trees.nearby(x,z,r), treeless: () => rows.trees.length === 0,
    terrain: () => true, chunkHalf: rows.chunkHalf,
  };
  services.set(rows.id, ground); installed.set(host, services);
  host.scope.onDispose(() => { services.delete(rows.id); });
}
