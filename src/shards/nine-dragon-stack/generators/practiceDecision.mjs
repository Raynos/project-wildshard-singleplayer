import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync,writeFileSync } from 'node:fs';

/** Build-only room law; the emitted course rows carry the admitted stateless guest. */
export async function buildPracticeDecision() {
  const fields = ['phase','started','elapsed','best','checkpoint','startPad','finishPad','pad','eligible','now','x','y','z','startX','startZ','startWidth','startDepth','lowest','fallY'];
  const channels = ['phase','started','elapsed','best','checkpoint','visit','finish','fell'], signals = ['reset','step'];
  /** @param {string[]} names */
  const aliases = names => Object.fromEntries(names.map(name => [name,name]));
  /** @param {string[]} names */
  const registry = names => new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index) => [name,index+1]));
  const row = { id:'nine.practice',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/practice.as',
    binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
    reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
  const built = await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
    readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:256,singleSignal:true});
  const script=built.rows.at(0),blob=built.blobs.at(0);
  if(script===undefined||blob===undefined)throw new Error('Missing practice decision program');
  return {script,bytes:Buffer.from(blob.bytes).toString('base64')};
}
const target=new URL('../behaviour/practice.generated.json',import.meta.url);
const bytes=`${JSON.stringify(await buildPracticeDecision(),null,2)}\n`;
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==bytes)throw new Error('Practice decision program is stale');
} else writeFileSync(target,bytes);
console.info('nine-practice: compiled course rules with the standard 256-line author ceiling');
