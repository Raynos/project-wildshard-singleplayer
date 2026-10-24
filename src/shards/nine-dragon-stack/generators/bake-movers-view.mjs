import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { compileNineMovers } from './moversProgram.ts';

// G571 / H9: Nine Dragon's movers view module (behaviour/movers.as), compiled once for the product; the engine's view
// program runs it from its rows (engine/script/viewProgram, client plan view.program, generators/moversView.ts).
const source = new Uint8Array(readFileSync(new URL('../behaviour/movers.as', import.meta.url)));
const files = await compileNineMovers({ compileScriptV2 }, new Map([['behaviour/movers.as', source]]));
const module = files.get('movers.wasm');
if (module === undefined) throw new Error('Missing compiled Nine movers');
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 4096, bytes:'',compiled:{source:'behaviour/movers.generated.wasm',bytes:module.length,hash:hashImmutableBytes(module)} }, null, 2)}\n`;
const target = new URL('../behaviour/movers.generated.json', import.meta.url);
const wasm=new URL('../behaviour/movers.generated.wasm',import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Nine movers view module is stale');
  if(!readFileSync(wasm).equals(Buffer.from(module)))throw new Error('Nine movers binary is stale');
} else {writeFileSync(wasm,module);writeFileSync(target, bytes);}
console.info(`nine-movers-view: ${module.length} bytes`);
