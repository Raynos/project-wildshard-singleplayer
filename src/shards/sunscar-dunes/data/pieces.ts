import { BRAZIERS } from './layout';
import { STRINGS } from './strings';

const PLACES = 'src/shards/sunscar-dunes/generators/places.ts';
/**
 * Signal Dunes' world pieces (C1, SF72): the signal tower, the half-buried caravan, the dry well, the wind-cut rock field
 * and its dressing (drawn straight from the bake) and the three waymark braziers, as the world registry lists them.
 */
export const SIGNAL_PIECES = [
  { id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: 'src/shards/sunscar-dunes/generators/tower.ts', surface: 'wood' },
  { id: 'sunscar.caravan', name: STRINGS.caravan, category: 'props', file: PLACES, surface: 'wood' },
  { id: 'sunscar.well', name: STRINGS.well, category: 'buildings', file: PLACES, surface: 'stone' },
  { id: 'sunscar.rocks', name: STRINGS.rocks, category: 'nature', file: 'src/shards/sunscar-dunes/generators/rocks.ts', surface: 'rock', baked: 'rocks' },
  { id: 'sunscar.dressing', name: STRINGS.dressing, category: 'nature', file: 'src/shards/sunscar-dunes/generators/dressing.ts', surface: 'sand', baked: 'dressing' },
  ...BRAZIERS.map((_, i) => ({ id: `sunscar.brazier.${String(i)}`, name: STRINGS.waymark, category: 'props', file: PLACES, surface: 'stone' } as const)),
] as const;
