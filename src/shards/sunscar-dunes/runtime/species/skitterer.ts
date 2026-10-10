import { strike as admitStrike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { BITE_DATA } from '../../data/species/skitterer';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** The skitterer's bite (its policy is the admitted species script behaviour/skitterer.as, SF27). */
export const BITE: StrikeSpec = strikeFromData(admitStrike(BITE_DATA));

/** A stable small integer per animal (its seed hashed), so pack members pick their own ring angles. */
export const slot = (a: Pick<AnimalSim, 'seed'>, n: number): number => Math.floor(Math.abs(Math.sin(a.seed * 12.9898 + 1.7) * 43758.5)) % n;
