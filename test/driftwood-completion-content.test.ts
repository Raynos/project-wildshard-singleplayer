import { expect, test } from 'vitest';
import { COMPLETE_CONTENT } from '../src/shards/driftwood-isle/generators/completion';
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/generators/interactables';
import { DRIFTWOOD_PLACES } from '../src/shards/driftwood-isle/generators/discovery';

test('completion finds retain the kit order, flags and authored placement frames', () => {
  const glass = [], extras = [];
  for (const row of DRIFTWOOD_INTERACT.rows) {
    if (row.kind === 'pickup' && row.look === 'seaglass' && row.sets?.[0] !== undefined)
      glass.push({ flag: row.sets[0], at: row.at });
    else if (row.id === 'reef-treasure') extras.push({ flag: `open:${row.id}`, at: row.at });
  }
  expect(COMPLETE_CONTENT.glass.points.map(([x, z], i) => ({
    flag: `${COMPLETE_CONTENT.glass.flagPrefix}${i + 1}`, at: { poi: 'world', x, z },
  }))).toEqual(glass);
  expect(COMPLETE_CONTENT.extras.map(({ flag, at }) => ({ flag, at }))).toEqual(extras);
  expect(glass).toHaveLength(15);
  expect(extras).toHaveLength(1);
});

test('authored place and completion copy retain the shipped card text and limits', () => {
  for (const place of DRIFTWOOD_PLACES) {
    const expected = place.label.toLowerCase().replaceAll(/(^|[\s'’-])(\p{L})/gu,
      (_match: string, prefix: string, letter: string) => prefix + letter.toUpperCase()).replaceAll(/'S\b/g, "'s");
    expect(place.completeLabel).toBe(expected);
  }
  expect(COMPLETE_CONTENT.card).toEqual({ kicker: 'The Sealed Ring · opened',
    flavour: ['Captain Brine is gone and the ring is open.', 'The island is still yours.'] });
  expect(Object.values(COMPLETE_CONTENT.stats)).toEqual(['Time played', 'Achievements', 'Glyph shards', 'Sea glass', 'Places', 'Title']);
  expect([COMPLETE_CONTENT.seenFlag, COMPLETE_CONTENT.safeRadius, COMPLETE_CONTENT.pollSeconds,
    COMPLETE_CONTENT.maximumTodo, COMPLETE_CONTENT.coveredEvents]).toEqual(['seen:complete', 25, 1, 7, ['glass', 'treasure']]);
});
