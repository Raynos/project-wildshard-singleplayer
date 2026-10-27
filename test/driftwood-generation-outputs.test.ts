import { expect, test } from 'vitest';
import * as v from 'valibot';
import { driftwoodFixedBank } from './fixtures/driftwood-fixed-bank';

test('the defining Driftwood fixed bank owns every tile, template and named model blob', async () => {
  const files = await driftwoodFixedBank();
  const read = (name: string): unknown => {
    const bytes = files.get(name); if (bytes === undefined) throw new Error(`Missing fixed bank row: ${name}`);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  };
  const tiles = v.parse(v.object({ files: v.array(v.object({ hash: v.string() })) }), read('data/fixedTiles.generated.json'));
  const models = v.parse(v.object({ blobs: v.array(v.object({ source: v.string() })) }), read('data/fixedBlobs.generated.json'));
  for (const file of tiles.files) expect(files.has(`assets/${file.hash}`) || files.has(`owned/coarse/${file.hash}.glb`), file.hash).toBe(true);
  for (const file of models.blobs) expect(files.has(file.source.startsWith('../../..') ? `baked/fixed-models/${file.source.split('/').at(-1)}` : file.source), file.source).toBe(true);
});
