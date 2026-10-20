import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { zlibSync } from 'fflate';
import { shapeBook } from '../src/game/models/shapeBook';
import * as geometry from '../src/game/plugin/geometry';
import type { SkyRig } from '../src/engine/world/skyRig';
import { legacyDouble } from './fake/FakeGame';

test('a harbour shares fresh packed and inline shapes with its own atlas labels', async () => {
  const bytes = new Uint8Array(new Float32Array([0, 0, 0, 2, 0, 0, 0, 3, 0]).buffer);
  const row = { attrs: [['position', 'f32', 3, false]], count: 3, index: null, indexCount: 0, box: true, expand: false };
  const data = btoa(String.fromCodePoint(...zlibSync(bytes))), atlas = btoa(String.fromCodePoint(...zlibSync(new Uint8Array(8))));
  const input = { binary: { url: '/assets/harbour/shapes.bin', bytes: bytes.length }, shapes: [{ key: 'boat', offset: 0, geometry: row }],
    inline: [{ key: 'letters', data, geometry: row }], labels: [{ key: 'pier', shape: 'letters', name: 'harbour-pier', width: 2, height: 1, data: atlas, rim: .6 }] };
  const read = vi.spyOn(geometry, 'fetchLaneBake').mockResolvedValueOnce(bytes);
  try {
    const book = shapeBook(input); expect(shapeBook(input)).toBe(book);
    expect(() => book.geometry('boat')).toThrow('not loaded');
    const inline = book.geometry('letters'); expect(inline.getAttribute('position').count).toBe(3);
    await book.load(); await book.load(); expect(read).toHaveBeenCalledTimes(1);
    const first = book.geometry('boat'), second = book.geometry('boat');
    expect(first).not.toBe(second); expect(first.boundingBox?.max.toArray()).toEqual([2, 3, 0]);
    const sky = legacyDouble<SkyRig>({ csm: legacyDouble<SkyRig['csm']>({ lights: [] }), sunDir: new Vector3(0, 1, 0), setupMaterial: () => undefined });
    const label = book.lettering(sky, 'pier'); expect(label.name).toBe('harbour-pier'); expect(label.receiveShadow).toBe(true);
    expect(() => book.geometry('absent')).toThrow('Missing');
    expect(() => shapeBook({ ...input, shapes: [...input.shapes, ...input.shapes] })).toThrow('Duplicate');
    for (const made of [inline, first, second, label.geometry]) made.dispose();
  } finally { read.mockRestore(); }
});


test('inline-only books never request a binary bake', async () => {
  const bytes = new Uint8Array(new Float32Array([0, 0, 0, 2, 0, 0, 0, 3, 0]).buffer);
  const geometryRow = { attrs: [['position', 'f32', 3, false]], count: 3, index: null, indexCount: 0, box: true, expand: false };
  const read = vi.spyOn(geometry, 'fetchLaneBake').mockRejectedValue(new Error('No binary exists'));
  try {
    const book = shapeBook({ binary: { url: 'inline', bytes: 0 }, shapes: [], labels: [],
      inline: [{ key: 'rider', data: btoa(String.fromCodePoint(...zlibSync(bytes))), geometry: geometryRow }] });
    await book.load(); await book.load(); expect(read).not.toHaveBeenCalled();
    const made = book.geometry('rider'); expect(made.boundingBox?.max.toArray()).toEqual([2, 3, 0]); made.dispose();
  } finally { read.mockRestore(); }
});
