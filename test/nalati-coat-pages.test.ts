// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the committed rigged hulls and coat pages.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed public files.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Native byte comparison avoids recursively visiting millions of PNG byte properties.
import { Buffer } from 'node:buffer';
import { expect, it } from 'vitest';
import { readImagePixels } from '@wildshard/sdk/bake/image';
import { produceNalatiCoats } from '../src/shards/nalati-grasslands/generators/coats';
import { nalatiCoatInputs } from '../scripts/bake/nalatiCoats.mjs';
import { readCoatFiles, writeCoatFiles } from '../scripts/bake/coatFiles.mjs';
import table from '../src/shards/nalati-grasslands/generators/bake-nalati-coats.json' with { type: 'json' };

const pub = (url: string): Uint8Array => new Uint8Array(readFileSync(resolve(import.meta.dirname, '../public', url.slice(1))));

for (const tier of ['phone', 'desktop'] as const) {
  it(`paints every ${tier} coat page exactly as the committed lossless page`, async () => {
    const coats = await produceNalatiCoats(url => Promise.resolve(pub(url)), tier, await nalatiCoatInputs());
    expect(coats.map(c => c.url).sort()).toEqual(Object.keys(table[tier]).sort());
    const root = mkdtempSync(resolve('tmp/nalati-coat-handoff-'));
    try {
      const manifest = resolve(root, `${tier}.json`);
      writeCoatFiles(manifest, coats);
      const handed = readCoatFiles(manifest);
      expect(handed.map(row => row.url)).toEqual(coats.map(row => row.url));
      for (const [index, coat] of coats.entries()) {
        const transferred = handed[index];
        if (transferred === undefined) throw new Error(`Missing coat handoff: ${coat.url}`);
        expect(transferred.png.length, coat.url).toBe(coat.png.length);
        expect(Buffer.compare(transferred.png, coat.png), coat.url).toBe(0);
        const committed = await readImagePixels(pub(coat.url));
        expect([committed.width, committed.height], coat.url).toEqual([coat.width, coat.height]);
        expect(committed.pixels.findIndex((v, i) => v !== coat.pixels[i]), coat.url).toBe(-1);
      }

    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
}
