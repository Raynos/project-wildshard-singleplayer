import { parseEasedFields } from '@wildshard/format/easedFields';
import { FLAG, SCOUT_FLAG } from './rows/flags';

/** Original first-match dusk targets. Saves snap; play keeps the 0.02 units/second law. */
export const SIGNAL_WEATHER_FIELDS = parseEasedFields({ version: 1, fields: [{ field: 'dusk', min: 0, max: 1, ease: { rate: 0.02 }, else: 0,
  steps: [
    { when: { all: [FLAG.lit] }, value: 1 },
    ...[3, 2, 1].map(count => ({ when: { count: { of: [0, 1, 2].map(index => `${FLAG.brazierPrefix}${String(index)}`), atLeast: count } }, value: 0.5 + 0.12 * count })),
    { when: { all: [FLAG.oil] }, value: 0.56 },
    { when: { all: [FLAG.logbook] }, value: 0.52 },
    { when: { all: [SCOUT_FLAG] }, value: 0.5 },
  ],
}] });
