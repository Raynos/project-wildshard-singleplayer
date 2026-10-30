import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { sourceBlobs as SIGNAL_SOURCE_BLOBS } from './fixtures/sunscar-source-program';
import { SIGNAL_SOURCE_LIBRARIES } from '../src/shards/sunscar-dunes/generators/sceneSources';

for (const [index, name] of [[0, 'models'], [1, 'bakes']] as const) {
  test(`Sunscar ${name} source names its own bytes and file cost`, () => {
    const blob = SIGNAL_SOURCE_BLOBS[index];
    if (blob === undefined) throw new Error('Missing original scene source');
    const bytes = blob.bytes.byteLength, hash = hashImmutableBytes(blob.bytes);
    expect(blob.file).toEqual({ name: `world/sources/${name}.json`, path: `blobs/json/${hash}.json`, kind: 'json', hash,
      compressed: bytes, decoded: bytes, gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: [] });
    expect(SIGNAL_SOURCE_LIBRARIES[index]).toEqual({ id: name, kind: name === 'models' ? 'models' : 'baked', file: `world/sources/${name}.json` });
  });
}
