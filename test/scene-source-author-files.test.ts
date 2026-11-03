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

test('the sky sources pool each rope bridge as its deck, one rails mesh and one ties mesh', async () => {
  // 7f009ec7c2 / 4bca6b9eb1 merged a span's six top / mid / ties rails into ropes + ties; the golden's sky.json rows
  // moved by exactly that list (the pre-merge names restored reproduce the earlier bytes and hash), nothing else
  const sky = await originalSkySceneInputs();
  const spans = Array.from({ length: 9 }, (_, index) => [`bridge-${String(index)}-deck`, `bridge-${String(index)}-ropes`, `bridge-${String(index)}-ties`]).flat();
  const blobs = [...skySourceBlobs(sky.heroes).filter(blob => blob.file.name === 'world/sources/sky.json'), skyModelSource('world/bridge.glb', 'world/mill.glb', 'world/fan.glb')];
  for (const blob of blobs) {
    const text = new TextDecoder().decode(blob.bytes), at = text.indexOf('"bridge-0-deck"');
    const list: unknown = JSON.parse(text.slice(text.lastIndexOf('[', at), text.indexOf(']', at) + 1));
    expect(list).toEqual(spans);
  }
  expect(blobs).toHaveLength(2);
});
