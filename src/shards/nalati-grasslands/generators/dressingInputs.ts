import { readNativeTerrain, readNativeScalarField } from '@wildshard/sdk/bake/terrain';
import { bakeForestPlacements } from '@wildshard/sdk/bake/forest';
import { bakeMeadowField } from '@wildshard/sdk/bake/meadow';
import authored from '../manifest.json' with { type: 'json' };
import meadowLayout from '../data/grassFieldLayout.json' with { type: 'json' };
import { TERRAIN, SEED, RIVER, inSpruceClearing, loneSpruceMask, edgeBermAt } from './terrainRecipe';
import { edgeSpruceMask } from './edgeRecipe';
import { SPRUCE_SPECS } from './spruceGeometry';
import type { NativeDressingSource } from './dressingSource';

/** Original native data observations; the author names the two existing forest laws explicitly. */
export interface NalatiDressingInputs {
  readonly terrain: Uint8Array;
  readonly scalarBlocks: ReadonlyMap<string, Uint8Array>;
  readonly forest: 'sampled' | 'continuous';
  readonly phone: boolean;
}

/** Bind owned native terrain, pond, pigment, meadow and forest without selecting or installing a page world.
 * Every supplied byte block and this source graph belongs in the caller's native cache key. */
export function prepareNalatiDressingInputs(input: NalatiDressingInputs): NativeDressingSource {
  const native = readNativeTerrain(input.terrain), { grid, heightAt, normalAt, splatAt } = native;
  if (grid.res !== 256 || grid.size !== 500 || grid.seed !== SEED) throw new Error('Requires original Nalati dressing terrain');
  if (input.forest !== 'sampled' && input.forest !== 'continuous') throw new Error('Unknown Nalati dressing forest law');
  const scalar = (name: string) => readNativeScalarField({
    res: grid.res, size: grid.size, values: { type: 'f32', count: grid.res ** 2, data: { file: `data/geography-${name}.bin` } },
  }, input.scalarBlocks);
  const pond = scalar('pond'), red = scalar('red').sample, green = scalar('green').sample, blue = scalar('blue').sample;
  if (pond.values.some(value => value < 0 || value > 1)) throw new Error('Invalid Nalati pond mask');
  const pondMask = pond.sample;
  const mask = input.forest === 'sampled' ? scalar('forest').sample : (x: number, z: number): number => inSpruceClearing(x, z)
    ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)));
  const { trailDistance, cabinMask, trails } = TERRAIN;
  const meadow = bakeMeadowField({ seed: SEED, half: grid.size / 2, heightAt, normalAt, splatAt,
    trailDistance, cabinMask, pondMask, waterLevel: () => RIVER.level,
    paint: (x, z, _height, _slope, out) => { out[0] = red(x, z); out[1] = green(x, z); out[2] = blue(x, z); return true; },
    layout: { ...meadowLayout, riverZ: RIVER.z, riverHalf: RIVER.half } });
  const pair = (value: readonly number[]): [number, number] => {
    const [first, second] = value;
    if (value.length !== 2 || first === undefined || second === undefined || !Number.isFinite(first) || !Number.isFinite(second))
      throw new Error('Invalid authored forest range');
    return [first, second];
  };
  const policy = authored.forest;
  const forest = bakeForestPlacements({ seed: SEED, treeCount: authored.treeCount, heightAt, normalAt, trailDistance, cabinMask, pondMask,
    forest: { ...policy, mask, clearings: pair(policy.clearings), tintHueJitter: pair(policy.tintHueJitter),
      tintSat: pair(policy.tintSat), tintLight: pair(policy.tintLight) } },
  SPRUCE_SPECS.map(row => ({ trunkRadius: row.trunk, height: row.height })));
  return { heightAt, normalAt, trailDistance, trails, meadow, forest, phone: input.phone,
    inChunk: (x, z, margin = 0) => Math.abs(x) <= grid.size / 2 - margin && Math.abs(z) <= grid.size / 2 - margin };
}
