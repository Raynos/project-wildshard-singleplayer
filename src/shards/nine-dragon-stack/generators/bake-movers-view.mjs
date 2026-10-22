import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// G571 / H9: Nine Dragon's movers view module (behaviour/movers.as), compiled once for the product; the engine's view
// program runs it from its rows (engine/script/viewProgram, client plan view.program, generators/moversView.ts).
const source = readFileSync(new URL('../behaviour/movers.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 4096 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 4096, bytes: Buffer.from(module).toString('base64') }, null, 2)}\n`;
const target = new URL('../behaviour/movers.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Nine movers view module is stale');
} else writeFileSync(target, bytes);
console.info(`nine-movers-view: ${module.length} bytes`);
