import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('walks the square into its ring and rides to the north deck and home again by tick commands alone, swinging the Jian, then proves every portal-link entry', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'headless');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { open: readonly string[] };
  // transitional: the Fei Zhua and the gates are browser-only, listed as open, never claimed
  expect(report.open.map(row => row.split(' ')[0])).toEqual(['Fei', 'gates', 'Jian']);
  expect(report).toMatchObject({ slug: 'nine-dragon-stack', entry: 'runtime/headless.ts', transitional: true,
    headless: { status: 'passed', ticksExecuted: 570, swings: 20, contacts: 20, effects: 0,
      rides: ['portal.square.north>portal.north', 'portal.north>portal.square.arrival'], entries: { lanes: 92, portalTransfers: 8 } } });
}, 60_000);
