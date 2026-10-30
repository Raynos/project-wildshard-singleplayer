import {expect,test} from 'vitest';
import {runNalatiFieldTaming} from './fixtures/headless/nalati-taming-run';

test('the entry walk earns a living stallion prompt and all five native bucking rounds',async()=>{
  expect(typeof window).toBe('undefined');expect(typeof document).toBe('undefined');
  const report=await runNalatiFieldTaming();
  expect(report.approachTicks).toBeGreaterThan(0);expect(report.breakingTicks).toBeGreaterThan(0);
  expect(report.checkpointTick).toBeGreaterThan(report.approachTicks);expect(report.rounds).toBe(5);
// The existing native taming/checkpoint proof uses this same finite bound.
},180_000);
