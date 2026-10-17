// Author-only v1 population script producer; no runtime or legacy evaluator.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { spawnScriptRegistries } from '@wildshard/format/spawnScripts';
import { NIGHT_SPAWN } from './nightSpawn.ts';

const root=resolve(import.meta.dirname,'../../../..'),project='src/shards/pine-hollow';
const built=await compileDecisionScripts([NIGHT_SPAWN.script],spawnScriptRegistries(NIGHT_SPAWN),new Map([['behaviour/night.as',readFileSync(resolve(root,project,'behaviour/night.as'),'utf8')]]),{asLineCeiling:2130});
const script=built.rows[0],blob=built.blobs[0];

const bytes=blob.bytes;
const output=`${JSON.stringify({...NIGHT_SPAWN,script,bytes:Buffer.from(bytes).toString('base64')},null,2)}\n`;
const path=resolve(root,project,'behaviour/night.generated.json');
if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==output)throw new Error('Pine night v1 output stale');}
else { writeFileSync(path,output); writeFileSync(resolve(root,project,'assets',blob.file.hash),bytes); }
console.info(`Pine night v1: ${built.lines} AS lines, ${bytes.length} Wasm bytes`);
