import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const names = ['away','draw','due','fixed','maximum','minimum','night','nocturnal','now','playerX','playerZ','water','x','z'];
const channels = ['due','eligible','retry','x','z'], signals = ['eligible','place','schedule'];
const aliases = (values) => Object.fromEntries(values.map(name => [name,name]));
const registry = (values) => new Map([...values].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const source = { id:'driftwood.returns',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/returns.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random','groundHeight','radial'],commands:['channel'],fields:aliases(names),channels:aliases(channels),signals:aliases(signals) };
const built = await compileDecisionScripts([source],{fields:registry(names),channels:registry(channels),signals:registry(signals)},
  readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:1716});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing return program');
const bytes = `${JSON.stringify({script,bytes:Buffer.from(blob.bytes).toString('base64')},null,2)}\n`;
const target = new URL('../behaviour/returns.generated.json',import.meta.url);
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==bytes)throw new Error('Return program is stale');
} else writeFileSync(target,bytes);
console.info(`driftwood-returns: ${built.lines}/${built.ceiling} authored AS lines`);
