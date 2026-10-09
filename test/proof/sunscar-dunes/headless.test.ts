import { expect, it } from 'vitest';
import { signalWitness } from './native';

it('walks the signal quest, lights the fire and fells the Matriarch by tick commands alone, past 10,000 ticks, then proves its entries', () => {
  const result = signalWitness('headless');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ slug: 'sunscar-dunes', entry: 'runtime/headless.ts',
    headless: { status: 'passed', questComplete: true, facts: ['sunscar.signal', 'sunscar.matriarch'], coins: 25, entries: { lanes: 92 } } });
  const headless = (report as { headless: { ticksExecuted: number; blows: number; shovedTicks: number; entries: { steps: number } } }).headless;
  expect(headless.ticksExecuted).toBeGreaterThanOrEqual(10_000); expect(headless.entries.steps).toBeGreaterThan(0);
  // the creatures' blows land and knock the player back, as the browser's PlayerHurt does (feel.blow)
  expect(headless.blows).toBeGreaterThan(0); expect(headless.shovedTicks).toBeGreaterThan(0);
}, 120_000);
