import draw from '../data/wildlifeDraw.json' with { type: 'json' };
import type { PackedRange } from './birds';

/** One packed vertex channel: its attribute name, the bake's source lane and its width in floats. */
export interface PackedChannel { name: string; source: string; width: number }
/** The packed bird channels the draw reads (the retired bake-birds.mjs rows). */
const CHANNELS: PackedChannel[] = [{ name: 'position', source: 'position', width: 3 }, { name: 'normal', source: 'normal', width: 3 }, { name: 'color', source: 'color', width: 3 },
  { name: 'aPivot', source: '_pivot', width: 3 }, { name: 'aInfo', source: '_info', width: 4 }, { name: 'aTexV', source: '_tex', width: 4 }];
/** The draw's assets: its bank name, packed channels and the rest ranges the bird bake measured. */
export interface WildlifeDrawAssets { name: string; channels: PackedChannel[]; ranges: PackedRange[] }

/** The authored pose lanes and Explorer cards with the baked rest ranges (GR8: `birdInputs.ts` bakes them), carried
 *  by the product. */
export function wildlifeDraw(ranges: PackedRange[]): Omit<typeof draw, 'assets'> & { assets: WildlifeDrawAssets } {
  return { ...draw, assets: { name: 'wildlife', channels: structuredClone(CHANNELS), ranges } };
}
