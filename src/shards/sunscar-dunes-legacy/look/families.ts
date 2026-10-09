import { MeshStandardMaterial, type Material, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import { setGroundPools, updateGround, type GroundPool } from '@wildshard/engine/render/families/ground';
import type { GroundLayerParams } from '@wildshard/engine/render/families/params';
import { GROUND_HALF } from '../data/layout';
import { WIND } from '../world/dunes';
import { PAINTED } from './painted';
import { SUN_GLOW } from './sky';

/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10): the sand is the PBR
 * family's ground layer, the painted dusk dome the emissive family's sky. What changes with the quest's dusk (`look/dusk.ts`)
 * is fed by a runtime adapter as family parameters (uniforms only): the ripples' contrast, the grain, the albedo, the shade
 * fill and its floor, the faces turned from the afterglow, the sky's stage blend; the burning fires (`world/fireFx.ts`) are
 * the ground layer's light pools. No shard shader source is left on either surface.
 */

/** The baked key-shadow map's reach (m either side of the centre): the far skirt's dunes cast shade too. */
export const SHADOW_HALF = 520;

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The sand's dusk terms at one dusk value (0 the first frame's sunset … 1 the blue hour). */
export function sandAtDusk(dusk: number, grain: { readonly mean: number; readonly glintMean: number }): Pick<GroundLayerParams, 'contrast' | 'grain' | 'albedo' | 'shade' | 'away'> {
  const d = Math.min(1, Math.max(0, dusk));
  return {
    // round 8 / 11: the ripples' contrast falls with the dusk (mockup B's late sand is dim and soft)
    contrast: { near: 0.52, far: 0.26, window: [4, 26], strength: 1 - 0.55 * smooth(0.2, 0.6, d) - 0.2 * smooth(0.6, 0.9, d) },
    // the blue hour's sky light models no grain (mockups B-D): the grain clumps fade as the dusk deepens
    grain: { map: 'sd:grain', mean: grain.mean, glintMean: grain.glintMean, strength: 1 - 0.75 * smooth(0.2, 0.6, d) },
    // round 12: the sunset step's sand a step darker
    albedo: 0.8 + 0.2 * smooth(0, 0.3, d),
    // round 1 / loop 6 / R2B-1: a cool blue-grey shade at sunset turning a warm brown at dusk, never blue-black; the dusk's
    // lavender floor (round 8: the late views' sand dim warm brown-violet, not black)
    shade: {
      tint: mix3([0.95, 0.9, 1.3], [0.95, 0.85, 0.9], d), gain: 1.05 + 0.1 * d,
      lift: [0.016 * (1 - d), 0.013 * (1 - d), 0.02 * (1 - d)], amount: 0.9, edge: 0.14,
      floor: [0.013 * d + 0.006 * smooth(0.15, 0.5, d), 0.008 * d + 0.004 * smooth(0.15, 0.5, d), 0.009 * d + 0.003 * smooth(0.15, 0.5, d)],
    },
    // rounds 12-24: in the late dusk the faces turned from the afterglow fall dark (x0.45), the faces toward it keep their light
    away: { from: [SUN_GLOW.x, SUN_GLOW.z], amount: 0.55 * smooth(0.3, 0.85, d) },
  };
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
  const byRef: Record<string, Texture> = { 'sd:grain': maps.grain, 'sd:trail': maps.trail, 'sd:shadow': maps.shadow };
  const material = familyMaterial(sandEntry(dusk, grain), { toon: new ToonLook(), scope, textures: (ref) => {
    const t = byRef[ref];
    if (t === undefined) throw new Error(`Signal Dunes sand: no texture ${ref}`);
    return t;
  } });
  scope.own(material);
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
  const byRef: Record<string, Texture> = { 'sd:early': stages[0], 'sd:late': stages[1] };
  const material = familyMaterial(SKY_ENTRY, { toon: new ToonLook(), emissive: look, scope, textures: (ref) => {
    const t = byRef[ref];
    if (t === undefined) throw new Error(`Signal Dunes sky: no texture ${ref}`);
    return t;
  } });
  scope.own(material);
  let fed = look.params.blend;
  return { material, update: (next) => {
    const blend = Math.min(1, Math.max(0, next));
    if (blend !== fed) { fed = blend; look.set({ blend }); }
  } };
}
