import { Vector3, type Material } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import type { Scope } from '@wildshard/engine/app/scope';
import { paintedLook } from '@wildshard/engine/render/dataLook';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { setGroundPools, type GroundPool } from '@wildshard/engine/render/families/ground';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import type { CubeSkirt } from './bakedGround';
import type { PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { DuskLookRow } from '../../data/lastLight';

/**
 * What a dusk look reads live: the quest's dusk and the fires' light uniforms, the sand the data client lends (null until
 * lent), the binding of the level frame's ground and the held skirt with its baked pack.
 */
export interface DuskLookParts {
  readonly dusk: { readonly value: number };
  readonly fires: { readonly value: readonly GroundPool[] };
  readonly sand: { material: Material | null };
  readonly ground: (field: PainterField, scope: Scope) => Promise<void>;
  readonly skirt: CubeSkirt;
  readonly skirtPack: { readonly url: string; readonly rows: PackedGeometryJson & { readonly cubeHalf: number }; readonly fault: string };
}

/**
 * A dusk look on the engine's painted look (G406, one painted look for Sky Reach and Signal Dunes): its two painted strips
 * on the dome, the key, fill, fog and haze riding the dusk's curves, the clock held. The level's ground is this shard's
 * own: the skirt held (cut back to a grid cell's cube through `parts.skirt`), then the level frame's ground bound; the data
 * client draws the tiles in the look's sand (G345), and the burning fires' light pools are fed to it each frame.
 */
export function duskLook(row: DuskLookRow, parts: DuskLookParts): LookStrategy {
  return paintedLook({ sky: { strips: row.sky, load: loadPaintedTexture }, fog: row.fog, clock: () => new DayCycle(row.clock), hold: true,
    sun: { dir: new Vector3(...row.key.dir).normalize(), colour: row.key.color, intensity: row.key.intensity },
    state: { value: parts.dusk, deep: row.key.deep, curves: row.curves },
    terrain: {
      build: async (terrain, field, scope) => {
        const skirt = await parts.skirt.load(parts.skirtPack.url, parts.skirtPack.rows, parts.skirtPack.fault);
        if (skirt !== null) parts.skirt.hold(terrain.group, skirt.standalone, skirt.cube, skirt.half, scope);
        // the collider is the level's ground (its required ground counts as loaded once bound), so it binds before ready()
        await parts.ground(field, scope);
        await field.ready();
      },
      update: () => { if (parts.sand.material !== null) setGroundPools(parts.sand.material, parts.fires.value); },
    } });
}
