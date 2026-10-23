import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// Nalati zero R6: the Storm Titan's whirlwind view module (behaviour/titanWhirlsView.as), compiled once for the product;
// the engine's view program runs it from its rows (generators/titanWhirlsView.ts, client plan view.program).
const source = readFileSync(new URL('../behaviour/titanWhirlsView.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 16384 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 16384, bytes: module.length, source: 'behaviour/titanWhirlsView.generated.wasm', module: `blobs/wasm/${Buffer.from(await crypto.subtle.digest('SHA-256', module)).toString('hex')}.wasm` }, null, 2)}\n`;
const target = new URL('../behaviour/titanWhirlsView.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Titan whirls view module is stale');
  if (!readFileSync(new URL('../behaviour/titanWhirlsView.generated.wasm', import.meta.url)).equals(module)) throw new Error('View binary is stale');
} else {
  writeFileSync(new URL('../behaviour/titanWhirlsView.generated.wasm', import.meta.url), module);
  writeFileSync(target, bytes);
}
console.info(`nalati-titan-whirls-view: ${module.length} bytes`);
