import type { Material } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { PainterField } from '@wildshard/engine/render/look';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { decodeTerrainTile } from '@wildshard/engine/world/terrainTileData';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { bindRuntimeProductTerrain } from '@wildshard/game/shardfile/runtimeProduct';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import type { ShardContext } from '@wildshard/game/shard/context';
import { developerToolsEnabled, runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';
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
 * M3 tiles-swap (G227, E435; default off behind the groundTiles Developer tool below): Signal Dunes' ground drawn from its
 * compiled shardfile terrain tiles and stood on from their collider, through the platform's runtime-bound terrain
 * (`bindRuntimeProductTerrain`: the same product reader standalone and in a grid cell, the shardfile's own residency rings,
 * 16 coarse L1 tiles always resident and the fine L0 tiles inside the 150 m disc). Each tile is the engine's terrain tile
 * view in the sand material; its vertex tint is the painter's own (hollows and crests against a 14 m ring), not the
 * bake's map ramp, so the sand reads as it does on the code-built mesh. Its normals are the shared collider lattice's, so a
 * tile edge across a crest lights as one surface (tiles-shade: the tiles' own one-sided edge normals drew a hard line
 * there). The tiles cast no shadow (the baked dune shadow map shades them, as it did the mesh). Height and normal queries
 * and the collider come from the compiled collider (`PainterField.bindGround`).
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

/** The resident fine tiles (a capture's witness), or null when the code-built ground is drawn. */
export function sandTilesResident(): readonly string[] | null { return live === null ? null : [...live.bound.fine]; }

const ROW = 'groundTiles', CHOICES = ['off', 'on'] as const;

/**
 * M3 tiles-swap (G227, E435): Signal Dunes stands on and draws its compiled shardfile terrain tiles (the 64 L0 + 16 L1
 * tiles and the 257² collider, `generators/tiles.ts`) in place of the code-built ground mesh and heightfield. Read from the
 * row's device slot when the ground is built (the painter runs before the plugin's hooks), behind the same Developer fence as the
 * row (a Developer tool, E451: outside Developer the shipped code-built ground runs); default off until parity is proven.
 */
export function groundTiles(): boolean {
  if (!developerToolsEnabled()) return false;
  const saved = jsonSlot(`debug.plugin.sunscar-dunes.${ROW}`, 'device').read();
  return (CHOICES.find((choice) => choice === saved) ?? 'off') === 'on';
}

/** The Developer tool (reload: the ground is built once; no comparison row, E451). Goes once the default flips and the old path is deleted. */
export function installSignalDebug(ctx: ShardContext): void {
  runtimeVariantEnabled(ctx, { purpose: 'developer', id: 'groundTiles', group: 'loading', label: 'Signal Dunes ground tiles', choices: CHOICES.map((value) => ({ value, text: value === 'on' ? 'Tiles' : 'Code-built' })),
    initial: 'off', reload: true, ask: 'E435', reviewBy: '2026-12-30',
    note: 'E435 M3 tiles-swap (G227): the ground drawn and collided from the shardfile terrain tiles (L0 / L1 rings, the compiled collider) instead of the code-built mesh.' });
}
