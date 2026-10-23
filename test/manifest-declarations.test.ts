import { expect, it } from 'vitest';
import nalati from '../src/shards/nalati-grasslands/manifest';
import nine from '../src/shards/nine-dragon-stack/discovery.generated';

it('Nine uses compiled page ownership without a trusted runtime', () => {
  expect(nine.clientPlanRuntime).toBe(true);
  expect(nine.trustedRuntime).toBeUndefined();
});

it('keeps the four native camera poses and unbounded Nine attacker allocation', async () => {
  expect(nine.fight?.attackers).toBe(Infinity);
  expect(Object.keys(await nine.dev?.poses() ?? {})).toEqual(['A', 'B', 'C', 'D']);
});

it('keeps Nalati camera eyes bound to the installed terrain owner', async () => {
  const original = nalati.ground, terrain = original.terrain;
  if (terrain === undefined) throw new Error('Nalati has no native terrain');
  try {
    nalati.ground = { ...original, terrain: { ...terrain, heightAt: () => 25 } };
    const camp = (await nalati.dev?.poses())?.['camp'];
    expect(camp?.eye).toEqual([60, 26.68, 214]);
  } finally { nalati.ground = original; }
});
