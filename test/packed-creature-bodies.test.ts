import { zlibSync } from 'fflate';
import { afterAll, expect, test, vi } from 'vitest';
import { fetchBuildFile, packedCreatureBodies } from '../src/game/plugin/geometry';
import { practiceAssetUrl } from '../src/practiceAssets';

const file = `/assets/test/bodies-${'a'.repeat(64)}.bin`;
const row = () => ({ file, bytes: 36, bodies: [{ kind: 'bird', variant: 'small',
  bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }],
  dims: { bodyY: .5, bodyHalfLen: .5, bodyRadius: .2, headRadius: .1, legLen: .3, halfWidth: .2, feet: [[0, 0]], capsuleAxis: 'y' },
  fur: null, eye: null, hard: { offsets: [0], row: { attrs: [['position', 'f32', 3, false]], count: 3, index: null, indexCount: 0, box: false } } }] });
afterAll(() => { vi.unstubAllGlobals(); });

test('preloads once and gives each spawned body independent geometry, bones and feet', async () => {
  const bytes = zlibSync(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
  const fetcher = vi.fn(() => Promise.resolve(new Response(bytes)));
  vi.stubGlobal('fetch', fetcher);
  const bodies = packedCreatureBodies(row());
  expect(() => bodies.copy('bird', 'small')).toThrow('not loaded');
  await Promise.all([bodies.preload(), bodies.preload()]);
  const a = bodies.copy('bird', 'small'), b = bodies.copy('bird', 'small');
  const first = a.hardParts[0], second = b.hardParts[0];
  if (first === undefined || second === undefined) throw new Error('Missing body geometry');
  first.getAttribute('position').setX(0, 12);
  expect(second.getAttribute('position').getX(0)).toBe(0);
  expect(a.bones[0]).not.toBe(b.bones[0]); expect(a.dims.feet[0]).not.toBe(b.dims.feet[0]);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(() => bodies.copy('bird', 'missing')).toThrow('no baked creature body');
});

test('refuses unsafe paths, invalid metadata, failed fetches and mismatched payloads', async () => {
  expect(() => packedCreatureBodies({ ...row(), file: '/assets/../outside.bin' })).toThrow();
  const invalid = row(); const body = invalid.bodies[0];
  if (body === undefined) throw new Error('Missing row');
  body.hard.offsets[0] = 40;
  expect(() => packedCreatureBodies(invalid)).toThrow('exceeds its bake');
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 404 })));
  await expect(packedCreatureBodies(row()).preload()).rejects.toThrow('404');
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(zlibSync(new Uint8Array(4)))));
  const short = packedCreatureBodies(row()); await short.preload();
  expect(() => short.copy('bird', 'small')).toThrow('does not match');
});

test('accepts normalized contiguous parts with raw indices, draw groups and a lent decode', async () => {
  const raw = new Uint8Array(44);
  raw.set(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
  raw.set(new Uint8Array(new Uint16Array([0, 1, 2]).buffer), 36);
  const base = row(), body = base.bodies[0];
  if (body === undefined) throw new Error('Missing row');
  const part = { ...body.hard, offsets: [0, 36], indexEncoding: 'raw', groups: [[0, 3, 1]],
    row: { ...body.hard.row, index: 'u16', indexCount: 3 } };
  const input = { ...base, bytes: raw.length, bodies: [{ ...body, hard: [part, part] }] };
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([1]))));
  const bodies = packedCreatureBodies(input, () => raw); await bodies.preload();
  const parts = bodies.copy('bird', 'small').hardParts, first = parts[0], second = parts[1];
  if (first === undefined || second === undefined) throw new Error('Missing normalized parts');
  expect(first).not.toBe(second); expect(first.index?.getX(1)).toBe(1);
  expect(first.groups.some(group => group.materialIndex === 1)).toBe(true);
});


test('lends a mounted byte loader without weakening authored path admission', async () => {
  const bytes = zlibSync(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
  const fetcher = vi.fn(() => Promise.resolve(new Response(bytes)));
  vi.stubGlobal('fetch', fetcher);
  const load = vi.fn((url: string) => fetchBuildFile(practiceAssetUrl(url, 'https://example.test/practice/')));
  const bodies = packedCreatureBodies(row(), undefined, load);
  await Promise.all([bodies.preload(), bodies.preload()]);
  expect(load).toHaveBeenCalledExactlyOnceWith(file);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://example.test/practice${file}`);
  expect(bodies.copy('bird', 'small').hardParts[0]?.getAttribute('position').count).toBe(3);
  expect(() => packedCreatureBodies({ ...row(), file: `https://example.test${file}` }, undefined, load)).toThrow();
  expect(() => packedCreatureBodies({ ...row(), file: '/assets/../outside.bin' }, undefined, load)).toThrow();
  expect(load).toHaveBeenCalledOnce();
});
