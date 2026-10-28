import { expect, test } from 'vitest';
import original from './fixtures/scene-source-author-original.json' with { type: 'json' };
import { sourceBlobs } from './fixtures/sunscar-source-program';
import { originalSkySceneInputs } from './fixtures/sky-scene-source';
import { skySourceBlobs, skyModelSource } from '../src/shards/far-reach/generators/sceneSources';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('owned scene source emitters retain all complete original library wires', async () => {
  const sky = await originalSkySceneInputs();
  const rows = [
    ...sourceBlobs.map(blob => ({ shard: 'sunscar', blob })),
    ...skySourceBlobs(sky.heroes).map(blob => ({ shard: 'sky', blob })),
    { shard: 'sky-owned', blob: skyModelSource('world/bridge.glb', 'world/mill.glb', 'world/fan.glb') },
  ].map(({ shard, blob }) => ({ shard, name: blob.file.name, bytes: blob.bytes.length, sha256: hashImmutableBytes(blob.bytes) }));
  expect(rows).toEqual(original);
});
