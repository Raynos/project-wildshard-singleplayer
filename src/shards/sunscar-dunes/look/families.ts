import type { Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { duskSand, duskSandAt, duskSandEntry, duskSky, duskSkyEntry, type DuskSand, type DuskSky, type GrainMeans } from '@wildshard/sdk/looks/duskFamilies';
import { duskDomeSun } from '@wildshard/sdk/looks/duskDome';
import { WIND } from '../world/dunes';
import { SKY_STYLE } from '../data/sky';
import { SAND_LOOK, SKY_LOOK } from '../data/familyLook';

/**
 * Signal Dunes' sky and sand on the engine's material families (SHARD-PLATFORM SF50 / SF10a, A10), from their rows
 * (data/familyLook.ts) on the SDK's dusk family surfaces: what changes with the quest's dusk (`look/dusk.ts`) is fed as
 * family parameters (uniforms only); the burning fires (`world/fireFx.ts`) are the ground layer's light pools.
 */

/** The sand's wind (`world/dunes.ts`) and where the afterglow is brightest (`data/sky.ts`): the faces turned from it fall dark in the late dusk. */
const SITE = { wind: WIND, glow: duskDomeSun(SKY_STYLE) };

/** The sand's dusk terms at one dusk value (0 the first frame's sunset … 1 the blue hour; the curves are data/dusk.ts SAND_DUSK). */
export const sandAtDusk = (dusk: number, grain: GrainMeans): ReturnType<typeof duskSandAt> => duskSandAt(SAND_LOOK, dusk, grain, SITE.glow);
/** The sand's family entry: the PBR family with Signal Dunes' ground layer over the baked maps. */
export const sandEntry = (dusk: number, grain: GrainMeans): unknown => duskSandEntry(SAND_LOOK, dusk, grain, SITE);
/** The painted dome's family entry: the emissive family's sky over the two dusk stages. */
export const SKY_ENTRY = duskSkyEntry(SKY_LOOK);
/** The live sand: its material and the adapter that moves it with the dusk and the fires. */
export type FamilySand = DuskSand;
/** The live sky: the dome's material and its dusk adapter. */
export type FamilySky = DuskSky;
/** Signal Dunes' sand as a PBR family material over its baked maps; freed with `scope`. */
export const familySand = (maps: { readonly grain: Texture; readonly trail: Texture; readonly shadow: Texture }, dusk: number, scope: Scope): FamilySand => duskSand(SAND_LOOK, maps, SITE, dusk, scope);
/** The painted dusk dome as an emissive family sky over the two stages; freed with `scope`. */
export const familySky = (stages: readonly [Texture, Texture], dusk: number, scope: Scope): FamilySky => duskSky(SKY_LOOK, stages, dusk, scope);
