import { Noise2D, smoothstep, clamp, lerp } from '@wildshard/sdk/noise';
import type { NativeForestPlacements } from '@wildshard/sdk/bake/forest';
import type { NativeMeadowField } from '@wildshard/sdk/bake/meadow';
import { dressingRecipe, dressingPoiColliders, type DressPlan } from './dressingPlan';
import { bakeNalatiPoiKeepouts, dressingRockColliders } from './places';
import view from '../data/worldView.json' with { type: 'json' };
import * as layout from './layout';
import * as terrain from './terrainRecipe';

/** One build's explicit native observations, before any page or product reader binds them. */
export interface NativeDressingSource {
  readonly heightAt: (x: number, z: number) => number;
  readonly normalAt: (x: number, z: number, epsilon?: number) => [number, number, number];
  readonly trailDistance: (x: number, z: number) => number;
  readonly inChunk: (x: number, z: number, margin?: number) => boolean;
  readonly trails: readonly (readonly (readonly [number, number])[])[];
  readonly meadow: Pick<NativeMeadowField, 'baseHeightAt' | 'sample'>;
  readonly forest: NativeForestPlacements;
  readonly phone: boolean;
}

/** Compose the original scatter, fresh POI/statue and rock keep-outs over caller-owned native queries.
 * No filesystem, page selection, terrain installation or generated-place fallback runs here.
 * The caller keys any native cache on this recipe and all supplied observations. */
export async function bakeNalatiDressingSource(source: NativeDressingSource): Promise<{
  plan: DressPlan; clutter: { x: number; z: number; yaw: number; kind: number }[]; trees: number; avoid: number;
}> {
  const { heightAt, normalAt, trailDistance, inChunk, trails, meadow, forest, phone } = source;
  const { planDressing, campClutterSpots } = dressingRecipe({ layout, ...terrain, Noise2D, smoothstep, clamp, lerp,
    heightAt, normalAt, trailDistance, inChunk, TRAILS: trails,
    grassBaseHeightAt: (x, z) => meadow.baseHeightAt(x, z), grassToneAt: (x, z) => meadow.sample(x, z, 1),
    flowerPatchAt: (x, z) => meadow.sample(x, z, 2) });
  const plan = await planDressing(forest);
  const poi = dressingPoiColliders(bakeNalatiPoiKeepouts(heightAt), view.sequence, heightAt);
  const avoid = [...poi, ...dressingRockColliders(heightAt, phone, { normalAt, trailDistance })];
  return { plan, clutter: campClutterSpots(avoid), trees: forest.trees.length, avoid: avoid.length };
}
