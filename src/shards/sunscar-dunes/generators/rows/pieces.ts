import * as LAYOUT from '../layout';
import STRINGS from '../../data/strings.json' with { type: 'json' };

const PLACES = 'src/shards/sunscar-dunes/generators/places.ts';
/**
 * Signal Dunes' world pieces (C1, SF72): the signal tower, the half-buried caravan, the dry well, the wind-cut rock field
 * and its dressing (drawn straight from the bake) and the three waymark braziers, as the world registry lists them.
 */
export const SIGNAL_PIECES: readonly [{ readonly id: "sunscar.tower"; readonly name: string; readonly category: "buildings"; readonly file: "src/shards/sunscar-dunes/generators/tower.ts"; readonly surface: "wood"; }, { readonly id: "sunscar.caravan"; readonly name: string; readonly category: "props"; readonly file: "src/shards/sunscar-dunes/generators/places.ts"; readonly surface: "wood"; }, { readonly id: "sunscar.well"; readonly name: string; readonly category: "buildings"; readonly file: "src/shards/sunscar-dunes/generators/places.ts"; readonly surface: "stone"; }, { readonly id: "sunscar.rocks"; readonly name: string; readonly category: "nature"; readonly file: "src/shards/sunscar-dunes/generators/rocks.ts"; readonly surface: "rock"; readonly baked: "rocks"; }, { readonly id: "sunscar.dressing"; readonly name: string; readonly category: "nature"; readonly file: "src/shards/sunscar-dunes/generators/dressing.ts"; readonly surface: "sand"; readonly baked: "dressing"; }, ...{ readonly id: `sunscar.brazier.${string}`; readonly name: string; readonly category: "props"; readonly file: "src/shards/sunscar-dunes/generators/places.ts"; readonly surface: "stone"; }[]] = [
  { id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings', file: 'src/shards/sunscar-dunes/generators/tower.ts', surface: 'wood' },
  { id: 'sunscar.caravan', name: STRINGS.caravan, category: 'props', file: PLACES, surface: 'wood' },
  { id: 'sunscar.well', name: STRINGS.well, category: 'buildings', file: PLACES, surface: 'stone' },
  { id: 'sunscar.rocks', name: STRINGS.rocks, category: 'nature', file: 'src/shards/sunscar-dunes/generators/rocks.ts', surface: 'rock', baked: 'rocks' },
  { id: 'sunscar.dressing', name: STRINGS.dressing, category: 'nature', file: 'src/shards/sunscar-dunes/generators/dressing.ts', surface: 'sand', baked: 'dressing' },
  ...LAYOUT.BRAZIERS.map((_, i) => ({ id: `sunscar.brazier.${String(i)}`, name: STRINGS.waymark, category: 'props', file: PLACES, surface: 'stone' } as const)),
] as const;
