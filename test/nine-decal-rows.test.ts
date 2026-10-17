import { expect, test } from 'vitest';
import { paintSteps, type CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';
import decals from '../src/shards/nine-dragon-stack/data/decals.json' with { type: 'json' };

// Captured from the executable rows at fe0386a05 before their JSON migration.
// Recording the painter's calls covers seeded fibre, paths, fonts and ordering.
test.each([
  ['Jian', decals.JIAN_DECALS, 3066, '46d1839d7dc97638ec28fcd64e9f18b409ec07e9d04093b73378dd07d7d7a337'],
  ['hero', decals.HERO_DECALS, 205, '3038baaa7816e5ec96a3a5d872498f7570dcf96dc992a38074d5839068656660'],
] as const)('%s JSON retains every native canvas call', async (_name, row, count, digest) => {
  const calls: unknown[][] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, property) => (...args: readonly unknown[]) => {
      calls.push(['call', property, ...args]);
      return { addColorStop: (...stops: readonly unknown[]) => { calls.push(['stop', ...stops]); } };
    },
    set: (_target, property, value: unknown) => {
      calls.push(['set', property, value]);
      return true;
    },
  });
  paintSteps(context, (row as CanvasAtlasRow).steps);
  expect(calls).toHaveLength(count);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(calls))));
  expect(Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')).toBe(digest);
});

test('decal dimensions and UV cells retain their authored frames', () => {
  expect([decals.JIAN_DECALS.w, decals.JIAN_DECALS.h]).toEqual([2048, 1024]);
  expect([decals.HERO_DECALS.w, decals.HERO_DECALS.h]).toEqual([1024, 512]);
  for (const uv of [decals.JIAN_DECAL_UV, decals.HERO_DECAL_UV]) {
    expect(uv).toEqual({ etch: [0, 0.75, 1, 1], fu: [0, 0, 0.1875, 0.75] });
  }
});
