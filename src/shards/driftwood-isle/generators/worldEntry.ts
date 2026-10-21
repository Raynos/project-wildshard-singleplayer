import { parseWorldEntry, type WorldEntryRows, type WorldEntryStep } from '@wildshard/format/worldEntry';
import { ISLAND_KNOBS } from './tiers';

const TIERS = ['phone', 'desktop'] as const;
/** a tier's foliage placement and its draw, named for its model, clipped by the island dressing */
const foliage = (kind: 'bushes' | 'palms', mesh: string, castShadow: (tier: typeof TIERS[number]) => boolean | undefined): WorldEntryStep[] => TIERS.flatMap(tier => {
  const placement = `foliage.${kind}.${tier}`, shadow = castShadow(tier);
  return [{ kind: 'place', id: placement, when: { tier } }, { kind: 'attach', id: mesh, as: 'mesh', nameAfter: placement, when: { tier },
    userData: { islandDressingClipped: true }, ...(shadow === undefined ? {} : { castShadow: shadow }) }];
});

/**
 * Driftwood Isle's declared world entry (world/entry.json, run by @wildshard/game/shardfile/worldEntry in
 * world/build.ts): the hibiscus bushes and the coconut palms for this tier, and the cove's small rocks.
 */
export function driftwoodWorldEntry(): WorldEntryRows {
  return parseWorldEntry({ blocks: {
    bushes: foliage('bushes', 'hibiscus.mesh', tier => ISLAND_KNOBS[tier].bushShadows),
    palms: foliage('palms', 'palms.mesh', () => undefined),
    smallRocks: [{ kind: 'place', id: 'rocks.small.copies' }, { kind: 'attach', id: 'rocks.small', as: 'mesh', nameAfter: 'rocks.small.copies' }],
  } });
}
