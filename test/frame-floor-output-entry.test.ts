import { afterEach, expect, test, vi } from 'vitest';
import { floorGridPortalPlan, readFloorGridEntryways, type FloorGridPlan } from '../scripts/frame-floor-grid.mjs';

afterEach(() => { vi.unstubAllGlobals(); });

test('follows the same authored portal with monolithic and sectioned output', async () => {
  const entryways = [{ edge: 'north', kind: 'portalLink', portal: {
    road: { id: 'road', at: [0, 0, 250] }, destination: { id: 'square', at: [0, 125, 20] },
    links: [{ from: 'road', to: 'square' }],
  } }];
  const bytes = new TextEncoder().encode(JSON.stringify({ entryways }));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  const section = { name: 'world/edge', path: 'sections/world/edge.json', schema: 'wildshard:world/edge@1', hash, bytes: bytes.length };
  let root: unknown = { entryways };
  vi.stubGlobal('location', { href: 'http://localhost/' });
  vi.stubGlobal('fetch', vi.fn((url: string | URL) => Promise.resolve(String(url).endsWith('sections/world/edge.json')
    ? new Response(bytes) : Response.json(root))));
  const path = '/shardfiles/nine-dragon-stack/shard.json';
  const cell = { instance: 'nine', slug: 'nine-dragon-stack', cell: [1, -1] as const };
  const plan: FloorGridPlan = { name: 'entry', from: null, to: 'nine', start: { x: 555, z: -277.5 },
    waypoints: [{ x: 555, z: -345 }], requiredResidents: ['nine'] };
  const monolithic = floorGridPortalPlan(plan, cell, await readFloorGridEntryways(path));
  root = { format: 'wildshard.shardfile', formatVersion: 2, sections: [section] };
  const split = floorGridPortalPlan(plan, cell, await readFloorGridEntryways(path));
  expect(split).toEqual(monolithic);
  expect(split.portal?.destination).toMatchObject({ x: 555, y: 125, z: -535 });
  expect(split.waypoints).toHaveLength(2);
  root = { format: 'wildshard.shardfile', formatVersion: 2, sections: [{ ...section, hash: '0'.repeat(64) }] };
  await expect(readFloorGridEntryways(path)).rejects.toThrow('hash mismatch');
  root = { format: 'wildshard.shardfile', formatVersion: 2, sections: [{ ...section, bytes: bytes.length + 1 }] };
  await expect(readFloorGridEntryways(path)).rejects.toThrow('size mismatch');
});
