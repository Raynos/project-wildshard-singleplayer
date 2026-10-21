import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileDecisionScripts} from '@wildshard/sdk/buildDecisionScripts';
import {byteWriter} from '../../../../scripts/bake-output.mjs';
import {CONTRACT_PROGRAM_SCRIPT,contractProgramRegistries} from './contractProgram.ts';

const sources=new Map(['contracts','contractsRandom','contractsRules'].map(name=>[`behaviour/${name}.as`,readFileSync(new URL(`../behaviour/${name}.as`,import.meta.url),'utf8')]));
const built=await compileDecisionScripts([CONTRACT_PROGRAM_SCRIPT],contractProgramRegistries(),sources,{asLineCeiling:256,singleSignal:true}),script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing compiled contract programme');
const writer=byteWriter(process.argv.includes('--check'),'pine-contract-program');
writer.put(fileURLToPath(new URL('../data/contractsProgram.generated.json',import.meta.url)),`${JSON.stringify({script,bytes:Buffer.from(blob.bytes).toString('base64')})}\n`);
writer.finish();
console.info(`Pine contract guest: ${built.lines} authored AS lines / ${blob.bytes.length} Wasm bytes`);
