import { expect, it } from 'vitest';
import { portSharesMismatch, portSharesText } from '../scripts/gen-port-shares.mjs';
import { PORT_SHARES } from '../src/game/shard/portShares';
import { GAME_STRINGS } from '../src/game/strings';

const ruler = (shards: readonly { slug: string; pct: number }[]): string =>
  JSON.stringify({ revision: 'a'.repeat(40), measuredAt: '2026-10-17T16:23:08.771Z', shards });

it('reads ported as 1 − custom percent, so Sky Reach at 7.7 % custom is 92 % PORTED', () => {
  const table = JSON.parse(portSharesText(ruler([{ slug: 'far-reach', pct: 7.7 }, { slug: 'nalati-grasslands', pct: 70.8 }, { slug: 'over', pct: 130 }]))) as { revision: string; measuredAt: string; shares: Record<string, number> };
  expect(table.shares).toEqual({ 'far-reach': 0.923, 'nalati-grasslands': 0.292, over: 0 });
  expect(table.revision).toBe('a'.repeat(40));
  expect(table.measuredAt).toBe('2026-10-17T16:23:08.771Z');
  expect(GAME_STRINGS.entry.ported(table.shares['far-reach'] ?? 0)).toBe('92% PORTED');
});

it('names the fix when the table and the ruler disagree', () => {
  const text = ruler([{ slug: 'far-reach', pct: 7.7 }]);
  expect(portSharesMismatch(text, portSharesText(text))).toBeNull();
  expect(portSharesMismatch(ruler([{ slug: 'far-reach', pct: 9 }]), portSharesText(text))).toMatch(/node scripts\/gen-port-shares\.mjs/u);
  expect(portSharesMismatch(text, undefined)).toMatch(/does not match/u);
  expect(portSharesMismatch(undefined, portSharesText(text))).toMatch(/missing/u);
  expect(portSharesMismatch('{"shards":[]}', '')).toMatch(/no revision/u);
});

// The ruler itself lives under progress/, which the Vercel-tree gate drops; pre-commit compares the two files.
it('the committed table feeds the badges', () => {
  expect(Object.keys(PORT_SHARES).length).toBeGreaterThan(0);
  for (const share of Object.values(PORT_SHARES)) { expect(share).toBeGreaterThanOrEqual(0); expect(share).toBeLessThanOrEqual(1); }
});
