// Deterministic static encounter data and geometry; all live fight/pose owners are retained.
import { fileURLToPath } from 'node:url';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import * as fight from './stormTitanFight.ts';
import { titanGeometry } from './stormTitanGeometry.ts';

const fields = ['radius','land','dt','phase','mode','t','cd','x','z','px','pz','chain','aim','lock','stuck','ax','az','x0','z0','x1','z1','theta','hit','lane','flank'];
const channels = ['left','mode','t','cd','x','z','strike','stuck','theta','hit','speed','turn','alpha','show','hurt'];
const signals = ['spear','rider','chain','chainLand'];
const aliases = names => Object.fromEntries(names.map(name => [name,name]));
const registry = names => new Map([...names].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const source = { id:'nalati.titan',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/titan.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
const built = await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
  readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing Titan decision program');

const writer = byteWriter(process.argv.includes('--check'), 'nalati-storm-titan');
writer.put(fileURLToPath(new URL('../data/stormTitanFight.generated.json', import.meta.url)), jsonBytes(fight));
writer.put(fileURLToPath(new URL('../data/stormTitanGeometry.generated.json', import.meta.url)), jsonBytes(titanGeometry(), 0));
writer.put(fileURLToPath(new URL('../behaviour/titan.generated.json', import.meta.url)), jsonBytes({script,bytes:Buffer.from(blob.bytes).toString('base64')}));
writer.finish();
