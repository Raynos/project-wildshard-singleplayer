import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const names = ['candidates','away','draw','due','fixed','maximum','minimum','night','nocturnal','now','playerX','playerZ','water','x','z',
  'ground','awayDistance','distance','occupied','y','dead','alive','deadDt','delay','hidden'];
const channels = ['due','eligible','retry','x','z','index','score','perchH','dead','action'], signals = ['eligible','place','schedule','perchScore','perchHeight','practice'];
const aliases = (values) => Object.fromEntries(values.map(name => [name,name]));
const registry = (values) => new Map([...values].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const source = { id:'driftwood.returns',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/returns.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random','groundHeight','radial'],commands:['channel'],fields:aliases(names),channels:aliases(channels),signals:aliases(signals) };
const built = await compileDecisionScripts([source],{fields:registry(names),channels:registry(channels),signals:registry(signals)},
  readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:1716});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing return program');
const hash=hashImmutableBytes(blob.bytes),wasm=new URL('../behaviour/returns.generated.wasm',import.meta.url);
const bytes = `${JSON.stringify({script,bytes:'',compiled:{source:'behaviour/returns.generated.wasm',bytes:blob.bytes.length,hash}},null,2)}\n`;
const target = new URL('../behaviour/returns.generated.json',import.meta.url);
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==bytes)throw new Error('Return program is stale');
  if(!readFileSync(wasm).equals(blob.bytes))throw new Error('Return binary is stale');
} else {writeFileSync(wasm,blob.bytes);writeFileSync(target,bytes);}
console.info(`driftwood-returns: ${built.lines}/${built.ceiling} authored AS lines`);
