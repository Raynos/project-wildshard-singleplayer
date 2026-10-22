import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { readFileSync, writeFileSync } from 'node:fs';

// G571 / H9: the rope bridge's camera sway view module (behaviour/bridgeSway.as), compiled once for the product; the
// game's deck camera sway host admits and runs it (game/systems/looks/deckCameraSway).
const source = readFileSync(new URL('../behaviour/bridgeSway.as', import.meta.url), 'utf8');
const module = await compileScriptV2(source, { lane: 'view', ioBytes: 4096 });
const bytes = `${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 4096, bytes: Buffer.from(module).toString('base64') }, null, 2)}\n`;
const target = new URL('../behaviour/bridgeSway.generated.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== bytes) throw new Error('Bridge sway view module is stale');
} else writeFileSync(target, bytes);
console.info(`driftwood-bridge-sway: ${module.length} bytes`);
