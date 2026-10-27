import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { controlFiles, lateFiles } from '../src/game/shardfile/controlFiles';
import { nalatiLatePaintedNames } from '../src/shards/nalati-grasslands/generators/modelBindings';

test('painted alternative hints keep critical and shared dependency overrides', () => {
  const names = ['large.glb', 'small.glb', 'large.ktx2', 'small.ktx2'].map(name => `models/painted/${name}`);
  const entries = names.map((name, index) => ({ name, hash: String(index + 1).repeat(64), kind: 'binary' as const,
    compressed: 7, decoded: 7, gpu: 0, triangles: 0, draws: 0, critical: index === 0, dependencies: [] as string[] }));
  const [large, small, fullAtlas, phoneAtlas] = entries;
  if (large === undefined || small === undefined || fullAtlas === undefined || phoneAtlas === undefined) throw new Error('Missing test entry');
  const owned = (entry: typeof large) => ({ file: entry.name, bytes: entry.compressed });
  const late = nalatiLatePaintedNames({ url: owned(large), phoneUrl: owned(small), atlas: owned(fullAtlas), phoneAtlas: owned(phoneAtlas) });
  const source = emptyShardfile({ slug: 'painted-late', name: 'Painted', author: 'Fixture', seed: 1, revision: 1 });
  source.files = entries; source.library = entries.map(row => row.hash); source.critical = [large.hash];
  source.late = late.map(name => {
    const file = entries.find(row => row.name === name); if (file === undefined) throw new Error('Missing late source');
    return { hash: file.hash };
  });
  const before = structuredClone(source);
  expect(controlFiles(source, entries).map(row => row.hash)).toEqual([large.hash, small.hash, phoneAtlas.hash]);
  expect(lateFiles(source, entries).map(row => row.hash)).toEqual([fullAtlas.hash]);
  expect(source).toStrictEqual(before);
  large.dependencies.push(fullAtlas.hash);
  expect(controlFiles(source, entries)).toEqual(entries);
  expect(lateFiles(source, entries)).toEqual([]);
});
