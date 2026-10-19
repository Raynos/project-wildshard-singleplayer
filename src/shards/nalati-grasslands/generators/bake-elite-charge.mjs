import { readFileSync, writeFileSync } from 'node:fs';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { parseSpawnScript, spawnScriptRegistries } from '@wildshard/format/spawnScripts';
import { fileURLToPath } from 'node:url';
import { charge } from './eliteCharge.ts';

const row = parseSpawnScript(charge);
const built = await compileDecisionScripts([row.script], spawnScriptRegistries(row), readDecisionSources(fileURLToPath(new URL('../', import.meta.url))), { asLineCeiling: 2837 });
const script = built.rows.at(0), blob = built.blobs.at(0);
if (script === undefined || blob === undefined) throw new Error('Missing captain program');
const output = `${JSON.stringify({ ...row, script, bytes: Buffer.from(blob.bytes).toString('base64') }, null, 2)}\n`;
const path = new URL('../data/eliteCharge.generated.json', import.meta.url);
if (process.argv.includes('--check')) { if (readFileSync(path, 'utf8') !== output) throw new Error('Captain program is stale'); }
else writeFileSync(path, output);
