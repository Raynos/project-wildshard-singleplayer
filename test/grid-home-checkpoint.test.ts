import { expect, it, vi } from 'vitest';
import { Inventory } from '../src/game/Inventory';
import { Progress } from '../src/game/Progress';
import { legacyHomeCheckpoint } from '../src/game/grid/homeCheckpoint';

it('waits for the real play owner and retries its progress and pack without using the respawn hook', () => {
  let play: { progress: Progress; inventory: Inventory } | null = null;
  const checkpoint = legacyHomeCheckpoint(() => play);
  expect(checkpoint()).toBe(false);
  play = { progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') };
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  play.inventory.add('coconut', 3); play.progress.addPlay(0.25);
  expect(checkpoint()).toBe(false);
  write.mockRestore(); expect(checkpoint()).toBe(true);
  expect(new Inventory('driftwood-isle').count('coconut')).toBe(3);
  expect(new Progress('driftwood-isle').playS).toBe(0.25);
});
