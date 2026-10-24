// oxlint-disable-next-line import/no-nodejs-modules -- Verify the producer's emitted file closure against its generation catalogue without rebuilding it.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

test('Driftwood declares every emitted tile, Explorer template and named model blob', () => {
  const catalogue = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), outputs: v.array(v.string()) })) }), read('scripts/generation-jobs.json'));
  const producer = catalogue.jobs.find(job => job.id === 'driftwood-fixed-models');
  if (producer === undefined) throw new Error('Missing Driftwood fixed-model producer');
  const tiles = v.parse(v.object({ files: v.array(v.object({ hash: v.string() })) }), read('src/shards/driftwood-isle/data/fixedTiles.generated.json'));
  const models = v.parse(v.object({ blobs: v.array(v.object({ source: v.string() })) }), read('src/shards/driftwood-isle/data/fixedBlobs.generated.json'));
  const declared = new Set(producer.outputs);
  for (const file of tiles.files) expect(declared.has(`src/shards/driftwood-isle/assets/${file.hash}`), file.hash).toBe(true);
  for (const file of models.blobs) expect(declared.has(`src/shards/driftwood-isle/${file.source}`), file.source).toBe(true);
});
