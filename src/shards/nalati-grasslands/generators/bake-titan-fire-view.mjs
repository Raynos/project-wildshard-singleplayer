import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// Nalati zero R6: the Storm Titan's grass-fire view module (behaviour/titanFireView.as), compiled once for the product;
// the engine's view program runs it from its rows (generators/titanFireView.ts, client plan view.program).
const source = readFileSync(new URL('../behaviour/titanFireView.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 81920, maximumPages: 3 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 3, ioBytes: 81920, bytes: module.length, source: 'behaviour/titanFireView.generated.wasm', module: `blobs/wasm/${Buffer.from(await crypto.subtle.digest('SHA-256', module)).toString('hex')}.wasm` }, null, 2)}\n`;
const target = new URL('../behaviour/titanFireView.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Titan fire view module is stale');
  if (!readFileSync(new URL('../behaviour/titanFireView.generated.wasm', import.meta.url)).equals(module)) throw new Error('View binary is stale');
} else {
  writeFileSync(new URL('../behaviour/titanFireView.generated.wasm', import.meta.url), module);
  writeFileSync(target, bytes);
}
console.info(`nalati-titan-fire-view: ${module.length} bytes`);
