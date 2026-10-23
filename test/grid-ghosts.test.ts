import { expect, test } from 'vitest';
import { GHOST_AFTER_MS, GhostWorlds } from '../src/game/grid/ghosts';

// M6 (G628): a retired region whose roots stay alive 30 s after its retirement is a ghost world (O18's leak after unload)
test('a retired region counts as a ghost once it is still alive 30 s after retiring', () => {
  const ghosts = new GhostWorlds(), roots = [{}, {}];
  ghosts.retired('driftwood-isle', roots, 1000);
  ghosts.retired('far-reach', [], 1000); // nothing to watch: never a ghost
  expect(ghosts.regions(1000 + 12_000)).toEqual([{ instance: 'driftwood-isle', ageS: 12 }]);
  expect(ghosts.count(1000 + GHOST_AFTER_MS - 1)).toBe(0);
  expect(ghosts.count(1000 + GHOST_AFTER_MS)).toBe(1);
  expect(roots).toHaveLength(2); // the counter itself holds no root
});

test('a region whose roots are all collected leaves the count', async () => {
  const gc: unknown = Reflect.get(globalThis, 'gc');
  if (typeof gc !== 'function') return; // collection needs node --expose-gc
  const ghosts = new GhostWorlds();
  ((): void => { ghosts.retired('driftwood-isle', [{ world: Array.from({ length: 1000 }, () => 0) }], 0); })();
  for (let i = 0; i < 20 && ghosts.regions(1).length > 0; i++) { Reflect.apply(gc, globalThis, []); await new Promise<void>(resolve => { setTimeout(resolve, 10); }); }
  expect(ghosts.regions(GHOST_AFTER_MS)).toEqual([]);
  expect(ghosts.count(GHOST_AFTER_MS)).toBe(0);
});
