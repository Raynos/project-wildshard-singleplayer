import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('walks the square into its ring, rides to the north deck and home again by tick commands alone, swinging the Jian and its heavy, then crosses the Well on the Fei Zhua with the safety cap open, and proves every portal-link entry', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'headless');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { open: readonly string[]; headless: { grapple: { capOpenTicks: number; landed: { x: number; y: number; z: number } } } };
  // transitional: only real Jian targets are unproven (Nine has no creature), listed as open, never claimed
  expect(report.open.map(row => row.split(':')[0])).toEqual(['Jian contacts on real targets']);
  // 21 taps and the charged heavy; the grapple's whole lifting crossing from the Well's south rim
  expect(report).toMatchObject({ slug: 'nine-dragon-stack', entry: 'runtime/headless.ts', transitional: true,
    headless: { status: 'passed', ticksExecuted: 1084, swings: 22, contacts: 22, effects: 0,
      rides: ['portal.square.north>portal.north', 'portal.north>portal.square.arrival'],
      grapple: { phases: ['idle', 'fire', 'bite', 'lift', 'zip', 'vault', 'settle', 'idle'] }, entries: { lanes: 92, portalTransfers: 8 } } });
  // the cap stood open from the fire to the settle (~2.5 s), then the player dropped onto the crossing's deck, 6 m under the square
  const { capOpenTicks, landed } = report.headless.grapple;
  expect(capOpenTicks).toBeGreaterThan(120); expect(capOpenTicks).toBeLessThan(180);
  expect(landed.x).toBeCloseTo(-8.53, 1); expect(landed.y).toBeCloseTo(119.09, 1); expect(landed.z).toBeCloseTo(-20.67, 1);
}, 60_000);
