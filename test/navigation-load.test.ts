// oxlint-disable-next-line import/no-nodejs-modules -- Read the retained immutable navigation fixture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Independent immutable hash witness.
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { describeNavigation } from '@wildshard/format/navigation';
import { loadNavmesh, setActiveNavmesh } from '../src/engine/physics/navmeshLoad';

const bytes = new Uint8Array(readFileSync('public/assets/baked/far-reach/navmesh.bin'));
const row = describeNavigation(createHash('sha256').update(bytes).digest('hex'), bytes);
afterEach(() => { vi.restoreAllMocks(); setActiveNavmesh('navigation-fixture', null); });

it('loads admitted navigation bytes without a private-folder lookup', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const nav = await loadNavmesh('navigation-fixture', 'unused', { row, bytes });
  expect(nav?.layers.map(layer => layer.radius)).toEqual(row.layers.map(layer => layer.radius));
  expect(fetch).not.toHaveBeenCalled();
});

it('requires exact declared navigation bytes and refuses unavailable or mismatched transport', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
  await expect(loadNavmesh('navigation-fixture', 'unused', { row, url: '/immutable/nav' })).rejects.toThrow(/unavailable/);
  await expect(loadNavmesh('navigation-fixture', 'unused', { row: { ...row, file: '0'.repeat(64) }, bytes })).rejects.toThrow(/hash/);
  await expect(loadNavmesh('navigation-fixture', 'unused', { row: { ...row, bounds: [0, 0, 0, 1, 1, 1] }, bytes })).rejects.toThrow(/declaration/);
});
