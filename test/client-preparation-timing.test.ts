import { expect, test } from 'vitest';
import { isDev, setDev } from '../src/engine/core/devMode';
import { timeClientPreparation } from '../src/game/shardfile/preparationTiming';

test('preparation spans replace reentry, preserve failures and skip public work', async () => {
  const dev = isDev(), name = 'wildshard.prepare:fixture:world.data';
  try {
    setDev(true);
    expect(await timeClientPreparation('fixture', 'world.data', () => 7)).toBe(7);
    await timeClientPreparation('fixture', 'world.data', () => Promise.resolve(undefined));
    expect(performance.getEntriesByName(name)).toHaveLength(1);
    const error = new Error('preparation failed');
    await expect(timeClientPreparation('fixture', 'world.data', () => { throw error; })).rejects.toBe(error);
    const entries = performance.getEntriesByName(name);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.duration).toBeGreaterThanOrEqual(0);
    performance.clearMeasures(name);
    setDev(false);
    expect(await timeClientPreparation('fixture', 'world.data', () => 9)).toBe(9);
    expect(performance.getEntriesByName(name)).toHaveLength(0);
  } finally { setDev(dev); performance.clearMeasures(name); }
});
