import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// G600 L8: the balbal and eagle view module (behaviour/creatureViews.as), compiled once for the product; the engine's view
// program runs it from its rows (generators/creatureViews.ts, client plan view.program).
const source = readFileSync(new URL('../behaviour/creatureViews.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 8192 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 8192, bytes: Buffer.from(module).toString('base64') }, null, 2)}\n`;
const target = new URL('../behaviour/creatureViews.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Creature view module is stale');
} else writeFileSync(target, bytes);
console.info(`nalati-creature-views: ${module.length} bytes`);
