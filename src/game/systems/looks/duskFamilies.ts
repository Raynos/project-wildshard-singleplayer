import { MeshStandardMaterial, type Material, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { setGroundPools, updateGround, type GroundPool } from '@wildshard/engine/render/families/ground';
import type { GroundLayerParams } from '@wildshard/engine/render/families/params';
import { mappedFamilyMaterial } from './bakedGround';
import { duskRow, type DuskRow } from './duskCurves';

/**
 * Dusk family surfaces (SHARD-PLATFORM M3; ex a dune shard's sky and sand): a sand that is the PBR family's ground layer
 * over three baked maps (a grain tile, a trail mask, a key-shadow map) and a painted sky that is the emissive family's sky
 * over two dusk stages, both moved by one dusk value (0 the first frame … 1 the end of the dusk) through uniforms only.
 * The sand's dusk terms (the ripples' contrast, the grain's strength, the albedo, the shade and the faces turned from the
 * afterglow) are dusk-curve rows (`./duskCurves`); the burning fires are the ground layer's light pools. Nothing here
 * knows a shard: the maps' names, numbers, wind and afterglow come in as rows and arguments.
 */

type V2 = readonly [number, number];
type V3 = readonly [number, number, number];

/** A dusk sand as rows: its name, its three maps' names, its PBR surface, its dusk curves and its trail / key-shadow / fire-pool layers. */
export interface DuskSandRow {
  readonly name: string;
  readonly maps: { readonly grain: string; readonly trail: string; readonly shadow: string };
  readonly roughness: number; readonly metalness: number;
  /** dusk-curve rows for `contrast`, `grainStrength`, `albedo`, `shade` and `away` (the dimming of faces turned from the afterglow) */
  readonly curves: DuskRow;
  /** the trail mask's rect (x0, z0, x1, z1), how much of the ripples it keeps, its tint and amount */
  readonly trail: { readonly rect: readonly [number, number, number, number]; readonly ripples: number; readonly tint: V3; readonly amount: number };
  /** the key-shadow map's rect, its edge and the key's floor in cast shade */
  readonly keyShadow: { readonly rect: readonly [number, number, number, number]; readonly edge: V2; readonly floor: number };
  /** the fires' light pools: the low and high colours, their split, radius and gain */
  readonly pools: { readonly low: V3; readonly high: V3; readonly split: number; readonly radius: number; readonly gain: number };
}

/** Where a dusk sand lies: the wind its ripples run with and where the afterglow is brightest (x / z). */
export interface DuskSandSite { readonly wind: { readonly x: number; readonly z: number }; readonly glow: { readonly x: number; readonly z: number } }

/** The grain tile's own means (the shader subtracts them so every faded grain term is zero-mean). */
export interface GrainMeans { readonly mean: number; readonly glintMean: number }

/** A dusk sand's family terms at one dusk value (clamped to 0..1). */
export function duskSandAt(row: DuskSandRow, dusk: number, grain: GrainMeans, glow: DuskSandSite['glow']): Pick<GroundLayerParams, 'contrast' | 'grain' | 'albedo' | 'shade' | 'away'> {
  const terms = duskRow(row.curves, Math.min(1, Math.max(0, dusk))) as Pick<GroundLayerParams, 'contrast' | 'albedo' | 'shade'> & { readonly grainStrength: number; readonly away: number };
  return { contrast: terms.contrast, grain: { map: row.maps.grain, mean: grain.mean, glintMean: grain.glintMean, strength: terms.grainStrength }, albedo: terms.albedo, shade: terms.shade,
    away: { from: [glow.x, glow.z], amount: terms.away } };
}

/** A dusk sand's family entry: the PBR family with its ground layer over its three maps. */
export function duskSandEntry(row: DuskSandRow, dusk: number, grain: GrainMeans, site: DuskSandSite): unknown {
  return { family: 'pbr', vertexColours: true, roughness: row.roughness, metalness: row.metalness, ground: {
    wind: [site.wind.x, site.wind.z],
    ...duskSandAt(row, dusk, grain, site.glow),
    trail: { map: row.maps.trail, rect: row.trail.rect, ripples: row.trail.ripples, tint: row.trail.tint, amount: row.trail.amount },
    keyShadow: { map: row.maps.shadow, rect: row.keyShadow.rect, edge: row.keyShadow.edge, floor: row.keyShadow.floor },
    pools: { low: row.pools.low, high: row.pools.high, split: row.pools.split, radius: row.pools.radius, gain: row.pools.gain },
  } };
}

/** The live sand: its material and the adapter that moves it with the dusk and the fires. */
export interface DuskSand {
  readonly material: MeshStandardMaterial;
  /** feed the dusk (uniforms, only when it moved) and the burning fires */
  readonly update: (dusk: number, fires: readonly GroundPool[]) => void;
}

/** A dusk sand as a PBR family material over its baked maps (the grain's `meanR` / `meanGlint` in its user data); freed with `scope`. */
export function duskSand(row: DuskSandRow, maps: { readonly grain: Texture; readonly trail: Texture; readonly shadow: Texture }, site: DuskSandSite, dusk: number, scope: Scope): DuskSand {
  const grain = { mean: Number(maps.grain.userData['meanR']), glintMean: Number(maps.grain.userData['meanGlint']) };
  const material = mappedFamilyMaterial(duskSandEntry(row, dusk, grain, site), { [row.maps.grain]: maps.grain, [row.maps.trail]: maps.trail, [row.maps.shadow]: maps.shadow }, scope, row.name);
  if (!(material instanceof MeshStandardMaterial)) throw new Error(`${row.name}: the PBR family compiles to a MeshStandardMaterial`);
  let fed = dusk;
  return { material, update: (next, fires) => {
    if (next !== fed) { fed = next; updateGround(material, duskSandAt(row, next, grain, site.glow)); }
    setGroundPools(material, fires);
  } };
}

/** A painted dusk sky as rows: its name, its two stages' map names, the strip's elevations, the dusk window, the first stage's gain and the hold. */
export interface DuskSkyRow {
  readonly name: string;
  readonly maps: readonly [string, string];
  readonly elevation: V2; readonly window: V2; readonly firstGain: V2; readonly hold: number;
}

/** A painted dusk sky's family entry: the emissive family's sky over its two stages. */
export function duskSkyEntry(row: DuskSkyRow): unknown {
  return { family: 'emissive', sky: { maps: row.maps, elevation: row.elevation, window: row.window, firstGain: row.firstGain, hold: row.hold } };
}

/** The live sky: the dome's material and the adapter that feeds the dusk as its look's blend. */
export interface DuskSky {
  readonly material: Material;
  readonly update: (dusk: number) => void;
}

/** A painted dusk sky as an emissive family sky over its two stages; freed with `scope`. */
export function duskSky(row: DuskSkyRow, stages: readonly [Texture, Texture], dusk: number, scope: Scope): DuskSky {
  const look = new EmissiveLook({ blend: Math.min(1, Math.max(0, dusk)) });
  const material = mappedFamilyMaterial(duskSkyEntry(row), { [row.maps[0]]: stages[0], [row.maps[1]]: stages[1] }, scope, row.name, look);
  let fed = look.params.blend;
  return { material, update: (next) => {
    const blend = Math.min(1, Math.max(0, next));
    if (blend !== fed) { fed = blend; look.set({ blend }); }
  } };
}
