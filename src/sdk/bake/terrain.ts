import { CELL_ABOVE, CELL_BELOW, CONTENT_CAPS } from '@wildshard/engine/core/config';
import { encodeTerrainTile, terrainTileCost, terrainTileHeight, type TerrainTileData } from '@wildshard/engine/world/terrainTileData';
import { TerrainSchema, validateTerrainAssets, type ShardTerrain } from '@wildshard/game/shardfile/terrain';
import type { Shardfile } from '@wildshard/game/shardfile/schema';
import * as v from 'valibot';
import { contentHash } from '../project';

/** An ordered build-time patch, blended across a circular footprint; it changes rendering and collision together. */
export interface TerrainOverride { x: number; z: number; radius: number; height: number; mode: 'replace' | 'lower' | 'raise' }
/** Trusted generator inputs. These closures run only while baking and never enter shard.json or the client. */
export interface TerrainBakeSource {
  heightAt: (x: number, z: number) => number;
  colourAt: (x: number, z: number, height: number) => readonly [number, number, number];
  overrides?: readonly TerrainOverride[]; family?: string;
}
/** Immutable wire files plus the ordinary shardfile rows and a validated terrain section. */
export interface BakedTerrain {
  terrain: ShardTerrain; tiles: Shardfile['tiles']; files: Shardfile['files']; edge: Shardfile['edge'];
  critical: string[]; assets: Map<string, Uint8Array>;
}

/** Bake a shared 257² lattice into 64 L0 and 16 L1 tiles, with an independent whole-sim collision file. */
export function bakeTerrain(source: TerrainBakeSource): BakedTerrain {
  for (const patch of source.overrides ?? []) if (![patch.x, patch.z, patch.radius, patch.height].every(Number.isFinite) || patch.radius <= 0 || patch.x < -250 || patch.x > 250 || patch.z < -250 || patch.z > 250 || patch.height < -CELL_BELOW || patch.height > CELL_ABOVE || !['replace', 'lower', 'raise'].includes(patch.mode)) throw new Error('Invalid terrain override');
  const heights = new Float32Array(257 ** 2), colours = new Float32Array(257 ** 2 * 3);
  for (let z = 0; z < 257; z++) for (let x = 0; x < 257; x++) {
    const px = -250 + x * 500 / 256, pz = -250 + z * 500 / 256;
    let h = source.heightAt(px, pz);
    if (!Number.isFinite(h) || h < -CELL_BELOW || h > CELL_ABOVE) throw new Error('Invalid terrain generator height');
    for (const patch of source.overrides ?? []) {
      const t = Math.max(0, 1 - Math.hypot(px - patch.x, pz - patch.z) / patch.radius), weight = t * t * (3 - 2 * t);
      const target = patch.mode === 'lower' ? Math.min(h, patch.height) : patch.mode === 'raise' ? Math.max(h, patch.height) : patch.height;
      h += (target - h) * weight;
    }
    const i = z * 257 + x; heights[i] = h;
    const rgb = [...source.colourAt(px, pz, heights[i] ?? 0)];
    if (rgb.length !== 3 || rgb.some((c) => !Number.isFinite(c) || c < 0 || c > 1)) throw new Error('Invalid terrain generator colour');
    colours.set(rgb, i * 3);
  }
  const grid: TerrainTileData = { resolution: 257, x: -250, z: -250, size: 500, heights };
  const assets = new Map<string, Uint8Array>(), files: Shardfile['files'] = [];
  const store = (data: TerrainTileData, critical: boolean): string => {
    const bytes = encodeTerrainTile(data), hash = contentHash(bytes);
    if (!assets.has(hash)) { assets.set(hash, bytes); files.push({ hash, kind: 'binary', compressed: bytes.length, ...terrainTileCost(data), dependencies: [], critical }); }
    return hash;
  };
  const collider = store(grid, true), tiles: Shardfile['tiles'] = [], entries: ShardTerrain['tiles'] = [];
  for (const lod of [0, 1] as const) {
    const size = lod === 0 ? 62.5 : 125, resolution = lod === 0 ? 33 : 17, count = 500 / size, stride = lod === 0 ? 1 : 4;
    for (let tz = 0; tz < count; tz++) for (let tx = 0; tx < count; tx++) {
      const tileHeights = new Float32Array(resolution ** 2), tileColours = new Float32Array(resolution ** 2 * 3);
      for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
        const gx = tx * size / (500 / 256) + x * stride, gz = tz * size / (500 / 256) + z * stride, i = z * resolution + x, g = gz * 257 + gx;
        tileHeights[i] = heights[g] ?? 0; tileColours.set(colours.subarray(g * 3, g * 3 + 3), i * 3);
      }
      const tile: TerrainTileData = { resolution, x: -250 + tx * size, z: -250 + tz * size, size, heights: tileHeights, colours: tileColours };
      let geometricError = 0;
      for (let z = 0; z <= size / (500 / 256); z++) for (let x = 0; x <= size / (500 / 256); x++) {
        const px = tile.x + x * 500 / 256, pz = tile.z + z * 500 / 256;
        geometricError = Math.max(geometricError, Math.abs(terrainTileHeight(tile, px, pz) - terrainTileHeight(grid, px, pz)));
      }
      const file = store(tile, false), cost = terrainTileCost(tile), cap = lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
      const min = Math.min(...tileHeights), max = Math.max(...tileHeights), compressed = assets.get(file)?.length ?? 0;
      if (cost.decoded + cost.gpu > cap.resident || compressed > cap.compressed || cost.triangles > cap.triangles || cost.draws > cap.draws) throw new Error('Terrain tile exceeds content caps');
      tiles.push({ lod, x: tx, z: tz, bounds: { min: [tile.x, min, tile.z], max: [tile.x + size, max, tile.z + size] }, geometricError, files: [file], compressed, ...cost });
      entries.push({ lod, x: tx, z: tz, file });
    }
  }
  const edgeAt = (side: 'north' | 'east' | 'south' | 'west'): Shardfile['edge']['north'] => {
    const samples: number[] = [], rgb: [number, number, number][] = [];
    for (let i = 0; i < 129; i++) {
      const x = side === 'east' ? 256 : side === 'west' ? 0 : i * 2, z = side === 'north' ? 256 : side === 'south' ? 0 : i * 2, at = z * 257 + x;
      samples.push(heights[at] ?? 0); rgb.push([colours[at * 3] ?? 0, colours[at * 3 + 1] ?? 0, colours[at * 3 + 2] ?? 0]);
    }
    return { heights: samples, colours: rgb, roadHeight: 0 };
  };
  const terrain = v.parse(TerrainSchema, { version: 1, family: source.family ?? 'toon', collider, tiles: entries });
  const result: BakedTerrain = { terrain, tiles, files, critical: [collider], assets, edge: { north: edgeAt('north'), east: edgeAt('east'), south: edgeAt('south'), west: edgeAt('west') } };
  validateTerrainAssets(terrain, assets, result); return result;
}
