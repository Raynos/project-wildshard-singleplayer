import { strike as admitStrike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { SWOOP_DATA } from '../../data/species/duneRay';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';

export const SWOOP: StrikeSpec = strikeFromData(admitStrike(SWOOP_DATA));
