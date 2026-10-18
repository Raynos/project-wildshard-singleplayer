import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const lead = JSON.parse(readFileSync(new URL('../data/questLead.json', import.meta.url), 'utf8'));
const fields = ['candidates','now','minimum','maximum','draw','scale','kill','arrival','harvest','site','visit','distance','reach','giveUp','present','night','combat',
  'heightBias','height','coverBias','cover','radius','clear','homeX','homeZ','x','z',
  'i','mode','elapsed','begin','dt','on','playerX','playerZ','atX','atZ'];
const channels = ['arrival','gather','remove','fade','dim','eligible','index','score','x','z','i','mode','elapsed','event'];
const signals = ['arrival','carcass','guide','shelterScore','shelterPlace','lead'];
const aliases = values => Object.fromEntries(values.map(name => [name,name]));
const registry = values => new Map([...values].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const row = { id:'pine.life', abi:'1.0', side:'sim', module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/life.as',
 binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{
 firstX:lead.path[0][0],firstZ:lead.path[0][1],lastX:lead.path.at(-1)[0],lastZ:lead.path.at(-1)[1],
 length:lead.path.length,first:lead.first,near:lead.near,past:lead.past,trot:lead.trot,gone:lead.gone},
 reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
const built = await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
 readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2130});
const script=built.rows.at(0),blob=built.blobs.at(0);
if(script===undefined||blob===undefined)throw new Error('Missing ambient program');
const bytes=`${JSON.stringify({script,bytes:Buffer.from(blob.bytes).toString('base64')},null,2)}\n`;
const target=new URL('../behaviour/life.generated.json',import.meta.url);
if(process.argv.includes('--check')) {if(readFileSync(target,'utf8')!==bytes)throw new Error('Ambient program is stale');}
else writeFileSync(target,bytes);
console.info(`pine-life: ${built.lines}/${built.ceiling} authored AS lines`);
