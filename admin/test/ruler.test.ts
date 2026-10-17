import { expect, it } from 'vitest';
import { SHARDS, nextRuler, readRuler, wavePercent } from '../../scripts/admin-data/ruler.mjs';

/** A minimal `node scripts/shard-platform.mjs --json` output: every legacy shard at `custom` lines of 1,000 legacy. */
function raw(custom: Record<string, number>, basis = 'source'): unknown {
  const rows = Object.fromEntries(SHARDS.map((s) => [s.slug, {
    m3: { basis, customLines: custom[s.slug] ?? 900, legacyLines: 1000 },
    gridReady: { verdict: s.slug === 'nalati-grasslands' ? 'fail' : 'unknown', criteria: { memory: { verdict: 'unknown' }, edgeProfile: { verdict: 'pass' } } },
  }]));
  return { ...rows, _template: { m3: null }, _summary: { progress: {
    m3: { fraction: 0.171, cut: 13746, mustGo: 80171.5 }, m2: { ready: 0, unknown: 5, total: 6 }, plan: { lower: 0.103, upper: 0.436 },
  } } };
}

it('reads the ruler into the G458 card data with W1 first', () => {
  const r = nextRuler(raw({ 'pine-hollow': 879, 'driftwood-isle': 809 }), null, { revision: 'a'.repeat(40), committedAt: '2026-10-16T16:40:00Z', now: '2026-10-16T16:50:00Z' });
  expect(r.shards.find((s) => s.slug === 'pine-hollow')?.pct).toBe(87.9);
  expect(r.m2).toEqual({ ready: 0, fail: 1, unknown: 5, total: 6 });
  expect(r.native).toEqual(['_template']);
  expect(r.wave.id).toBe('W1');
  expect(r.wave.until).toBeNull();
  expect(r.history).toHaveLength(1);
  expect(readRuler(structuredClone(r))).toEqual(r);
});

it('keeps W1 open past midnight, records a P4 re-base, never repeats a revision', () => {
  const first = nextRuler(raw({}), null, { revision: 'a'.repeat(40), committedAt: '2026-10-16T16:40:00Z', now: '2026-10-16T16:50:00Z' });
  const same = nextRuler(raw({}), first, { revision: 'a'.repeat(40), committedAt: '2026-10-16T16:40:00Z', now: '2026-10-16T17:50:00Z' });
  expect(same.history).toHaveLength(1);
  const later = nextRuler(raw({ 'far-reach': 500 }, 'output'), same, { revision: 'b'.repeat(40), committedAt: '2026-10-17T06:00:00Z', now: '2026-10-17T06:10:00Z' });
  expect(later.wave.id).toBe('W1');
  expect(later.waves.find((w) => w.id === 'W1')?.endedAt).toBeNull();
  expect(later.waves.some(wave => wave.id === 'W2')).toBe(false);
  expect(later.events.map((e) => e.label)).toContain('P4 re-base: the ruler moves from the source basis to output');
  expect(later.history).toHaveLength(2);
});

it('scores a wave by how far each shard moved from its start toward the goal', () => {
  expect(wavePercent({ a: 100, b: 100 }, { a: 60, b: 20 }, ['a', 'b'], 20)).toBe(75);
  expect(wavePercent({ a: 100 }, { a: 120 }, ['a'], 20)).toBe(0);
});


it('advances W1, W2 and W3 only when both shards meet their mini-plan goals', () => {
  const at = { revision: 'a'.repeat(40), committedAt: '2026-10-17T12:00:00Z', now: '2026-10-17T12:10:00Z' };
  const first = nextRuler(raw({ 'far-reach': 100, 'sunscar-dunes': 101 }), null, at);
  expect(first.wave.id).toBe('W1');
  const second = nextRuler(raw({ 'far-reach': 100, 'sunscar-dunes': 100, 'pine-hollow': 200, 'driftwood-isle': 201 }), first, at);
  expect(second.wave.id).toBe('W2');
  expect(second.wave.until).toBeNull();
  const third = nextRuler(raw({ 'far-reach': 100, 'sunscar-dunes': 100, 'pine-hollow': 200, 'driftwood-isle': 200 }), second, at);
  expect(third.wave.id).toBe('W3');
  const completed = nextRuler(raw(Object.fromEntries(SHARDS.map(shard => [shard.slug, shard.goal * 10]))), third, at);
  expect(completed.wave.id).toBe('NEXT');
});

it('reopens the obsolete midnight schedule without losing its measured history', () => {
  const at = { revision: 'a'.repeat(40), committedAt: '2026-10-17T06:00:00Z', now: '2026-10-17T06:10:00Z' };
  const previous = nextRuler(raw({}), null, at);
  previous.wave.id = 'W1 spike';
  previous.waves = [
    { id: 'W2', startedAt: '2026-10-14T04:19:00Z', start: {}, endedAt: '2026-10-17T05:00:00Z' },
    { id: 'W1 spike', startedAt: at.now, start: {}, endedAt: null },
  ];
  const current = nextRuler(raw({}), previous, at);
  expect(current.wave.id).toBe('W1');
  expect(current.waves.map(wave => wave.id)).toEqual(['W1']);
  expect(current.history).toEqual(previous.history);
  const repeated = nextRuler(raw({}), current, at);
  expect(repeated.events).toEqual(current.events);
});
