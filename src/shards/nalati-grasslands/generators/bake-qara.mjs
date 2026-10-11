// Kept SDK-driven TypeScript generator; --check is a regenerate-and-compare guard.
// node --experimental-transform-types src/shards/nalati-grasslands/generators/bake-qara.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { generateQaraModule } from './qara.ts';

const source = new URL('../behaviour/qara.as', import.meta.url);
const output = new URL('../behaviour/qara.generated.json', import.meta.url);
const bytes = `${JSON.stringify(await generateQaraModule(readFileSync(source, 'utf8')), null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== bytes) throw new Error('Qara script is stale; run node --experimental-transform-types src/shards/nalati-grasslands/generators/bake-qara.mjs');
} else writeFileSync(output, bytes);
