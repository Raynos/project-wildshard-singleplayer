// Pine Hollow's coat pages in plain Node, for scripts/bake-coats.mjs: the coat producer
// (src/shards/pine-hollow/generators/coatProducer.ts) over the committed rigged hulls, each page keyed by its KTX2 table
// name. The Pine program paints the same pages as product files (generators/coatPages.ts). No page, renderer or registry.
//   node --import ./scripts/bake-loader.mjs scripts/bake/pineCoats.mjs <phone|desktop> <out.json>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeCoatFiles } from './coatFiles.mjs';
import { readImagePixels, writeImagePixels } from '../../src/sdk/bake/image.ts';

const [tier, out] = process.argv.slice(2);
if ((tier !== 'phone' && tier !== 'desktop') || out === undefined || process.argv.length !== 4) throw new Error('Usage: pineCoats.mjs <phone|desktop> <out.json>');
const { producePineCoats } = await import('../../src/shards/pine-hollow/generators/coatProducer.ts');
const pub = resolve(import.meta.dirname, '../../public');
const coats = await producePineCoats(url => Promise.resolve(new Uint8Array(readFileSync(resolve(pub, url.slice(1))))), tier, { read: readImagePixels, write: writeImagePixels });
writeCoatFiles(out, coats.map(coat => ({ url: coat.key, png: coat.png })));
