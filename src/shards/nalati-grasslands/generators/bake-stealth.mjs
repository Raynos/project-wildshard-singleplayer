import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import profile from '../data/stealth.json' with {type:'json'};

const fields=['dt','blocked','grass','longGrass','on','off','inLong','inAfter','outAfter','forced','latched','toggle','sprint','jump','crouched','floor','low','high','count','px','pz','x','z','awareness','hunting','alert','sense','notice','quiet','practice','hiddenCover'];
const channels=['on','off','inLong','can','latched','cover','threat','x','z','state'];
const aliases=names=>Object.fromEntries(names.map(name=>[name,name]));
const registry=names=>new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const row={id:'nalati.stealth',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/stealth.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:{step:'step'}};
const built=await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(['step'])},new Map([['behaviour/stealth.as',readFileSync(new URL('../behaviour/stealth.as',import.meta.url),'utf8')]]),{asLineCeiling:100});
const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing stealth program');
const writer=byteWriter(process.argv.includes('--check'),'nalati-stealth');
writer.put(fileURLToPath(new URL('../data/stealth.generated.json',import.meta.url)),jsonBytes({...profile,program:{script,bytes:Buffer.from(blob.bytes).toString('base64')}}));writer.finish();
