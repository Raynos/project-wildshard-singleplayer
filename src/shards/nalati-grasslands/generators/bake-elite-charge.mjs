import { readFileSync, writeFileSync } from 'node:fs';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { parseSpawnScript, spawnScriptRegistries } from '@wildshard/format/spawnScripts';
import { fileURLToPath } from 'node:url';
import { charge } from './eliteCharge.ts';

const row = parseSpawnScript(charge);
const built = await compileDecisionScripts([row.script], spawnScriptRegistries(row), readDecisionSources(fileURLToPath(new URL('../', import.meta.url))), { asLineCeiling: 3184 });
const script = built.rows.at(0), blob = built.blobs.at(0);
if (script === undefined || blob === undefined) throw new Error('Missing captain program');
const compiled = {source: 'behaviour/elite-charge.generated.wasm', bytes: blob.bytes.length};
const output = `${JSON.stringify({ ...row, script, bytes: '', compiled }, null, 2)}\n`;
const modulePath = new URL('../behaviour/elite-charge.generated.wasm', import.meta.url);
if (process.argv.includes('--check')) { if (!readFileSync(modulePath).equals(Buffer.from(blob.bytes))) throw new Error('Captain module is stale'); }
else writeFileSync(modulePath, blob.bytes);
const path = new URL('../data/eliteCharge.generated.json', import.meta.url);
if (process.argv.includes('--check')) { if (readFileSync(path, 'utf8') !== output) throw new Error('Captain program is stale'); }
else writeFileSync(path, output);

// Night roster policy shares the existing ABI v1 return catalogue.
const { nightProgram } = await import('./nightProgram.mjs');
const night = `${JSON.stringify(await nightProgram())}\n`;
const nightPath = new URL('../data/night.generated.json', import.meta.url);
if (process.argv.includes('--check')) { if (readFileSync(nightPath, 'utf8') !== night) throw new Error('Night program is stale'); }
else writeFileSync(nightPath, night);
