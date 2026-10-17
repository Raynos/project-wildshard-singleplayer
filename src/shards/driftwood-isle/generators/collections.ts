import { parseCollectionDisplays } from '@wildshard/format/collectionDisplay';
import cards from '../data/collectionCards.json' with { type: 'json' };
import keepsakes from '../data/collectionKeepsakes.json' with { type: 'json' };
import chimeSlots from '../data/chimeSlots.json' with { type: 'json' };
import trophySlots from '../data/trophySlots.json' with { type: 'json' };
import { TROPHY_LAYOUT } from './trophyLayout';

/** One publication path: exact baked ranges, authored card rows and the same drop mounting point as the bake. */
export function collectionRows(): ReturnType<typeof parseCollectionDisplays> {
  const layout = TROPHY_LAYOUT;
  return parseCollectionDisplays({ models: {
    chime: { ...cards.chime, objectName: 'sea-glass-chime', geometry: 'chime', still: false, ranges: chimeSlots,
      count: { from: 1, to: chimeSlots.length, parameter: 'count' } },
    plaques: { ...cards.plaques, objectName: 'trophy-plaques', geometry: 'trophyPlaques', still: true, ranges: trophySlots.ranges,
      trophies: { base: 0, empty: trophySlots.empty, full: trophySlots.full, dropGeometry: 'trophyDrop',
        dropOffsets: Object.fromEntries(layout.ids.map(id => [id, [0, -(layout.mountY + (id === 'boar' ? 0.13 : 0.01)), -layout.thickness - layout.panelOffset - 0.04]])) } },
  }, keepsakes });
}
