import type { Material } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { PainterField } from '@wildshard/engine/render/look';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { decodeTerrainTile } from '@wildshard/engine/world/terrainTileData';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { bindRuntimeProductTerrain } from '@wildshard/game/shardfile/runtimeProduct';
import source from '../shard.config';
import { SPAWN } from '../data/layout';

/** A vertex's sand tint (linear RGB) at (x, z) and height h, written at `out[at..at+2]`: the painter's own hollow / crest tint. */
export type SandTint = (x: number, z: number, h: number, out: Float32Array, at: number) => void;
type Bound = Awaited<ReturnType<typeof bindRuntimeProductTerrain>>;

/** How far (m) the player moves before the fine ring follows (the disc is 150 m; a tile is 62.5 m). */
const FOLLOW = 8;

/** The live binding, while a painter built one: the plugin's system moves its residency with the player. */
let live: { bound: Bound; x: number; z: number; busy: boolean } | null = null;

/**
 * Signal Dunes' ground (G227 M3 tiles-swap; the only ground since Jake's G266, E435): drawn from its compiled shardfile
 * terrain tiles and stood on from their collider, through the platform's runtime-bound terrain
 * (`bindRuntimeProductTerrain`: the same product reader standalone and in a grid cell, the shardfile's own residency rings,
 * 16 coarse L1 tiles always resident and the fine L0 tiles inside the 150 m disc). Each tile is the engine's terrain tile
 * view in the sand material; its vertex tint is the painter's own (hollows and crests against a 14 m ring), not the
 * bake's map ramp. Its normals are the shared collider lattice's, so a tile edge across a crest lights as one surface
 * (tiles-shade: the tiles' own one-sided edge normals drew a hard line there). The tiles cast no shadow (the baked dune
 * shadow map shades them). Height and normal queries and the collider come from the compiled collider
 * (`PainterField.bindGround`).
 */
export async function bindSandTiles(terrain: Terrain, field: PainterField, material: Material, tint: SandTint, scope: Scope): Promise<void> {
  const bound = await bindRuntimeProductTerrain(scope, source, { x: SPAWN.x, z: SPAWN.z, terrain: (bytes, tileScope, _shadow, lattice) => {
    const data = decodeTerrainTile(bytes), r = data.resolution, cell = data.size / (r - 1), colours = new Float32Array(r * r * 3);
    for (let z = 0; z < r; z++) for (let x = 0; x < r; x++) {
      const vertex = z * r + x;
      tint(data.x + x * cell, data.z + z * cell, data.heights[vertex] ?? 0, colours, vertex * 3);
    }
    const mesh = installTerrainTile({ ...data, colours }, { root: terrain.group, scope: tileScope, material, shadow: false, lattice });
    mesh.receiveShadow = false;
    return { mask: (excluded) => { maskTerrainTile(mesh, excluded); }, shadow: () => undefined };
  } });
  if (scope.disposed) throw new Error('Signal Dunes left while binding its ground tiles');
  if (field.bindGround === undefined) throw new Error('Signal Dunes ground tiles need a live level frame (PainterField.bindGround)');
  field.bindGround(bound.ground);
  const entry = { bound, x: SPAWN.x, z: SPAWN.z, busy: false };
  live = entry;
  scope.onDispose(() => { if (live === entry) live = null; });
}

/** Move the fine ring with the player (shard-local metres); a no-op unless the tiles are bound. */
export function followSandTiles(x: number, z: number): void {
  const entry = live;
  if (entry === null || entry.busy || Math.hypot(x - entry.x, z - entry.z) < FOLLOW) return;
  entry.busy = true; entry.x = x; entry.z = z;
  void follow(entry, x, z);
}
async function follow(entry: NonNullable<typeof live>, x: number, z: number): Promise<void> {
  try { await entry.bound.refresh(x, z); }
  catch (error: unknown) { console.warn('[sunscar-dunes] ground tiles refresh failed', error); }
  finally { entry.busy = false; }
}
