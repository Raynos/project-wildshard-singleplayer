import type { HuntHerd, HuntBody } from '@wildshard/engine/ai/hunt';
import type { SimHost } from '@wildshard/engine/sim';
import { PINE_HERD_SHELTER as look } from '../data/weatherLook';
import { HerdShelter } from './species/herdShelter';

/** Actual page tree position, trunk radius, height and RainFx crown-cover reading, in forest order. */
export type PineShelterTree = readonly [x: number, z: number, radius: number, height: number, cover: number];
type Herd = HuntHerd<HuntBody>;
/** One native shelter keeper beside the existing weather owner; no second Weather, settings or random stream. */
export function installPineRainShelter(host: SimHost, herds: () => readonly Herd[], trees: readonly PineShelterTree[], rain: () => number): HerdShelter<{ x: number; z: number; r: number; height: number; cover: number }> {
  if (trees.length > 16384) throw new Error('Pine shelter tree bound exceeded');
  const source = { get herds() {
    const rows = herds();
    if (rows.length > 512) throw new Error('Pine shelter herd bound exceeded');
    return rows;
  } };
  const shelter = new HerdShelter(source, trees.map(([x, z, r, height, cover]) => ({ x, z, r, height, cover })),
    (_x, _z, tree) => tree.cover, look);
  host.onStep('pine.rain-shelter', dt => { shelter.update(dt, rain()); }, { snapshot: () => shelter.snapshot(), restore: value => { shelter.restore(value); } });
  return shelter;
}
