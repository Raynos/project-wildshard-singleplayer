import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group } from 'three';
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import { captureScatterSource } from '../src/engine/render/scatterInstances';
import { SceneDressing, readSceneNumericTable } from '../src/game/shardfile/sceneDressing';
import type { ShardContext } from '../src/game/plugin/context';
import { join, writeGeometry } from '../src/shards/nalati-grasslands/generators/geometryWriter';

function table(rows: readonly Record<string, number>[]): Uint8Array {
  const keys = Object.keys(rows[0] ?? {}), header = new TextEncoder().encode(keys.join('\0'));
  const bytes = new Uint8Array(16 + header.length + rows.length * keys.length * 8), view = new DataView(bytes.buffer);
  [0x3150444e, rows.length, keys.length, header.length].forEach((value, i) => { view.setUint32(i * 4, value, true); });
  bytes.set(header, 16);
  rows.forEach((row, i) => { keys.forEach((key, column) => {
    const value = row[key]; if (value === undefined) throw new Error('Missing test column');
    view.setFloat64(16 + header.length + (i * keys.length + column) * 8, value, true);
  }); });
  return bytes;
}

test('numeric tables retain exact float64 values, key order and refusal bounds', () => {
  const rows = [{ x: -0, y: 1 / 3, Constructor: Number.MAX_VALUE }, { x: 1.125, y: -17.25, Constructor: Number.MIN_VALUE }];
  const bytes = table(rows), original = bytes.slice();
  expect(readSceneNumericTable(bytes)).toEqual(rows);
  expect(Object.is(readSceneNumericTable(bytes)[0]?.['x'], -0)).toBe(true);
  expect(Object.keys(readSceneNumericTable(bytes)[0] ?? {})).toEqual(Object.keys(rows[0] ?? {}));
  expect(bytes).toEqual(original);
  for (const broken of [bytes.subarray(1), bytes.subarray(0, -1), table([{ x: Infinity }]), table([{ x: Number.NaN }]), table([{ bad_key: 1 }])]) {
    expect(() => readSceneNumericTable(broken)).toThrow();
  }
});

test('sliced binary scatter retains selection and rejects a late excluded invalid row before drawing', async () => {
  const rows = Array.from({ length: 514 }, (_, i) => ({ x: i / 2, y: i % 4, z: -i / 8, yaw: 0, sx: 1, sy: 1, sz: 1, far: 90, r: 1, g: .5, b: .25, solid: 1 }));
  const source = new BoxGeometry(1, 1, 1); source.clearGroups();
  const blocks: Uint8Array[] = [], geometry = writeGeometry(source, blocks, 'numeric-scatter'); source.dispose();
  let binary = ''; for (const byte of zlibSync(join(blocks))) binary += String.fromCodePoint(byte);
  for (const invalid of [false, true]) {
    const scope = new Scope('numeric-scatter'), registry = new WorldRegistry(), root = new Group();
    const input = rows.slice(), last = input[513];
    if (invalid && last !== undefined) input[513] = { ...last, solid: 2 };
    const bytes = table(input);
    const file = vi.fn().mockResolvedValue(bytes), json = vi.fn(), ctx = {} as ShardContext;
    Object.assign(ctx, { scope, root, system: vi.fn(), app: { registry }, product: { slug: 'numeric-fixture', hasFile: () => true, file, json }, game: { runtime: { world: { sky: null } } } });
    const model = `fixture/numeric-${String(invalid)}`;
    const dressing = { name: 'numeric', catalogues: [], packs: {}, geometry: { shape: { kind: 'inline', data: btoa(binary), row: geometry } }, materials: { paint: { kind: 'painterly', rim: .2, bands: .5 } },
      staticModels: [{ model: { id: model, name: 'Numeric', file: 'test/scene-numeric-table.test.ts', category: 'props', pipeline: 'code', defaults: {} }, geometry: 'shape', material: 'paint' }],
      layers: [{ id: 'numeric', model, geometry: 'shape', material: 'paint', file: 'poses.bin', binary: true, far: 1, castShadow: false, keepNear: 26, contacts: [], select: { modulo: 2, remainder: 0, equal: true } }], statics: [], animations: [] };
    try {
      if (invalid) {
        await expect(SceneDressing.install(ctx, dressing)).rejects.toThrow();
        expect(root.children).toHaveLength(0);
      } else {
        const owner = await SceneDressing.install(ctx, dressing), layer = owner.layers[0];
        if (layer === undefined) throw new Error('Missing binary scatter layer');
        const captured = captureScatterSource(layer.mesh);
        if (captured === undefined) throw new Error('Missing original scatter channels');
        expect(captured.count).toBe(257);
        for (let i = 0; i < captured.count; i++) {
          expect(Array.from(captured.matrices.subarray(i * 16 + 12, i * 16 + 15))).toEqual([i, (i * 2) % 4, -i / 4]);
          expect(Array.from(captured.colours.subarray(i * 3, i * 3 + 3))).toEqual([1, .5, .25]);
        }
        expect(owner.placed[0]?.copies).toBe(257);
      }
      expect(file).toHaveBeenCalledOnce(); expect(json).not.toHaveBeenCalled();
    } finally { scope.dispose(); }
  }
});
