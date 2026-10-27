// GR6 (G783): the Storm Titan's combined fight programme and the shared pasture programme (wind, fire, pasture; the
// pack and herd group profiles join it), as the retired `nalati-storm-titan` job compiled them (behaviour/titan and
// pasture .generated.json, .wasm and witnesses): the build compiles them (stormTitanProgram.ts), tests call the same.
import { PACK_PROFILE } from './packGroup.ts';
import { groupBankWidthV2 } from '@wildshard/format/scriptGroupBankV2';
import herdRows from '../data/herdGroup.json' with { type: 'json' };
import { groupBankSourceV2 } from '@wildshard/sdk/as/groupBankV2';
import { groupStepSourceV2 } from '@wildshard/sdk/as/groupStepV2';
import { parseGroupStepV2 } from '@wildshard/format/scriptGroupStepV2';
import { titanWhirlGate } from './stormTitanFight.ts';

/** The product names the two selected ABI-2 modules ship under. */
export const NALATI_TITAN_MODULE = 'behaviour/nalati.titan.attack.v2.wasm', NALATI_PASTURE_MODULE = 'behaviour/nalati.pasture.wasm';
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

/** Compile both programmes (`compile`: the build's return-projection compiler) from the authored `behaviour/*.as` map;
 *  returns the titan rows (attack, fire, wind, rules, compiled) and both modules' bytes and ABI-1 witnesses. */
export async function nalatiTitanRows(compile, authored) {
  const row={...source,id:'nalati.titan-combined',source:'behaviour/titanCombined.as'};
  const dual=await compile(row,{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:3184,projectSource:'behaviour/titanCommands.as',outputCapacity:96,worldActions:true,additional:{fields:['zzzzIntroT',...Object.keys(titanWhirlGate(8).law.initial).sort()],signals:['zzzzDismount','zzzzIgnite','zzzzIntroClock','zzzzWhirlArm','zzzzWhirlGate'],channels:['zzzzIntroT','zzzzIntroTick',...Object.keys(titanWhirlGate(8).law.initial).sort()]}});
  const program={...dual.legacy,bytes:'',v2:{...dual.candidate,bytes:''}};
  const pastureText=['pastureWind','pasture','titanWind','titanFire'].map(name=>authored.get(`behaviour/${name}.as`)).join('\n');
  const names=prefix=>[...new Set([...pastureText.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
  const pf=names('Field'),pc=names('Channel'),ps=names('Signal');
  const pastureSource={...source,id:'nalati.pasture-wind',source:'behaviour/pastureWind.as',reads:['field','random','radial'],fields:aliases(pf),channels:aliases(pc),signals:aliases(ps)};
  // R10b: the shared pasture programme (wind, fire, pasture; the pack and herd group profiles join it) selected as ABI v2 with
  // its exact ABI1 witness kept (test/nalati-pasture-v2.test.ts: every signal answers as the witness)
  const herd=parseGroupStepV2(herdRows),groups=parseGroupStepV2({...herd,profiles:[PACK_PROFILE]});
  const pastureDual=await compile(pastureSource,{fields:registry(pf),channels:registry(pc),signals:registry(ps)},authored,{asLineCeiling:3184,projectSource:'behaviour/pastureProject.as',groups:{rows:groups,helpers:{'sdk/as/groupBankV2.herd.ts':groupBankSourceV2(0,herd.bank.length),'sdk/as/groupBankV2.pack.ts':groupBankSourceV2(0,PACK_PROFILE.bank.reduce((sum,field)=>sum+groupBankWidthV2(field),0)),'sdk/as/groupStepV2.pack.ts':groupStepSourceV2(PACK_PROFILE.columns.length,PACK_PROFILE.members),'sdk/as/groupStepV2.herd.ts':groupStepSourceV2(herd.columns.length,herd.members)}}});
  // The selected artifact stays binary; JSON retains only its descriptor and original ABI1 witness.
  const pastureBytes=pastureDual.binary;
  const wind={...pastureDual.legacy,bytes:'',v2:{...pastureDual.candidate,bytes:''}};
  const compiled={witnessBytes:dual.witness.length+pastureDual.witness.length,attack:{source:NALATI_TITAN_MODULE,bytes:dual.binary.length,hash:dual.candidate.artifact.hash},pasture:{source:NALATI_PASTURE_MODULE,bytes:pastureBytes.length,hash:pastureDual.candidate.artifact.hash}};
  const programs={attack:program,fire:wind,wind,rules:program,compiled};
  return { programs, titan: { wasm: dual.binary, witness: dual.witness }, pasture: { wasm: pastureBytes, witness: pastureDual.witness } };
}
