// Nalati's coat pages in plain Node, for scripts/bake-coats.mjs: the painter (src/shards/nalati-grasslands/generators/coats.ts)
// over the committed rigged hulls, with the shipping species rows' palettes and tints. No page, renderer or registry.
//   node --import ./scripts/bake-loader.mjs scripts/bake/nalatiCoats.mjs <phone|desktop> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import horseRows from '../../src/shards/nalati-grasslands/species/horse.json' with { type: 'json' };

const SHARD = '../../src/shards/nalati-grasslands';

/** The recoloured hulls use the same admitted variant facts as the body bake. */
export async function nalatiCoatInputs() {
  const [{ bodySpecies }, { default: wolfPalette }, { default: ecology }, { CREATURE_HULLS, nalatiCoatUrl }] = await Promise.all([
    import(`${SHARD}/generators/speciesRows.ts`), import(`${SHARD}/data/wolfPalette.json`, { with: { type: 'json' } }),
    import(`${SHARD}/data/ecology.generated.json`, { with: { type: 'json' } }), import(`${SHARD}/generators/riggedHulls.ts`)]);
  const rows = new Map(['horse', 'wolf', 'kokbori', ecology.argymaq].map(kind => [kind, bodySpecies(kind)]));
  return {
    specs: {
      'horse-wild': { palette: horseRows.palette, source: ['horse', 'dun'], keys: ['points', 'coat', 'belly'] },
      'horse-saddled': { palette: horseRows.palette, source: ['horse', 'camp-bay'], keys: ['points', 'coat', 'belly'], tack: true },
      wolf: { palette: wolfPalette, source: ['wolf', 'grey'], keys: ['back', 'side', 'cream'] },
    },
    hulls: CREATURE_HULLS,
    tint: (kind, variant) => {
      const row = rows.get(kind)?.variants.find(v => v.id === variant);
      if (row === undefined) throw new Error(`Nalati coat has no variant ${kind}:${variant}`);
      return row.tint;
    },
    url: nalatiCoatUrl,
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [tier, out] = process.argv.slice(2);
  if ((tier !== 'phone' && tier !== 'desktop') || process.argv.length !== 4) throw new Error('Usage: nalatiCoats.mjs <phone|desktop> <out.json>');
  const { produceNalatiCoats } = await import(`${SHARD}/generators/coats.ts`);
  const pub = resolve(import.meta.dirname, '../../public');
  const coats = await produceNalatiCoats(url => Promise.resolve(new Uint8Array(readFileSync(resolve(pub, url.slice(1))))), tier, await nalatiCoatInputs());
  writeFileSync(out, JSON.stringify(coats.map(c => ({ url: c.url, png: `data:image/png;base64,${Buffer.from(c.png).toString('base64')}` }))));
}
