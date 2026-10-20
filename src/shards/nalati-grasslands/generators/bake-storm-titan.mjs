// Deterministic static encounter data and geometry; all live fight/pose owners are retained.
import { fileURLToPath } from 'node:url';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import * as fight from './stormTitanFight.ts';
import { titanGeometry, titanBodyRows, titanPoseRows, titanArenaRows, titanFightPoseRows } from './stormTitanGeometry.ts';

const fields = ['radius','land','dt','phase','mode','t','cd','x','z','px','pz','chain','aim','lock','stuck','ax','az','x0','z0','x1','z1','theta','hit','lane','flank','broke','index','cy','wx','wz','vx','vz','cx','cz','count','spread','burn','hp','chip','invuln','stun','fullDraw','fullDrawMul','amount','open','fighting','tied','mounted','storm','engaged','sealed','armed','victory','wall','ex','ey','ez','facing','inside','volume','corridor','sand','floor','y'];
const channels = ['spread','radius','left','mode','t','cd','x','z','strike','stuck','theta','hit','speed','turn','alpha','show','hurt','mask','burn','hp','open','broke','index','x0','z0','x1','z1','vx','vz','wall','arm','disarm','clear','label','enter','exit','slow'];
const signals = ['spearResolve','phaseEntry','arenaState','tie','supportDamage','fieldClock','fieldIgnite','spear','rider','chain','chainLand','fire','ignite','couple','whirl','heart','boundary','kingDoor','fireContact','riderDamage'];
const aliases = names => Object.fromEntries(names.map(name => [name,name]));
const registry = names => new Map([...names].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const source = { id:'nalati.titan',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/titan.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
const authored = readDecisionSources(fileURLToPath(new URL('../', import.meta.url)));
const row={...source,id:'nalati.titan-combined',source:'behaviour/titanCombined.as'};
const built=await compileDecisionScripts([row],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:2837,singleSignal:true});
const script=built.rows.at(0),blob=built.blobs.at(0);if(script===undefined||blob===undefined)throw new Error('Missing Titan decision program');
const program={script,bytes:Buffer.from(blob.bytes).toString('base64')};
const pastureText=['pastureWind','pasture','titanWind'].map(name=>authored.get(`behaviour/${name}.as`)).join('\n');
const names=prefix=>[...new Set([...pastureText.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
const pf=names('Field'),pc=names('Channel'),ps=names('Signal');
const pastureSource={...source,id:'nalati.pasture-wind',source:'behaviour/pastureWind.as',reads:['field','random','radial'],fields:aliases(pf),channels:aliases(pc),signals:aliases(ps)};
const pastureBuilt=await compileDecisionScripts([pastureSource],{fields:registry(pf),channels:registry(pc),signals:registry(ps)},authored,{asLineCeiling:2837,singleSignal:true});
const pastureScript=pastureBuilt.rows.at(0),pastureBlob=pastureBuilt.blobs.at(0);if(pastureScript===undefined||pastureBlob===undefined)throw new Error('Missing pasture/wind decision program');
const wind={script:pastureScript,bytes:Buffer.from(pastureBlob.bytes).toString('base64')};
const programs={attack:program,fire:program,wind,rules:program};

const writer = byteWriter(process.argv.includes('--check'), 'nalati-storm-titan');
writer.put(fileURLToPath(new URL('../data/stormTitanFight.generated.json', import.meta.url)), jsonBytes(fight));
writer.put(fileURLToPath(new URL('../data/stormTitanGeometry.generated.json', import.meta.url)), jsonBytes({ ...titanGeometry(), body: titanBodyRows(), poses: [...titanPoseRows(), ...titanFightPoseRows()], arena: titanArenaRows(fight.TITAN_PLACE.arenaRadius, fight.TITAN_TUNING.cell, fight.TITAN_ARENA.grid) }, 0));
writer.put(fileURLToPath(new URL('../behaviour/titan.generated.json', import.meta.url)), jsonBytes(programs));
writer.put(fileURLToPath(new URL('../behaviour/pasture.generated.json', import.meta.url)),jsonBytes(wind));
writer.finish();
