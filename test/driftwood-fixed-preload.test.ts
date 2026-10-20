import geometry from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { expect, it, vi } from 'vitest';
import { FIXED_DRAW_ROWS } from '../src/shards/driftwood-isle/generators/modelFiles';
import { driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { BoxGeometry } from 'three';
import { DRIFTWOOD_FIXED_SOURCES as FIXED_MODEL_FILES, DRIFTWOOD_ASSET_NAMES } from '../src/shards/driftwood-isle/generators/assets';
import { admitDriftwoodFixtureRows, admitDriftwoodFixtureAliases } from './fixtures/driftwoodRows';
import { loadFixedGeometry, fixedGeometryReady, fixedDraw } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';

it('declares inert handles before admission and refuses unresolved slot data', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
  try {
    await expect(loadFixedGeometry(new Map())).rejects.toThrow('before its product is admitted');
    expect(fixedGeometryReady()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});

it('refuses a replaced slot before template intake or URL fallback', async () => {
  const aliases = { ...DRIFTWOOD_ASSET_NAMES }, fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
  delete aliases['fixed:hat']; aliases['fixed:unowned'] = 'models/fixed/hat.glb';
  admitDriftwoodFixtureAliases(aliases);
  try {
    await expect(loadFixedGeometry(new Map())).rejects.toThrow('Undeclared fixed draw slots');
    expect(fixedGeometryReady()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); admitDriftwoodFixtureRows(); }
});

it('preloads fixed and cover handles from admitted geometry without fetching', async () => {
  admitDriftwoodFixtureRows();
  const source = new BoxGeometry(), fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
  try {
    await expect(loadFixedGeometry(new Map())).rejects.toThrow('Missing Driftwood source draw');
    await loadFixedGeometry(new Map(Object.values(FIXED_MODEL_FILES).map(url => [url, source])));
    expect(fixedGeometryReady()).toBe(true);
    await fixedDraw('wendellHead').load();
    expect(fetch).not.toHaveBeenCalled();
    const copies = [fixedDraw('wendellHead').copy(), fixedDraw('hat').copy(), fixedDraw('duneLogs').take(), ...Object.values(geometry.groups.cover).map(slot => fixedDraw(slot).copy())];
    for (const pier of Object.values(geometry.groups.piers)) { copies.push(fixedDraw(pier.deck).copy()); if (pier.cloth !== null) copies.push(fixedDraw(pier.cloth).copy()); }
    for (const copy of copies) { expect(copy.getAttribute('position').array.buffer).not.toBe(source.getAttribute('position').array.buffer); copy.dispose(); }
    expect(() => fixedDraw('duneLogs').copy()).toThrow('not loaded');
  } finally { fetch.mockRestore(); source.dispose(); }
});

it('admits the original source declarations plus native bridge units and every original channel alias', () => {
  admitDriftwoodFixtureRows();
  const rows = driftwoodRows('custom/fixedLayouts').fixedDraws;
  expect(rows).toEqual(FIXED_DRAW_ROWS);
  const original = rows.filter(row => !['bridgePlankUnit', 'bridgeRopeUnit'].includes(row.slot));
  expect(rows).toHaveLength(original.length + 2);
});
