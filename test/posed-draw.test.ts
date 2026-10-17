import { expect, test, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Texture } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import type { PosedAssetSet } from '@wildshard/game/plugin/geometry';
import { PosedDraw, PosedInstances } from '@wildshard/sdk/looks/posedInstances';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { parseAmbientFlock } from '@wildshard/format/ambientLife';
import { GULL_FLOCK } from '../src/shards/driftwood-isle/generators/gullsLook';
import { WILDLIFE_DRAW } from '../src/shards/pine-hollow/generators/wildlifeDraw';

const geometry = (): BufferGeometry => new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
const packed = (draw: PosedDraw | PosedInstances) => ({ matrix: [...draw.mesh.instanceMatrix.array],
  first: [...draw.mesh.geometry.getAttribute('aAnim').array], second: [...draw.mesh.geometry.getAttribute('aAnim2').array], count: draw.mesh.count });

test('Pine product packing preserves every matrix, pose lane and strict flight threshold', async () => {
  const source = geometry(), atlas = new Texture(), material = new MeshBasicMaterial(), disposals: (() => void)[] = [];
  const load = vi.fn<(input: unknown) => Promise<PosedAssetSet>>().mockResolvedValue({ geometry: source, atlas, ranges: WILDLIFE_DRAW.assets.ranges.map(row => ({ ...row, box: [0, 0, 0, 1, 1, 1] })) });
  const setParam = vi.fn<() => void>(), setTexture = vi.fn<() => void>();
  lendLooks({ onDispose: run => { disposals.push(run); } }, { materials: new Map([[WILDLIFE_DRAW.name, material]]), setParam, setTexture, bindMeshMap: () => material });
  const product = { url: (name: string) => `/test/posed-pine/${name}`, file: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(WILDLIFE_DRAW))) };
  try {
    const library = await PosedDraw.library(product, 'draw.json', load);
    expect(await PosedDraw.library(product, 'draw.json', load)).toBe(library);
    expect(load).not.toHaveBeenCalled();
    expect(() => library.draw(1)).toThrow('not loaded');
    await library.preload(); await library.preload();
    expect(load).toHaveBeenCalledTimes(1);
    const view = library.draw(2), old = new PosedInstances(2, WILDLIFE_DRAW.name, material, () => source, ['aAnim', 'aAnim2']), rng = new Rng(5613);
    expect(view.mesh.geometry.getAttribute('position')).toBe(source.getAttribute('position'));
    for (let i = 0; i < 1200; i++) {
      const p = { kind: [0, 1, 2, 4][i % 4] ?? 0, x: rng.range(-300, 300), y: rng.range(-5, 20), z: rng.range(-300, 300),
        yaw: rng.range(-3, 3), pitch: rng.range(-2, 2), roll: rng.range(-1, 1), scale: rng.range(0.3, 2),
        a0: rng.next(), a1: i % 3 === 0 ? 0.5 : rng.next(), a2: rng.next(), a3: rng.next(), b1: i % 2 === 0 ? 0.5 : rng.next(), b2: rng.next() };
      view.begin(); view.add(p); view.commit();
      old.begin(); old.add(p.x, p.y, p.z, p.pitch, p.yaw, p.roll, p.scale, p.a0, p.a1, p.a2, p.a3, p.kind, p.b1, p.b2, p.b1 > 0.5 || p.a1 < 0.5 ? 1 : 0); old.commit();
      expect(packed(view)).toEqual(packed(old));
    }
    view.glow.value = 0.8; view.glow.value = 0.8;
    expect(setParam.mock.calls).toEqual([[WILDLIFE_DRAW.name, 'glow', 0.8]]);
    expect(setTexture).toHaveBeenCalledWith(WILDLIFE_DRAW.name, 'atlas', atlas);
    expect(library.models).toHaveLength(4);
    expect(library.models.map(row => row.id)).toEqual(WILDLIFE_DRAW.models.map(row => row.id));
    view.begin(); view.commit(); expect(view.mesh.count).toBe(0);
    view.mesh.geometry.dispose(); old.mesh.geometry.dispose();
  } finally { disposals.forEach(run => { run(); }); source.dispose(); material.dispose(); atlas.dispose(); }
});

test('Driftwood flock uses the same data draw with its original scale and channels', () => {
  const row = parseAmbientFlock(GULL_FLOCK), source = geometry(), material = new MeshBasicMaterial(), second = row.channels[1];
  const attributes: readonly [string, string?] = row.attributes[1] === null ? [row.attributes[0]] : [row.attributes[0], row.attributes[1]];
  const draw = new PosedDraw({ name: 'gulls', attributes, channels: second === null ? [row.channels[0]] : [row.channels[0], second], scale: row.scale }, 2, source, material);
  const old = new PosedInstances(2, 'gulls', material, () => source, attributes);
  const p = { x: 12, y: 3, z: -7, pitch: 0.4, yaw: -0.2, roll: 0.6, scale: 9, flap: 0.3, fold: 0.8, head: -0.5, peck: 0.1, legs: 0.2, body: -0.7 };
  const read = (lane: (typeof row.channels)[0][number]): number => typeof lane === 'number' ? lane : p[lane];
  draw.begin(); draw.add(p); draw.commit();
  const [a] = row.channels;
  old.begin(); old.add(p.x, p.y, p.z, p.pitch, p.yaw, p.roll, row.scale, read(a[0]), read(a[1]), read(a[2]), read(a[3]), second === null ? 0 : read(second[0]), second === null ? 0 : read(second[1]), second === null ? 0 : read(second[2]), second === null ? 0 : read(second[3])); old.commit();
  expect([...draw.mesh.instanceMatrix.array]).toEqual([...old.mesh.instanceMatrix.array]);
  for (const attribute of attributes) if (attribute !== undefined) expect([...draw.mesh.geometry.getAttribute(attribute).array]).toEqual([...old.mesh.geometry.getAttribute(attribute).array]);
  draw.mesh.geometry.dispose(); old.mesh.geometry.dispose(); source.dispose(); material.dispose();
});
