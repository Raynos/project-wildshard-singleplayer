import { expect, test } from 'vitest';
import { parseSlicer } from './worldScenePlacementPages';

// DL21: pages whose reads land together never parse in one long task: a stretch of back-to-back parses past the work
// slice continues in a fresh task; a lone parse (after any gap) runs at once
test('back-to-back parses past the budget hop to a fresh task; a gap starts a new stretch', async () => {
  let now = 0, hops = 0;
  const slices = parseSlicer(() => now, () => { hops++; return Promise.resolve(); }, 8);
  const parse = async (ms: number): Promise<void> => { await slices.before(); now += ms; slices.after(); };
  await parse(3); await parse(3); await parse(3);
  expect(hops).toBe(0); // 6 ms into the stretch at the third parse's start
  await parse(3);
  expect(hops).toBe(1); // 9 ms: the fourth starts a fresh task
  await parse(3);
  expect(hops).toBe(1); // the new stretch is 3 ms old
  now += 5; // idle between reads: a new stretch
  await parse(3); await parse(3);
  expect(hops).toBe(1);
});
