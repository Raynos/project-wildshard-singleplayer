// oxlint-disable-next-line import/no-nodejs-modules -- Verify the frozen shipping source body.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the shipping source digest.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { MarmotBrain } from '../../../src/shards/nalati-grasslands/creatures/marmotBrain';
import { MarmotOracle } from '../../fixtures/nalati-marmot-oracle/shipping';
import source from '../../fixtures/nalati-marmot-oracle/source.json' with { type: 'json' };

const ground = { heightAt: (x: number, z: number): number => Math.sin(x / 25) + Math.cos(z / 31), normalY: (x: number, z: number): number => x > 50 && z > 50 ? 0.92 : 0.98 };
const sites = [{ x: 0, z: 0 }, { x: 85, z: 20 }, { x: -85, z: -20 }];
it('preserves the actual placement, scatter, sentry/forage/burrow decisions, whistle order, and paused FX clock', () => {
  const body = readFileSync('test/fixtures/nalati-marmot-oracle/shipping.txt', 'utf8');
  const marked = readFileSync('test/fixtures/nalati-marmot-oracle/shipping.ts', 'utf8').split('// BEGIN SHIPPING UPDATE\n')[1]?.split('// END SHIPPING UPDATE')[0];
  expect(marked).toBe(body); expect(createHash('sha256').update(body).digest('hex')).toBe(source.sha256);
  const box = { x0: -260, x1: 260, z0: -260, z1: 260 };
  expect(MarmotBrain.scatter(42, 12, box, ground)).toEqual(MarmotOracle.scatter(42, 12, box, ground));
  const actual = new MarmotBrain(42, ground), old = new MarmotOracle(42, ground), whistles: [number, number][] = [], states = new Set<number>();
  actual.build(sites); old.build(sites); expect(actual.rows).toEqual(old.list);
  let restored: MarmotBrain | undefined;
  for (let tick = 0; tick < 20_000; tick++) {
    const phase = tick % 2400, dt = tick % 7 === 0 ? 1 / 30 : 1 / 60;
    const player = { x: phase < 1200 ? 60 : phase < 1800 ? 0 : 400, y: phase > 2100 ? 200 : 0, z: 0 };
    const speed = phase < 1500 ? 0 : 6, crouched = phase < 900;
    actual.update(dt, player, speed, crouched, (x, z) => { whistles.push([x, z]); }); old.update(dt, player, speed, crouched);
    restored?.update(dt, player, speed, crouched);
    actual.rows.forEach((row, i) => { states.add(row.state); expect(actual.poseDue[i] === 1).toBe(old.pose(i)); });
    expect(actual.rows).toEqual(old.list); expect(whistles).toEqual(old.whistles);
    if (tick % 100 === 0) {
      const saved = actual.snapshot(); expect({ rows: saved.rows, acc: saved.acc, rng: saved.rng }).toEqual(old.state());
      if (restored !== undefined) expect(restored.snapshot()).toEqual(saved);
    }
    if (tick === 9999) { restored = new MarmotBrain(42, ground); restored.restore(textRoundTrip(actual.snapshot())); }
  }
  expect(states).toEqual(new Set([0, 1, 2, 3])); expect(whistles.length).toBeGreaterThan(0);
});
it('refuses incompatible or out-of-bound continuation and placement, without accepting a different private stream', () => {
  const brain = new MarmotBrain(42, ground); brain.build(sites); brain.update(1 / 60, { x: 0, y: 0, z: 0 }, 0, false);
  const saved = brain.snapshot(); expect(() => new MarmotBrain(43, ground).restore(saved)).toThrow('seed mismatch');
  expect(() => brain.restore({ ...saved, unknown: 1 })).toThrow();
  expect(() => brain.restore({ ...saved, rows: saved.rows.slice(1) })).toThrow('colony identity mismatch');
  expect(() => brain.restore({ ...saved, bands: { ...saved.bands, rows: [] } })).toThrow('Missing marmot clocks');
  expect(() => brain.restore({ ...saved, bands: { ...saved.bands, rows: saved.bands.rows.map(row => ({ ...row, id: 'unknown' })) } })).toThrow();
  const invalid = structuredClone(saved); invalid.rows.forEach(row => { row.x = Number.NaN; });
  expect(() => brain.restore(invalid)).toThrow();
  expect(() => brain.build(Array.from({ length: 65 }, () => ({ x: 0, z: 0 })))).toThrow();
  expect(() => MarmotBrain.scatter(42, 65, { x0: 0, x1: 1, z0: 0, z1: 1 }, ground)).toThrow();
});

/** Exercise the portable wire, rather than an in-memory clone. */
function textRoundTrip(value: unknown): unknown { const text = JSON.stringify(value); return JSON.parse(text); }
