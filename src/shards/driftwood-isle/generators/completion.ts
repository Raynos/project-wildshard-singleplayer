/** Authored completion copy; the existing platform card owns safety, progress and its page lifetime. */
import { parseCompletion, type CompletionRows } from '@wildshard/format/completion';
import { createQuestPlacements } from '@wildshard/engine/world/interact/types';
import frames from '../data/questFrames.json' with { type: 'json' };
import { DRIFTWOOD_PLACES } from './discovery';
import placeSets from '../data/placeSets.json' with { type: 'json' };
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { SHARD_FLAGS, SEA_GLASS_COUNT, SEA_GLASS_POINTS, SEA_GLASS_FLAG, REEF_TREASURE } from './interactables';

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

/** Resolve static find coordinates offline, in the same frame law as the live quest placement owner. */
export function completionRows(): CompletionRows {
  const { place } = createQuestPlacements({ terrain: () => 0, frames });
  const content = COMPLETE_CONTENT;
  const glass = content.glass.points.map(([x, z], i) => ({ label: content.glass.label, short: content.glass.short, flag: `${content.glass.flagPrefix}${i + 1}`, x, z }));
  const extras = content.extras.map(({ at, label, short, flag }) => { const p = place(at); return { label, short, flag, x: p.x, z: p.z }; });
  const places = DRIFTWOOD_PLACES.map(row => {
    const p = place(row.at), spot: CompletionRows['groups'][number]['spots'][number] = { label: row.completeLabel, short: row.label, flag: `seen:${row.id}`, x: p.x, z: p.z };
    if (row.at.anchor !== undefined) spot.anchor = row.at.anchor;
    return spot;
  });
  return parseCompletion({ doneFlag: 'quest:driftwood-done', seenFlag: content.seenFlag, trigger: 'reward', system: 'shard.driftwood-isle.installComplete',
    before: ['game.loot', 'body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'], after: [],
    title: content.shardName, card: content.card, menuSubtitle: content.menuSubtitle, toastSuffix: content.toastSuffix,
    safeRadius: content.safeRadius, pollSeconds: content.pollSeconds, maximumTodo: content.maximumTodo, more: content.more, coveredEvents: content.coveredEvents,
    groups: [{ id: 'glass', todo: 'count', label: 'sea glass', spots: glass }, { id: 'extras', todo: 'individual', label: 'Extras', spots: extras }, { id: 'places', todo: 'individual', label: 'Places', spots: places }],
    stats: [{ label: content.stats.time, value: { kind: 'time' } }, { label: content.stats.achievements, value: { kind: 'achievements' } },
      { label: content.stats.shards, value: { kind: 'flags', flags: SHARD_FLAGS } }, { label: content.stats.glass, value: { kind: 'group', group: 'glass', total: SEA_GLASS_COUNT } },
      { label: content.stats.places, value: { kind: 'group', group: 'places', total: places.length } }, { label: content.stats.title, value: { kind: 'title', fallback: content.titleFallback } }],
  });
}

/** The named places' Sets (data/placeSets.json) as the client plan's `world.sets` rows: each place's circle resolved
 *  offline in the live quest placement's frame law, its copies taken by their bounds; Wreck Cove's set is its whole
 *  `wreck` group (the wreck and the cove) and nothing spatial. */
export function placeSetRows(): Extract<ClientFeatureRow, { kind: 'world.sets' }>['rows'] {
  const { place } = createQuestPlacements({ terrain: () => 0, frames });
  return placeSets.map(row => {
    const def = DRIFTWOOD_PLACES.find(entry => `driftwood-isle/${entry.id}` === row.place); if (def === undefined) throw new Error(`places: no named place ${row.place}`);
    const p = place(def.at), wreck = 'explicit' in row;
    return { id: row.id, name: row.name, place: row.place, file: 'src/shards/driftwood-isle/data/placeSets.json', pois: wreck ? ['wreck'] : [], x: p.x, z: p.z, r: wreck ? 0 : def.r, mode: 'bounds' };
  });
}
