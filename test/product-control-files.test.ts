import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { controlFiles, deferredFiles } from '../src/game/shardfile/controlFiles';

test('control transport keeps critical and library dependencies but leaves distant tiles declared', () => {
  const source = emptyShardfile({ slug: 'control-files', name: 'Control', author: 'Fixture', seed: 1, revision: 1 });
  const hashes = ['a', 'b', 'c', 'd'].map(value => value.repeat(64));
  const [critical, dependency, distant, shared] = hashes;
  if (critical === undefined || dependency === undefined || distant === undefined || shared === undefined) throw new Error('Missing fixture hash');
  source.files = hashes.map(hash => ({ hash, kind: 'binary', compressed: 4, decoded: 4, gpu: 0, triangles: 0, draws: 0,
    critical: false, dependencies: hash === critical ? [dependency] : [] }));
  source.critical = [critical]; source.library = [shared];
  const before = structuredClone(source);
  expect(controlFiles(source, source.files).map(file => file.hash)).toEqual([critical, dependency, shared]);
  expect(deferredFiles(source, source.files, new Set([critical, dependency, shared])).map(file => file.hash)).toEqual([distant]);
  expect(source).toStrictEqual(before);
  source.critical = ['e'.repeat(64)]; expect(() => controlFiles(source, source.files)).toThrow('not declared');
});

test('distant warming preserves nearest-first dependency order and keeps non-tile bytes last', () => {
  const source = emptyShardfile({ slug: 'control-order', name: 'Control', author: 'Fixture', seed: 1, revision: 1 });
  source.spawn = { x: 0, y: 0, z: 0, yaw: 0 };
  const near = 'a'.repeat(64), far = 'b'.repeat(64), dependency = 'c'.repeat(64), other = 'd'.repeat(64);
  source.files = [other, far, dependency, near].map(hash => ({ hash, kind: 'binary', compressed: 4, decoded: 4, gpu: 0, triangles: 0, draws: 0,
    critical: false, dependencies: hash === near ? [dependency] : [] }));
  for (const [x, hash] of [[0, near], [3, far]] as const) source.tiles.push({ lod: 0, x, z: 0, files: [hash], compressed: 4, decoded: 4, gpu: 0,
    draws: 1, triangles: 1, geometricError: 0, bounds: { min: [x * 62.5, 0, 0], max: [(x + 1) * 62.5, 0, 62.5] } });
  const ordered = deferredFiles(source, source.files, new Set()).map(file => file.hash);
  expect(ordered.indexOf(near)).toBeLessThan(ordered.indexOf(far));
  expect(ordered.indexOf(dependency)).toBeLessThan(ordered.indexOf(far));
  expect(ordered.at(-1)).toBe(other);
});
