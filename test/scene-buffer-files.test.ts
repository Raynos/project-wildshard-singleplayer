// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, MeshBasicMaterial, Points, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { parseSceneBuffers } from '../src/format/sceneBuffers';
import { admitSceneBuffers, createSceneBuffers } from '../src/game/shardfile/sceneBuffers';
import { drawSceneRows, prepareSceneDrawRows } from '../src/game/shardfile/sceneDraws';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { portalLookRows } from '../src/shards/nine-dragon-stack/generators/portalLook';
import { portalPlanRows } from '../src/shards/nine-dragon-stack/generators/portalEntries';

const isPoints = (node: Object3D | undefined): node is Points => node instanceof Points;

const fixture = (byteLength = 24) => ({ version: 1,
  buffers: [{ id: 'p', storage: 'f32', file: 'channels/position.bin', byteLength }],
  attributes: [{ id: 'p', buffer: 'p', size: 3 }],
  geometries: [{ id: 'g', attributes: { position: 'p' } }],
  draws: [{ id: 'a', draw: { kind: 'points', geometry: 'g' } }, { id: 'b', draw: { kind: 'points', geometry: 'g' } }] });

test.each([false, true])('buffer admission overlaps bounded reads and drains a refused batch (%s)', async fail => {
  const names = Array.from({ length: 6 }, (_, i) => `channels/p${i}.bin`);
  const source = { ...fixture(12), buffers: names.map((file, i) => ({ id: i === 0 ? 'p' : `p${i}`, storage: 'f32', file, byteLength: 12 })) };
  const bytes = new Uint8Array(new Float32Array([0, -0, 1]).buffer);
  const pending = new Map<string, { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }>();
  const started: string[] = [];
  const product = createShardProduct({ slug: 'buffer-reads', revision: 1,
    shardfile: emptyShardfile({ slug: 'buffer-reads', name: 'Reads', author: 'Fixture', revision: 1, seed: 1 }), sections: new Map(),
    files: new Map(['scene.json', ...names].map(name => [name, { hash: name, url: name }])),
    read: name => {
      if (name === 'scene.json') return Promise.resolve(new TextEncoder().encode(JSON.stringify(source)));
      started.push(name);
      return new Promise<Uint8Array>((resolve, reject) => { pending.set(name, { resolve, reject }); });
    } });
  let settled = false;
  const admission = (async (): Promise<unknown> => {
    try { await prepareSceneDrawRows(product, [{ kind: 'buffered', file: 'scene.json', material: 'paint' }]); return null; }
    catch (error) { return error; }
    finally { settled = true; }
  })();
  await vi.waitFor(() => { expect(started).toEqual(names.slice(0, 4)); });
  for (const name of names.slice(0, 3)) {
    const read = pending.get(name); if (read === undefined) throw new Error('Missing pending read');
    if (fail && name === names[0]) read.reject(new Error('Refused verified words')); else read.resolve(bytes);
  }
  await Promise.resolve(); await Promise.resolve();
  expect(settled).toBe(false); expect(started).toHaveLength(4);
  const last = pending.get(names[3] ?? ''); if (last === undefined) throw new Error('Missing last batch read');
  last.resolve(bytes);
  if (fail) {
    const error = await admission;
    expect(error).toBeInstanceOf(Error); expect(String(error)).toContain('Refused verified words');
    expect(started).toHaveLength(4);
  } else {
    await vi.waitFor(() => { expect(started).toEqual(names); });
    for (const name of names.slice(4)) {
      const read = pending.get(name); if (read === undefined) throw new Error('Missing final read'); read.resolve(bytes);
    }
    expect(await admission).toBeNull();
  }
});

test('binary scene channels detach subviews, preserve words and share geometry', () => {
  const words = new Float32Array([99, 0, -0, 1, -1, 2 ** -149, 3, 99]);
  const bytes = new Uint8Array(words.buffer, 4, 24), files = new Map([['channels/position.bin', bytes]]);
  const row = admitSceneBuffers(fixture(), files), scope = new Scope('binary-scene'), material = new MeshBasicMaterial();
  try {
    const group = createSceneBuffers(row, material, scope, undefined, undefined, files), [a, b] = group.children;
    if (!isPoints(a) || !isPoints(b)) throw new Error('Missing binary draws');
    expect(a.geometry).toBe(b.geometry);
    const attribute = a.geometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) throw new Error('Missing binary position');
    expect(Array.from(attribute.array)).toEqual([0, -0, 1, -1, 2 ** -149, 3]);
    attribute.array[0] = 7;
    expect(words[1]).toBe(0);
    const dispose = vi.spyOn(a.geometry, 'dispose');
    scope.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  } finally { scope.dispose(); material.dispose(); }
});

test('binary admission refuses absent, crossed, oversized and invalid sources', () => {
  expect(() => admitSceneBuffers(fixture())).toThrow('Missing scene buffer binary file');
  expect(() => admitSceneBuffers(fixture(), new Map([['channels/position.bin', new Uint8Array(12)]]))).toThrow('binary length differs');
  expect(() => admitSceneBuffers(fixture(1), new Map([['channels/position.bin', new Uint8Array(1)]]))).toThrow('Misaligned scene buffer storage');
  expect(() => admitSceneBuffers(fixture(12), new Map([['channels/position.bin', new Uint8Array(new Float32Array([0, Infinity, 0]).buffer)]]))).toThrow('Nonfinite scene buffer');
  for (const patch of [{ bytes: 'AAAAAAAAAAAAAAAA' }, { file: '../escape.bin' }, { byteLength: 6_000_001 }, { byteLength: undefined }]) {
    const row = fixture();
    expect(() => parseSceneBuffers({ ...row, buffers: [{ ...row.buffers[0], ...patch }] })).toThrow();
  }
});

test('real portal binary dependencies retain all deterministic float32 words', async () => {
  const source = portalLookRows(), emitted = emitNamedBlobs(source.blobs);
  const descriptor = source.blobs.find(row => row.file.name === 'world/portals/sparks.json');
  if (descriptor === undefined) throw new Error('Missing portal descriptor');
  const row = parseSceneBuffers(JSON.parse(new TextDecoder().decode(descriptor.bytes)));
  const binary = source.blobs.filter(blob => blob.file.kind === 'bin');
  expect(descriptor.file.dependencies).toEqual(binary.map(blob => blob.file.hash));
  expect(row.buffers.every(buffer => buffer.bytes === undefined)).toBe(true);
  const product = (missing: boolean) => createShardProduct({ slug: 'binary-portals', revision: 1,
    shardfile: emptyShardfile({ slug: 'binary-portals', name: 'Portals', author: 'Fixture', revision: 1, seed: 1 }), sections: new Map(),
    files: new Map(emitted.files.flatMap(file => file.name === undefined || missing && file.kind === 'bin' ? [] : [[file.name, { hash: file.hash, url: file.hash }]])),
    read: hash => { const bytes = emitted.assets.get(hash); if (bytes === undefined) throw new Error('Missing verified blob'); return Promise.resolve(bytes); } });
  const draws = [{ kind: 'buffered', file: 'world/portals/sparks.json', material: 'paint' }];
  await expect(prepareSceneDrawRows(product(true), draws)).rejects.toThrow('Missing scene buffer binary file');
  const admitted = product(false); await prepareSceneDrawRows(admitted, draws);
  const scope = new Scope('portal-binary'), material = new MeshBasicMaterial(), parent = new Group();
  try {
    drawSceneRows(admitted, draws, parent, scope, new Map([['paint', material]]));
    const points = parent.children[0]?.children[0];
    if (!isPoints(points)) throw new Error('Missing portal points');
    const plan = portalPlanRows(), positions: number[] = [], across: number[] = [], seeds: number[] = [];
    for (const [i, p] of [...plan.decks, plan.square].entries()) for (let s = 0; s < 36; s++) {
      positions.push(p.x, p.y + plan.ring.lift, p.z); across.push(-p.nz, 0, p.nx);
      seeds.push((s * .618034 + i * .13) % 1, (s * .381966 + i * .29) % 1);
    }
    for (const [name, values] of [['position', positions], ['aAcross', across], ['aSeed', seeds]] as const) {
      expect(points.geometry.getAttribute(name).array).toEqual(Float32Array.from(values));
    }
    const bytes = binary.reduce((sum, blob) => sum + blob.bytes.length, 0);
    expect(bytes).toBe((positions.length + across.length + seeds.length) * 4);
    expect(bytes).toBe(5760);
    expect(binary.reduce((sum, blob) => sum + Math.ceil(blob.bytes.length / 3) * 4, 0)).toBe(7680);
  } finally { scope.dispose(); material.dispose(); }
});

test('packed binary ranges detach a subview and retain exact whole-file validation', () => {
  const words = new Float32Array([900, 99, 0, -0, 1, -1, 2 ** -149, 3, 99, 900]);
  const files = new Map([['channels/position.bin', new Uint8Array(words.buffer, 4, 32)]]);
  const input = fixture();
  const row = { ...input, buffers: input.buffers.map(buffer => ({ ...buffer, byteOffset: 4 })) };
  const scope = new Scope('packed-buffer'), material = new MeshBasicMaterial();
  try {
    const group = createSceneBuffers(row, material, scope, undefined, undefined, files), [a, b] = group.children;
    if (!isPoints(a) || !isPoints(b)) throw new Error('Missing packed range draws');
    expect(a.geometry).toBe(b.geometry);
    const position = a.geometry.getAttribute('position');
    expect(Array.from(position.array)).toEqual([0, -0, 1, -1, 2 ** -149, 3]);
    position.array[0] = 7; expect(words[2]).toBe(0);
    expect(() => admitSceneBuffers(input, files)).toThrow('binary length differs');
    for (const offset of [-1, 1, 1.5, 12, 36, 6000001]) {
      expect(() => admitSceneBuffers({ ...row, buffers: row.buffers.map(buffer => ({ ...buffer, byteOffset: offset })) }, files)).toThrow();
    }
    expect(() => admitSceneBuffers({ ...row, buffers: [{ id: 'p', storage: 'f32', bytes: 'AAAAAAAAAAAAAAAA', byteOffset: 0 }] }, files)).toThrow();
    expect(() => admitSceneBuffers({ ...row, buffers: [{ id: 'p', storage: 'f32', file: 'channels/position.bin', byteLength: 0, byteOffset: 32 }] }, files)).not.toThrow();
  } finally { scope.dispose(); material.dispose(); }
});

test.each([{ offset: 0, shared: false }, { offset: 1, shared: false }, { offset: 0, shared: true }])(
  'validation preserves construction rechecks and detached storage ($offset/$shared)', ({ offset, shared }) => {
    const backing = shared ? new SharedArrayBuffer(12 + offset) : new ArrayBuffer(12 + offset);
    const source = new Uint8Array(backing, offset, 12), words = new Float32Array([0, -0, 1]);
    source.set(new Uint8Array(words.buffer));
    const files = new Map([['channels/position.bin', source]]), admitted = admitSceneBuffers(fixture(12), files);
    const scope = new Scope('validated-buffer'), material = new MeshBasicMaterial();
    try {
      source.set(new Uint8Array(new Float32Array([Number.NaN, 0, 1]).buffer));
      expect(() => createSceneBuffers(admitted, material, scope, undefined, undefined, files)).toThrow('Nonfinite');
      source.set(new Uint8Array(words.buffer));
      const points = createSceneBuffers(admitted, material, scope, undefined, undefined, files).children[0];
      if (!isPoints(points)) throw new Error('Missing validated points');
      const geometry: unknown = points.geometry;
      if (!(geometry instanceof BufferGeometry)) throw new Error('Missing validated geometry');
      const position: unknown = geometry.getAttribute('position');
      if (!(position instanceof BufferAttribute)) throw new Error('Missing validated position');
      expect(Array.from(position.array)).toEqual([0, -0, 1]);
      expect(position.array.buffer).not.toBe(source.buffer);
    } finally { scope.dispose(); material.dispose(); }
  },
);
