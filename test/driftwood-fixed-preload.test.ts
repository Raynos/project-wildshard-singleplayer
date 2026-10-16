import { expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/data/modelFiles';
import { loadFixedGeometry, fixedGeometryReady, WENDELL_HEAD_GEOMETRY, HAT_GEOMETRY, DUNE_LOGS_GEOMETRY, PIER_GEOMETRIES } from '../src/shards/driftwood-isle/runtime/boot/fixedGeometry';
import { copyCoverGeometry } from '../src/shards/driftwood-isle/runtime/boot/coverGeometry';

it('preloads fixed and cover handles from admitted geometry without fetching', async () => {
  const source = new BoxGeometry(), fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
  try {
    await loadFixedGeometry(new Map(Object.values(FIXED_MODEL_FILES).map(url => [url, source])));
    expect(fixedGeometryReady()).toBe(true); expect(fetch).not.toHaveBeenCalled();
    const copies = [WENDELL_HEAD_GEOMETRY.copy(), HAT_GEOMETRY.copy(), DUNE_LOGS_GEOMETRY.take(), ...Object.values(copyCoverGeometry())];
    for (const pier of PIER_GEOMETRIES.values()) { copies.push(pier.deck.copy()); if (pier.cloth !== null) copies.push(pier.cloth.copy()); }
    for (const copy of copies) { expect(copy.getAttribute('position').array.buffer).not.toBe(source.getAttribute('position').array.buffer); copy.dispose(); }
    expect(() => DUNE_LOGS_GEOMETRY.copy()).toThrow('not loaded');
  } finally { fetch.mockRestore(); source.dispose(); }
});
