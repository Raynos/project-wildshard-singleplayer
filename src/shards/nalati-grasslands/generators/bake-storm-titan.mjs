import {PACK_PROFILE} from './packGroup.ts';
import {groupBankWidthV2} from '@wildshard/format/scriptGroupBankV2';
import herdRows from '../data/herdGroup.json' with {type:'json'};
import {groupBankSourceV2} from '@wildshard/sdk/as/groupBankV2';
import {groupStepSourceV2} from '@wildshard/sdk/as/groupStepV2';
import {parseGroupStepV2} from '@wildshard/format/scriptGroupStepV2';
// Deterministic static encounter data and geometry; all live fight/pose owners are retained.
import { fileURLToPath } from 'node:url';
import { readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import * as fight from './stormTitanFight.ts';
import { titanGeometry, titanBodyRows, titanPoseRows, titanArenaRows, titanFightPoseRows } from './stormTitanGeometry.ts';

const fields = ['chainRadius','spearAim','spearLock','spearRadius','spearT','bend','raise','rewardDistance','respawnDistance','bodyX','bodyZ','fullHp','share','victoryT','immuneT','introBolt','spearMode','chainLeft','radius','land','dt','phase','mode','t','cd','x','z','px','pz','chain','aim','lock','stuck','ax','az','x0','z0','x1','z1','theta','hit','lane','flank','broke','index','cy','wx','wz','vx','vz','cx','cz','count','spread','burn','hp','chip','invuln','stun','fullDraw','fullDrawMul','amount','open','fighting','tied','mounted','storm','engaged','sealed','armed','victory','wall','ex','ey','ez','facing','inside','volume','corridor','sand','floor','y'];
const channels = ['chainRadius','chainAlpha','tell','ringRadius','ringAlpha','forkRadius','forkAlpha','bend','bendRate','raise','raiseRate','castL','struck','weapon','dome','yaw','shield','phase','invuln','fighting','victoryT','tied','sealed','immuneT','introBolt','flash','rise','kneel','active','land','spread','radius','left','mode','t','cd','x','z','strike','stuck','theta','hit','speed','turn','alpha','show','hurt','mask','burn','hp','open','broke','index','x0','z0','x1','z1','vx','vz','wall','arm','disarm','clear','label','enter','exit','slow'];
const signals = ['bossTell','bossSupport','bossPoint','bossReset','bossBegin','bossPhase','bossClamp','bossShield','bossSeal','bossTie','bossVictory','bossDamage','bossIntro','bossStep','arenaClocks','arenaSpear','arenaChain','fieldContact','spearResolve','phaseEntry','arenaState','tie','supportDamage','fieldClock','fieldIgnite','spear','rider','chain','chainLand','fire','ignite','couple','whirl','heart','boundary','kingDoor','fireContact','riderDamage'];
fields.push('capacity','every','elapsed',...Array.from({length:12},(_,i)=>[`trailX${i}`,`trailZ${i}`]).flat());
channels.push('count','elapsed',...Array.from({length:12},(_,i)=>[`trailX${i}`,`trailZ${i}`]).flat());
signals.push('arenaTrail','arenaTrailPick','zzArenaSchedules');
fields.push('zzMask','zzChainCd','zzChainLeft','zzChainT');
channels.push('zzChainCd','zzChainLeft','zzChainT','zzSpearActive','zzChainStrike','zzChainIndex');
signals.push('zzzArenaFrame');
fields.push('zzzLandSeconds','zzzLandRadius','zzzLandingCapacity',...Array.from({length:8},(_,i)=>['on','t','x','z'].map(key=>`zzzLanding${i}${key}`)).flat());
channels.push(...Array.from({length:8},(_,i)=>['on','t','x','z','strike','hurt'].map(key=>`zzzLanding${i}${key}`)).flat());
const aliases = names => Object.fromEntries(names.map(name => [name,name]));
const registry = names => new Map([...names].sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map((name,index) => [name,index+1]));
const source = { id:'nalati.titan',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/titan.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
const authored = readDecisionSources(fileURLToPath(new URL('../', import.meta.url)));
const row={...source,id:'nalati.titan-combined',source:'behaviour/titanCombined.as'};
const dual=await compileReturnProjectionV2(row,{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:3184,projectSource:'behaviour/titanCommands.as',outputCapacity:96,worldActions:true,additional:{fields:['zzzzIntroT',...Object.keys(fight.titanWhirlGate(8).law.initial).sort()],signals:['zzzzDismount','zzzzIgnite','zzzzIntroClock','zzzzWhirlArm','zzzzWhirlGate'],channels:['zzzzIntroT','zzzzIntroTick',...Object.keys(fight.titanWhirlGate(8).law.initial).sort()]}});
const program={...dual.legacy,v2:{...dual.candidate,bytes:''}};
const pastureText=['pastureWind','pasture','titanWind','titanFire'].map(name=>authored.get(`behaviour/${name}.as`)).join('\n');
const names=prefix=>[...new Set([...pastureText.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
const pf=names('Field'),pc=names('Channel'),ps=names('Signal');
const pastureSource={...source,id:'nalati.pasture-wind',source:'behaviour/pastureWind.as',reads:['field','random','radial'],fields:aliases(pf),channels:aliases(pc),signals:aliases(ps)};
// R10b: the shared pasture programme (wind, fire, pasture; the pack and herd group profiles join it) selected as ABI v2 with
// its exact ABI1 witness kept (test/nalati-pasture-v2.test.ts: every signal answers as the witness)
const herd=parseGroupStepV2(herdRows),groups=parseGroupStepV2({...herd,profiles:[PACK_PROFILE]});
const pastureDual=await compileReturnProjectionV2(pastureSource,{fields:registry(pf),channels:registry(pc),signals:registry(ps)},authored,{asLineCeiling:3184,projectSource:'behaviour/pastureProject.as',groups:{rows:groups,helpers:{'sdk/as/groupBankV2.herd.ts':groupBankSourceV2(0,herd.bank.length),'sdk/as/groupBankV2.pack.ts':groupBankSourceV2(0,PACK_PROFILE.bank.reduce((sum,field)=>sum+groupBankWidthV2(field),0)),'sdk/as/groupStepV2.pack.ts':groupStepSourceV2(PACK_PROFILE.columns.length,PACK_PROFILE.members),'sdk/as/groupStepV2.herd.ts':groupStepSourceV2(herd.columns.length,herd.members)}}});
// The selected artifact stays binary; JSON retains only its descriptor and original ABI1 witness.
const pastureBytes=pastureDual.binary;
const wind={...pastureDual.legacy,v2:{...pastureDual.candidate,bytes:''}};
const compiled={attack:{source:'behaviour/titan.generated.wasm',bytes:dual.binary.length,hash:dual.candidate.artifact.hash},pasture:{source:'behaviour/pasture.generated.wasm',bytes:pastureBytes.length,hash:pastureDual.candidate.artifact.hash}};
const programs={attack:program,fire:wind,wind,rules:program,compiled};

const writer = byteWriter(process.argv.includes('--check'), 'nalati-storm-titan');
writer.put(fileURLToPath(new URL('../data/stormTitanFight.generated.json', import.meta.url)), jsonBytes(fight));
writer.put(fileURLToPath(new URL('../data/stormTitanGeometry.generated.json', import.meta.url)), jsonBytes({ ...titanGeometry(), body: titanBodyRows(), poses: [...titanPoseRows(), ...titanFightPoseRows()], arena: titanArenaRows(fight.TITAN_PLACE.arenaRadius, fight.TITAN_TUNING.cell, fight.TITAN_ARENA.grid) }, 0));
writer.put(fileURLToPath(new URL('../behaviour/titan.generated.wasm',import.meta.url)),dual.binary);
writer.put(fileURLToPath(new URL('../behaviour/pasture.generated.wasm',import.meta.url)),pastureBytes);
writer.put(fileURLToPath(new URL('../behaviour/titan.generated.json', import.meta.url)), jsonBytes(programs));
writer.put(fileURLToPath(new URL('../behaviour/pasture.generated.json', import.meta.url)),jsonBytes(wind));
writer.finish();
