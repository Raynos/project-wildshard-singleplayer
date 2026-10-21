// Bind a newly prepared milestone/soak receipt to its exact served dist before committing it.
import { readFileSync, writeFileSync } from 'node:fs';
import { gridRuntimeBinding } from './grid-runtime-keys.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = arg('receipt'), products = arg('products'), output = arg('out');
if (!input || !products || !output || input === output) throw new Error('Requires --receipt=FILE --products=EXACT-DIST/shardfiles --out=NEW-FILE');
const receipt = JSON.parse(readFileSync(input, 'utf8'));
const revision = receipt.source ?? receipt.sha;
const contentKeys = gridRuntimeBinding(process.cwd(), revision, products);
writeFileSync(output, `${JSON.stringify({ ...receipt, contentKeys }, null, 2)}\n`, { flag: 'wx' });
