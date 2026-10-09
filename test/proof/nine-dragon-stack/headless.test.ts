import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('runs 300 ticks of Jian swings on the trusted entry by tick commands alone, then proves every portal-link entry', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'headless');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { open: readonly string[] };
  // transitional: the Fei Zhua, play-time portal rides and the gates are browser-only, listed as open, never claimed
  expect(report.open.map(row => row.split(' ')[0])).toEqual(['Fei', 'portal', 'gates', 'Jian']);
  expect(report).toMatchObject({ slug: 'nine-dragon-stack', entry: 'runtime/headless.ts', transitional: true,
    headless: { status: 'passed', ticksExecuted: 300, swings: 11, contacts: 11, effects: 0, entries: { lanes: 92, portalTransfers: 8 } } });
}, 60_000);
