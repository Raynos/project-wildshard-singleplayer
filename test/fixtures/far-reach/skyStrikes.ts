// Sky's admitted creature strikes, built from the shard's rows (data/strikes.ts) exactly as its runtime catalogue admits them
// (runtime/brainCatalogue.ts): the goat's RAM, the ray's DIVE and the wisp's BURST, for the tests and oracles that run them.
import { strike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../../../src/shards/far-reach/data/strikes';

export const RAM = strikeFromData(strike(RAM_DATA));
export const DIVE = strikeFromData(strike(DIVE_DATA));
export const BURST = strikeFromData(strike(BURST_DATA));
