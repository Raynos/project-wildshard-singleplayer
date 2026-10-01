import { expect, it } from 'vitest';
import { FAR_REACH } from '#shards/far-reach/manifest';

it('declares Sky Reach public card artwork in the offline Explore preload inventory', () => {
  const art = FAR_REACH.boot?.explore?.art ?? [];
  const cards = [...new Set(Object.values(FAR_REACH.card))].filter((url) => url.startsWith('/assets/'));
  expect(cards).toEqual(['/assets/far-reach/card.jpg']);
  for (const url of cards) expect(art).toContain(url);
  const explore = FAR_REACH.explore;
  if (explore && 'art' in explore) for (const url of Object.values(explore.art)) expect(art).toContain(url);
});
