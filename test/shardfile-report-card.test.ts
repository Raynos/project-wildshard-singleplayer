import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { performanceReport, performanceReportLines, type PerformanceObservations } from '../src/game/shardfile/reportCard';
import { inkGraph } from '../scripts/tsl-spike/stress.js';

const observations: PerformanceObservations = { scripts: { p95Micros: 20, maxMicros: 40, samples: 60 }, fuel: { p95: 50, max: 100, samples: 60 } };
const source = () => emptyShardfile({ slug: 'report-fixture', name: 'Report', author: 'Fixture', revision: 1, seed: 1 });

it('prints all estimates and measurements for an empty admitted world without claiming a browser reading', () => {
  const card = performanceReport(source(), observations), lines = performanceReportLines(card).join('\n');
  expect(card.pass).toBe(true);
  for (const field of ['memory near player', 'worst grid memory', 'draws', 'triangles', 'graphs:', 'measured scripts', 'fuel', 'critical', 'tiles', 'library', 'estimated playable', 'not a phone reading']) expect(lines).toContain(field);
  expect(card.memory.near.playing).toBeLessThanOrEqual(card.memory.worst.playing);
  expect(card.estimatedPlayable.seconds).toBe(1);
});

it('refuses complete memory overflow for new/outside content and warns only under caller-supplied legacy policy', () => {
  const s = source(); s.budgets.library.resident = 1_000_000_000;
  const refused = performanceReport(s, observations), warned = performanceReport(s, observations, 'warn');
  expect(refused.pass).toBe(false); expect(warned.pass).toBe(true);
  expect(refused.issues.some(issue => issue.metric === 'worst playing total bytes' && issue.severity === 'refusal')).toBe(true);
  expect(warned.issues.every(issue => issue.severity === 'warning')).toBe(true);
  // An old-looking author identity never changes the default policy.
  s.identity.slug = 'driftwood-isle'; expect(performanceReport(s, observations).pass).toBe(false);
});

it('warns tradeable category memory even for a new shard, and refuses missing/nonfinite or excessive execution observations', () => {
  const s = source(); s.budgets.library.resident = 25_000_001;
  const card = performanceReport(s, observations);
  expect(card.pass).toBe(true); expect(card.issues).toMatchObject([{ severity: 'warning', actual: 25_000_001 }]);
  for (const scripts of [{ ...observations.scripts, samples: 0 }, { ...observations.scripts, p95Micros: Number.NaN }, { ...observations.scripts, p95Micros: 5000 }]) expect(performanceReport(s, { ...observations, scripts }).pass).toBe(false);
  s.serverBudget.tickMicros = 16_666;
  expect(performanceReport(s, { ...observations, scripts: { ...observations.scripts, p95Micros: 4167 } }).pass).toBe(false);
});

it('deduplicates nested download closures and prints SF59 graph v1 costs', () => {
  const s = source(), one = 'a'.repeat(64), two = 'b'.repeat(64);
  s.files = [{ hash: one, kind: 'binary', compressed: 100, decoded: 100, gpu: 0, draws: 1, triangles: 10, dependencies: [two], critical: false },
    { hash: two, kind: 'binary', compressed: 200, decoded: 200, gpu: 0, draws: 2, triangles: 20, dependencies: [], critical: false }];
  s.library = [one, two]; s.budgets.library = { compressed: 300, resident: 300 };
  s.look.materials['ink'] = { family: 'graph', graph: inkGraph() };
  const card = performanceReport(s, observations);
  expect(card.download).toMatchObject({ library: 300, total: 300, playable: 300 });
  expect(card.views[0]).toMatchObject({ draws: 3, triangles: 30 });
  expect(card.graphs[0]?.instructions).toBeGreaterThan(0);
  expect(performanceReportLines(card).join('\n')).toContain('/480 instructions');
});
