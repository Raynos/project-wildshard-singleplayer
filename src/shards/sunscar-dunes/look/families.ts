import { MeshStandardMaterial, type Material, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { mappedFamilyMaterial } from '@wildshard/sdk/looks/bakedGround';
import { setGroundPools, updateGround, type GroundPool } from '@wildshard/engine/render/families/ground';
import type { GroundLayerParams } from '@wildshard/engine/render/families/params';
import { GROUND_HALF } from '../data/layout';
import { SHADOW_HALF } from '../data/sand';
import { WIND } from '../world/dunes';
import { PAINTED } from './painted';
import { duskDomeSun } from '@wildshard/sdk/looks/duskDome';
import { SKY_STYLE } from '../data/sky';
import { SAND_DUSK } from '../data/dusk';
import { duskRow } from '@wildshard/sdk/looks/duskCurves';

/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10): the sand is the PBR
 * family's ground layer, the painted dusk dome the emissive family's sky. What changes with the quest's dusk (`look/dusk.ts`)
 * is fed by a runtime adapter as family parameters (uniforms only): the ripples' contrast, the grain, the albedo, the shade
 * fill and its floor, the faces turned from the afterglow, the sky's stage blend; the burning fires (`world/fireFx.ts`) are
 * the ground layer's light pools. No shard shader source is left on either surface.
 */


/** Where the afterglow is brightest (`data/sky.ts`): the faces turned from it fall dark in the late dusk. */
const SUN_GLOW = duskDomeSun(SKY_STYLE);

/** The sand's dusk terms at one dusk value (0 the first frame's sunset … 1 the blue hour; the curves are data/dusk.ts SAND_DUSK). */
export function sandAtDusk(dusk: number, grain: { readonly mean: number; readonly glintMean: number }): Pick<GroundLayerParams, 'contrast' | 'grain' | 'albedo' | 'shade' | 'away'> {
  const row = duskRow(SAND_DUSK, Math.min(1, Math.max(0, dusk))) as Pick<GroundLayerParams, 'contrast' | 'albedo' | 'shade'> & { readonly grainStrength: number; readonly away: number };
  return { contrast: row.contrast, grain: { map: 'sd:grain', mean: grain.mean, glintMean: grain.glintMean, strength: row.grainStrength }, albedo: row.albedo, shade: row.shade,
    away: { from: [SUN_GLOW.x, SUN_GLOW.z], amount: row.away } };
}

/** The sand's family entry: the PBR family with Signal Dunes' ground layer over the baked maps `sd:grain` / `sd:trail` / `sd:shadow`. */
export function sandEntry(dusk: number, grain: { readonly mean: number; readonly glintMean: number }): unknown {
  return { family: 'pbr', vertexColours: true, roughness: 0.88, metalness: 0, ground: {
    wind: [WIND.x, WIND.z],
    ...sandAtDusk(dusk, grain),
    // round 2 / E399: a baked 0.75 m trail mask, trodden smoother (half its ripples) and a faint brighter bed
    trail: { map: 'sd:trail', rect: [-GROUND_HALF, -GROUND_HALF, GROUND_HALF, GROUND_HALF], ripples: 0.5, tint: [1.1, 1.05, 0.98], amount: 0.6 },
    // E407 row 3: long dune shadows across the troughs, the key kept at 0.28 in cast shade
    keyShadow: { map: 'sd:shadow', rect: [-SHADOW_HALF, -SHADOW_HALF, SHADOW_HALF, SHADOW_HALF], edge: [0.25, 0.75], floor: 0.28 },
    // round 8 / 23 / 24: each burning fire lights the sand orange round it, the caravan's lantern (a fraction of a fire) amber
    pools: { low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 },
  } };
}

/** The painted dome's family entry: the emissive family's sky over the two dusk stages `sd:early` / `sd:late`. */
export const SKY_ENTRY = { family: 'emissive', sky: { maps: ['sd:early', 'sd:late'], elevation: [PAINTED.elevBottom, PAINTED.elevTop], window: [...PAINTED.dusk], firstGain: [0.64, 1], hold: 2.5 } } as const;

/** The live sand: its material and the adapter that moves it with the dusk and the fires. */
export interface FamilySand {
  readonly material: MeshStandardMaterial;
  /** feed the dusk (uniforms, only when it moved) and the burning fires */
  readonly update: (dusk: number, fires: readonly GroundPool[]) => void;
}

/** Signal Dunes' sand as a PBR family material over its baked maps; freed with `scope`. */
export function familySand(maps: { readonly grain: Texture; readonly trail: Texture; readonly shadow: Texture }, dusk: number, scope: Scope): FamilySand {
  const grain = { mean: Number(maps.grain.userData['meanR']), glintMean: Number(maps.grain.userData['meanGlint']) };
  const material = mappedFamilyMaterial(sandEntry(dusk, grain), { 'sd:grain': maps.grain, 'sd:trail': maps.trail, 'sd:shadow': maps.shadow }, scope, 'Signal Dunes sand');
  if (!(material instanceof MeshStandardMaterial)) throw new Error('Signal Dunes sand: the PBR family compiles to a MeshStandardMaterial');
  let fed = dusk;
  return { material, update: (next, fires) => {
    if (next !== fed) { fed = next; updateGround(material, sandAtDusk(next, grain)); }
    setGroundPools(material, fires);
  } };
}

/** The live sky: the dome's material and its look (the adapter feeds the dusk as the look's blend). */
export interface FamilySky {
  readonly material: Material;
  readonly update: (dusk: number) => void;
}

/** The painted dusk dome as an emissive family sky over the two stages; freed with `scope`. */
export function familySky(stages: readonly [Texture, Texture], dusk: number, scope: Scope): FamilySky {
  const look = new EmissiveLook({ blend: Math.min(1, Math.max(0, dusk)) });
  const material = mappedFamilyMaterial(SKY_ENTRY, { 'sd:early': stages[0], 'sd:late': stages[1] }, scope, 'Signal Dunes sky', look);
  let fed = look.params.blend;
  return { material, update: (next) => {
    const blend = Math.min(1, Math.max(0, next));
    if (blend !== fed) { fed = blend; look.set({ blend }); }
  } };
}
