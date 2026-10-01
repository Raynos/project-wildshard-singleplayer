import { expect, expectTypeOf, it } from 'vitest';
import type { Player } from '#engine/player/Player';

it('has no player collider list or legacy bridge anywhere in the nonempty source tree', () => {
  expectTypeOf<Extract<keyof Player, 'colliders'>>().toEqualTypeOf<never>();
  const sources = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true });
  expect(Object.keys(sources).length).toBeGreaterThan(100);
  for (const [path, source] of Object.entries(sources)) {
    expect(source, path).not.toMatch(/player\.colliders|ColliderBridge/u);
  }
});
