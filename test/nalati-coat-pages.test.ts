// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the committed rigged hulls and coat pages.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed public files.
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { readImagePixels } from '@wildshard/sdk/bake/image';
import { produceNalatiCoats } from '../src/shards/nalati-grasslands/generators/coats';
import { nalatiCoatInputs } from '../scripts/bake/nalatiCoats.mjs';
import table from '../src/shards/nalati-grasslands/generators/bake-nalati-coats.json' with { type: 'json' };

const pub = (url: string): Uint8Array => new Uint8Array(readFileSync(resolve(import.meta.dirname, '../public', url.slice(1))));

for (const tier of ['phone', 'desktop'] as const) {
  it(`paints every ${tier} coat page exactly as the committed lossless page`, async () => {
    const coats = await produceNalatiCoats(url => Promise.resolve(pub(url)), tier, await nalatiCoatInputs());
    expect(coats.map(c => c.url).sort()).toEqual(Object.keys(table[tier]).sort());
    for (const coat of coats) {
      const committed = await readImagePixels(pub(coat.url));
      expect([committed.width, committed.height], coat.url).toEqual([coat.width, coat.height]);
      expect(committed.pixels.findIndex((v, i) => v !== coat.pixels[i]), coat.url).toBe(-1);
    }
  }, 60_000);
}
