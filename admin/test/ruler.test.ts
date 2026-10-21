import { expect, it } from 'vitest';
import { netLineReport } from '../../scripts/shard-net-lines.mjs';
import { SHARDS, nextRuler, readRuler, readRulerHistory, wavePercent } from '../../scripts/admin-data/ruler.mjs';

const netLines = netLineReport({ sample: {customLines: 70, basis: 'source'} },
  [{wave: 'W2', revision: 'sealed', record: 'M0', customLines: {sample: 100},
    platformLines: {engine: 100, game: 100, format: 10, sdk: 100}}],
  {engine: 110, game: 120, format: 15, sdk: 100});

/** A minimal `node scripts/shard-platform.mjs --json` output: every legacy shard at `custom` lines of 1,000 legacy. */
function raw(custom: Record<string, number>, basis = 'source', legacy = 1000): unknown {
  const rows = Object.fromEntries(SHARDS.map((s) => [s.slug, {
    m3: { basis, customLines: custom[s.slug] ?? legacy * 0.9, legacyLines: legacy },
    gridReady: { verdict: s.slug === 'nalati-grasslands' ? 'fail' : 'unknown', criteria: { memory: { verdict: 'unknown' }, edgeProfile: { verdict: 'pass' } } },
  }]));
  return { ...rows, _template: { m3: null }, _summary: { netLines, progress: {
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

it('persists component closure only when every shard has measured zero', () => {
  const measured = raw({});
  if (typeof measured !== 'object' || measured === null || !('_summary' in measured)
    || typeof measured._summary !== 'object' || measured._summary === null) throw new Error('Missing fixture summary');
  const summary = measured._summary;
  const componentWaves = [{ id: 'W2', components: { C8: { closed: true, lines: { 'pine-hollow': 0, 'driftwood-isle': 0 } } } }];
  const components = { C7: { closed: false, state: 'closing', lines: { 'pine-hollow': 0, 'nalati-grasslands': 93 } } };
  Object.assign(summary, { waves: componentWaves, components });
  const at = { revision: 'a'.repeat(40), committedAt: '2026-10-20T16:40:00Z', now: '2026-10-20T16:50:00Z' };
  const ruler = nextRuler(measured, null, at);
  expect(readRuler(ruler).componentWaves).toEqual(componentWaves);
  expect(readRuler(ruler).components).toEqual(components);
  Object.assign(summary, { waves: [{ id: 'W2', components: { C8: { closed: true, lines: { 'pine-hollow': 1, 'driftwood-isle': 0 } } } }] });
  expect(() => nextRuler(measured, null, at)).toThrow('every shard at zero');
});

it('refreshes pre-correction history while enforcing the fresh plan bounds', () => {
  const previous = nextRuler(raw({}), null, { revision: 'a'.repeat(40), committedAt: '2026-10-16T16:40:00Z', now: '2026-10-16T16:50:00Z' });
  previous.plan.upper = 1.001688;
  expect(() => readRuler(previous)).toThrow('plan.upper above 1');
  const retained = readRulerHistory(previous, { lower: 0.6, upper: 1 });
  expect(retained.history).toEqual(previous.history);
  expect(retained.events).toEqual(previous.events);
  expect(retained.plan).toEqual({ lower: 0.6, upper: 1 });
  expect(() => readRulerHistory(previous, previous.plan)).toThrow('plan.upper above 1');
  expect(() => readRulerHistory({}, retained.plan)).toThrow();
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


it('advances W1, W2 and W3 only when both shards have zero custom lines', () => {
  const at = { revision: 'a'.repeat(40), committedAt: '2026-10-17T12:00:00Z', now: '2026-10-17T12:10:00Z' };
  const first = nextRuler(raw({ 'far-reach': 0, 'sunscar-dunes': 1 }), null, at);
  expect(first.wave.id).toBe('W1');
  const second = nextRuler(raw({ 'far-reach': 0, 'sunscar-dunes': 0, 'pine-hollow': 0, 'driftwood-isle': 1 }), first, at);
  expect(second.wave.id).toBe('W2');
  expect(second.wave.until).toBeNull();
  const third = nextRuler(raw({ 'far-reach': 0, 'sunscar-dunes': 0, 'pine-hollow': 0, 'driftwood-isle': 0, 'nalati-grasslands': 0, 'nine-dragon-stack': 1 }), second, at);
  expect(third.wave.id).toBe('W3');
  const completed = nextRuler(raw(Object.fromEntries(SHARDS.map(shard => [shard.slug, 0]))), third, at);
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


it('keeps a wave open when its displayed percentage rounds down to the goal', () => {
  const at = { revision: 'a'.repeat(40), committedAt: '2026-10-17T12:00:00Z', now: '2026-10-17T12:10:00Z' };
  const ruler = nextRuler(raw({ 'far-reach': 1, 'sunscar-dunes': 0 }, 'source', 10000), null, at);
  expect(ruler.shards.find(shard => shard.slug === 'far-reach')?.pct).toBe(0);
  expect(ruler.wave.id).toBe('W1');
});


it('publishes format-inclusive signed net lines and refuses an incomplete measurement', () => {
  const at = {revision: 'a'.repeat(40), committedAt: '2026-10-18T12:00:00Z', now: '2026-10-18T12:10:00Z'};
  const measured = raw({});
  const ruler = nextRuler(measured, null, at);
  expect(ruler.netLines).toMatchObject([{customCut: 30, platformGrowth: 35, netCut: -5,
    layers: {format: {before: 10, after: 15, growth: 5}}}]);
  expect(readRuler(structuredClone(ruler)).netLines).toEqual(ruler.netLines);
  expect(() => readRuler({...ruler, netLines: [{...netLines[0], layers: {}}]})).toThrow();
});

it('persists the independent per-shard frame floor without folding it into M2',()=>{
 const measured=raw({});
 if(typeof measured!=='object'||measured===null||!('pine-hollow' in measured)||typeof measured['pine-hollow']!=='object'||measured['pine-hollow']===null)throw new Error('Missing fixture shard');
 const row=measured['pine-hollow'];
 Object.assign(row,{gridReady:{verdict:'pass',criteria:{oneFrameLooks:{verdict:'pass'}},frameFloor:{verdict:'fail',evidence:'p95 50 ms > 35 ms'}}});
 const ruler=nextRuler(measured,null,{revision:'a'.repeat(40),committedAt:'2026-10-20T16:40:00Z',now:'2026-10-20T16:50:00Z'});
 expect(ruler.shards.find(s=>s.slug==='pine-hollow')).toMatchObject({grid:'pass',frameFloor:{verdict:'fail',evidence:'p95 50 ms > 35 ms'}});
 expect(ruler.frameFloor).toEqual({ready:0,fail:1,unknown:5,total:6});
 expect(ruler.m2).toEqual({ready:0,fail:1,unknown:5,total:6});
 expect(readRuler(structuredClone(ruler)).frameFloor).toEqual(ruler.frameFloor);
});
