/** Authored completion card content. Native progress, safety and card actions stay in quest/Complete. */
import { SEA_GLASS_POINTS, SEA_GLASS_FLAG, REEF_TREASURE } from '../data/interactables';

export const COMPLETE_CONTENT = {
  seenFlag: 'seen:complete',
  shardName: 'Driftwood Isle',
  safeRadius: 25,
  pollSeconds: 1,
  maximumTodo: 7,
  coveredEvents: ['glass', 'treasure'],
  more: 'more',
  titleFallback: 'None yet',
  stats: { time: 'Time played', achievements: 'Achievements', shards: 'Glyph shards', glass: 'Sea glass', places: 'Places', title: 'Title' },
  menuSubtitle: 'Your island · the time, the finds, what is still out there',
  toastSuffix: ' complete · open the menu to see your island',
  card: {
    kicker: 'The Sealed Ring · opened',
    flavour: ['Captain Brine is gone and the ring is open.', 'The island is still yours.'],
  },
  glass: { label: 'Sea glass', short: 'SEA GLASS', flagPrefix: SEA_GLASS_FLAG, points: SEA_GLASS_POINTS },
  extras: [{ label: 'The reef treasure', short: 'REEF TREASURE', flag: 'open:reef-treasure', at: REEF_TREASURE.at }],
};
