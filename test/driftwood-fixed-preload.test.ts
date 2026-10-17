import { expect, it, vi } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { FIXED_DRAW_ROWS } from '../src/shards/driftwood-isle/generators/modelFiles';
import { driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { BoxGeometry } from 'three';
import { DRIFTWOOD_FIXED_SOURCES as FIXED_MODEL_FILES, DRIFTWOOD_ASSET_NAMES } from '../src/shards/driftwood-isle/generators/assets';
import { admitDriftwoodFixtureRows, admitDriftwoodFixtureAliases } from './fixtures/driftwoodRows';
import { loadFixedGeometry, fixedGeometryReady, PIER_GEOMETRIES, copyCoverGeometry, fixedDraw } from '../src/shards/driftwood-isle/runtime/boot/modelGeometry';

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
    const copies = [fixedDraw('wendellHead').copy(), fixedDraw('hat').copy(), fixedDraw('duneLogs').take(), ...Object.values(copyCoverGeometry())];
    for (const pier of PIER_GEOMETRIES.values()) { copies.push(pier.deck.copy()); if (pier.cloth !== null) copies.push(pier.cloth.copy()); }
    for (const copy of copies) { expect(copy.getAttribute('position').array.buffer).not.toBe(source.getAttribute('position').array.buffer); copy.dispose(); }
    expect(() => fixedDraw('duneLogs').copy()).toThrow('not loaded');
  } finally { fetch.mockRestore(); source.dispose(); }
});

it('admits the same 86 source declarations and every original channel alias', () => {
  admitDriftwoodFixtureRows();
  const rows = driftwoodRows('custom/fixedLayouts').fixedDraws;
  expect(rows).toEqual(FIXED_DRAW_ROWS);
  const ordered = [...rows].sort((a, b) => a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0);
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(ordered)))).toBe('a8e9cc646408329644ac4fddddb20bdf36ca1c1486058baeb65e76453e12ca4e');
});
