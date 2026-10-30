// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed map inputs.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NALATI_MAP_INPUTS, nalatiMapPixels } from '../src/shards/nalati-grasslands/generators/mapProgram';

const bank = new Map(NALATI_MAP_INPUTS.map(name => [name, new Uint8Array(readFileSync(name.startsWith('/') ? `public${name}` : `src/shards/nalati-grasslands/${name}`))]));

test('the map program refuses an undeclared input', async () => {
  for (const omitted of ['data/campMaterials.json', '/assets/nalati/baked/crags.bin']) {
    const missing = new Map(bank); missing.delete(omitted);
    await expect(nalatiMapPixels(missing), omitted).rejects.toThrow('Undeclared Nalati map input');
  }
});
