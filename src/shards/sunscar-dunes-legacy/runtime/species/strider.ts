import { strike as admitStrike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { CHARGE_DATA, HORNS_DATA } from '../../data/species/strider';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';

export const CHARGE: StrikeSpec = strikeFromData(admitStrike(CHARGE_DATA));
export const HORNS: StrikeSpec = strikeFromData(admitStrike(HORNS_DATA));
