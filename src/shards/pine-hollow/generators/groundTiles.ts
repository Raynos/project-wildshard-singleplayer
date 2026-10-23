/**
 * Tile streaming P1 (G652): Pine Hollow's ground as 64 L0 + 16 L1 splat tiles (G227, `@wildshard/sdk/bake/splatGround`),
 * from its committed WSTR256 bake with the forest's canopy as a channel. L1 keeps a quarter of the native triangles within
 * a metre: the far ring's 125 m tiles are seen from 125 m out.
 */
import type { SplatGroundOptions } from '@wildshard/sdk/bake/splatGround';

/** The material name the ground primitives carry; Pine's `props.splat` row binds it. */
export const PINE_GROUND_MATERIAL = 'pine.ground';
export const PINE_GROUND: SplatGroundOptions = { material: PINE_GROUND_MATERIAL, lod1: { targetRatio: 0.25, maxErrorMetres: 1 } };
