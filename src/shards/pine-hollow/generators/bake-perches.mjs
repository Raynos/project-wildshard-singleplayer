import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pinePerches } from './perches.ts';

const root = resolve(import.meta.dirname, '../../../..');
const directory = resolve(root, 'public/assets/models/pine-hollow-trees');
const source = JSON.parse(readFileSync(resolve(directory, 'trees.json'), 'utf8'));
const rows = await pinePerches(new Uint8Array(readFileSync(resolve(directory, 'trees.glb'))), source.variants.map(row => row.name));
writeFileSync(resolve(root, 'src/shards/pine-hollow/data/perches.generated.json'), `${JSON.stringify(rows)}\n`);
console.log(JSON.stringify({variants: rows.spines.length, knots: rows.spines.reduce((sum, spine) => sum + spine.length, 0)}));
