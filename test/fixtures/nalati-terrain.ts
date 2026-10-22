import nalati from '../../src/shards/nalati-grasslands/manifest';
import type { ShardManifest,ChunkTerrain } from '../../src/game/shard/manifest';
import type { MinimapPalette } from '../../src/engine/ui/Minimap';

const ground = nalati.ground,terrain = ground.terrain,colour = nalati.groundColor,surface = nalati.surfaceAt,forest = nalati.forest?.mask,map = nalati.minimap?.palette;
function terrainOwner(value: ShardManifest['ground']): value is ShardManifest['ground'] & { terrain: ChunkTerrain } { return value.terrain !== undefined; }
function mapOwner(value: MinimapPalette | undefined): value is MinimapPalette & { pois: NonNullable<MinimapPalette['pois']> } { return value?.pois !== undefined; }
if (!terrainOwner(ground) || terrain === undefined || colour === undefined || surface === undefined || forest === undefined || !mapOwner(map)) throw new Error('Missing declared Nalati terrain bindings');
export const GROUND = ground;
export const TERRAIN = terrain;
export const groundColor = colour;
export const surfaceAt = surface;
export const forestMask = forest;
export const NALATI_MINIMAP = map;
