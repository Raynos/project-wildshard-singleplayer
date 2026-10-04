import * as v from 'valibot';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
/** The terrain's render files address the ordinary tile grid; the collider file is a separate critical sim root. */
export const TerrainSchema = v.pipe(v.strictObject({ version: v.literal(1), family: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)), collider: ref,
  tiles: v.pipe(v.array(v.strictObject({ lod: v.picklist([0, 1]), x: address, z: address, file: ref })), v.length(80)) }),
v.check((terrain) => new Set(terrain.tiles.map((tile) => `${tile.lod}/${tile.x}/${tile.z}`)).size === 80 && terrain.tiles.every((tile) => tile.x < (tile.lod === 0 ? 8 : 4) && tile.z < (tile.lod === 0 ? 8 : 4)), 'complete terrain tile grids'));
/** A validated terrain section, containing no landscape closures. */
export type ShardTerrain = v.InferOutput<typeof TerrainSchema>;
/** Check baked payloads against the public tile rows and edge profiles, including exact render/collider L0 seams. */
export function validateTerrainAssets(terrain: ShardTerrain, assets: ReadonlyMap<string, Uint8Array>, content: {
  tiles: readonly { lod: number; x: number; z: number; files: readonly string[]; geometricError: number }[];
  critical: readonly string[]; edge: Record<'north' | 'east' | 'south' | 'west', { heights: readonly number[]; colours: readonly (readonly number[])[] }>;
}): void {
  const read = (fileRef: string) => { const bytes = assets.get(fileRef); if (bytes === undefined) throw new Error('Missing terrain file'); return decodeTerrainTile(bytes); };
  const collider = read(terrain.collider);
  if (!content.critical.includes(terrain.collider) || collider.colours !== undefined || collider.x !== -250 || collider.z !== -250 || collider.size !== 500 || collider.resolution !== 257) throw new Error('Terrain collider must be a complete critical heightfield');
  const colours = new Map<string, readonly number[]>();
  for (const tile of terrain.tiles) {
    const data = read(tile.file), size = tile.lod === 0 ? 62.5 : 125, row = content.tiles.find((t) => t.lod === tile.lod && t.x === tile.x && t.z === tile.z);
    if (data.colours === undefined || data.size !== size || data.x !== -250 + tile.x * size || data.z !== -250 + tile.z * size || data.resolution !== (tile.lod === 0 ? 33 : 17) || row === undefined || !row.files.includes(tile.file)) throw new Error('Terrain tile payload disagrees with its address');
    for (let z = 0; z < data.resolution; z++) for (let x = 0; x < data.resolution; x++) {
      const height = terrainTileHeight(collider, data.x + x * size / (data.resolution - 1), data.z + z * size / (data.resolution - 1));
      if (Math.abs((data.heights[z * data.resolution + x] ?? Infinity) - height) > 1e-5) throw new Error('Terrain render/collider seam mismatch');
      if (tile.lod === 0) {
        const key = `${tile.x * 32 + x}/${tile.z * 32 + z}`, rgb = [...data.colours.subarray((z * data.resolution + x) * 3, (z * data.resolution + x) * 3 + 3)], prior = colours.get(key);
        if (prior !== undefined && rgb.some((c, i) => c !== prior[i])) throw new Error('Terrain colour seam mismatch');
        colours.set(key, rgb);
      }
    }
    let error = 0;
    for (let z = 0; z <= size / (500 / 256); z++) for (let x = 0; x <= size / (500 / 256); x++) {
      const px = data.x + x * 500 / 256, pz = data.z + z * 500 / 256;
      error = Math.max(error, Math.abs(terrainTileHeight(data, px, pz) - terrainTileHeight(collider, px, pz)));
    }
    if (row.geometricError + 1e-5 < error) throw new Error('Terrain geometric error understated');
  }
  for (const [side, edge] of Object.entries(content.edge)) {
    if (edge.heights.length !== 129 || edge.colours.length !== 129) throw new Error('Terrain edge profile sample count');
    edge.heights.forEach((height, i) => {
      const p = -250 + i * 500 / 128, x = side === 'east' ? 250 : side === 'west' ? -250 : p, z = side === 'north' ? 250 : side === 'south' ? -250 : p;
      if (Math.abs(height - terrainTileHeight(collider, x, z)) > 1e-5) throw new Error('Terrain edge profile mismatch');
      const key = `${Math.round((x + 250) / 500 * 256)}/${Math.round((z + 250) / 500 * 256)}`, rgb = colours.get(key), declared = edge.colours[i];
      if (rgb === undefined || declared?.length !== 3 || rgb.some((c, channel) => c !== declared[channel])) throw new Error('Terrain edge colour mismatch');
    });
    if (edge.heights[64] !== 0) throw new Error('Terrain entry road must meet road height zero');
  }
}
