import { expect, test } from 'vitest';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { emptyShardfile } from '../src/sharddev/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import type { ProjectGenerationContext } from '../src/sharddev/projectGeneration';
import { controlFiles, lateFiles } from '../src/game/client/shardfile/controlFiles';
import { driftwoodPhysicsOwnedSources, driftwoodPhysicsSources, driftwoodPhysicsFloor, driftwoodProofLateRoots } from '../src/shards/driftwood-isle/generators/physics';

const bytes = fixtureBytes(new URL('../src/shards/driftwood-isle/data/physics-colliders.bin', import.meta.url));
const sources = driftwoodPhysicsSources();
const cached: ProjectGenerationContext['cached'] = (step, generate) => {
  expect(step.inputs).toEqual(sources.map(row => row.source));
  return Promise.resolve(generate(new Map(sources.map(row => [row.source, bytes]))));
};

test('owned proof hull publication keeps original bytes, names and decoded charges', async () => {
  const owned = await driftwoodPhysicsOwnedSources({ cached });
  expect(owned.files).toHaveLength(sources.length);
  for (const source of sources) {
    const file = owned.files.find(row => row.name === source.name);
    expect(file).toMatchObject({ hash: hashImmutableBytes(bytes), compressed: bytes.length, decoded: source.options.decoded, gpu: 0, draws: 0, triangles: 0, dependencies: [] });
    expect(owned.assets.get(hashImmutableBytes(bytes))).toEqual(bytes);
  }
});

test('proof timing excludes the entire family but critical and dependency readers win', async () => {
  const owned = await driftwoodPhysicsOwnedSources({ cached });
  const files = [driftwoodPhysicsFloor().file, ...owned.files];
  const source = emptyShardfile({ slug: 'proof-bank', name: 'Proof', author: 'Fixture', seed: 1, revision: 1 });
  source.files = files.map(row => ({ ...row, kind: row.kind === 'bin' || row.kind === 'tile' ? 'binary' : row.kind }));
  source.library = files.map(row => row.hash);
  source.late = driftwoodProofLateRoots(files);
  expect(source.late).toHaveLength(2);
  expect(controlFiles(source, source.files)).toEqual([]);
  expect(lateFiles(source, source.files).map(row => row.hash)).toEqual(source.library);
  const floor = source.files[0], hull = source.files[1];
  if (hull === undefined || floor === undefined) throw new Error('Missing proof fixture');
  source.critical.push(hull.hash); hull.dependencies.push(floor.hash);
  expect(controlFiles(source, source.files).map(row => row.hash)).toEqual([floor.hash, hull.hash]);
  expect(lateFiles(source, source.files).map(row => row.hash)).toEqual([]);
  expect(() => driftwoodProofLateRoots(files.filter(row => row.name !== 'data/physics-ground.generated.bin'))).toThrow('Missing Driftwood proof file');
});

test('missing tracked hull inputs refuse rather than minting a late-file pin', async () => {
  const missing: ProjectGenerationContext['cached'] = (_step, generate) => Promise.resolve(generate(new Map()));
  await expect(driftwoodPhysicsOwnedSources({ cached: missing })).rejects.toThrow('proof hull inventory differs');
});


test('unexpected or empty hull inputs refuse before owned publication', async () => {
  for (const inputs of [new Map([['unexpected.bin', bytes]]), new Map(sources.map(row => [row.source, new Uint8Array()]))]) {
    const invalid: ProjectGenerationContext['cached'] = (_step, generate) => Promise.resolve(generate(inputs));
    await expect(driftwoodPhysicsOwnedSources({ cached: invalid })).rejects.toThrow('proof hull inventory differs');
  }
});
