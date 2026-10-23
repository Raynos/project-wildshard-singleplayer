import { array,number,parse,tuple } from 'valibot';
import { expect,test } from 'vitest';
import { Vector3 } from 'three';
import { BALBAL_SPECIES } from '../src/shards/nalati-grasslands/species/balbal';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import type { DamageRequest } from '../src/engine/combat/pipeline';
import { legacyDouble } from './fake/FakeGame';
import { wireProgram } from '../src/shards/nalati-grasslands/generators/returnProgramRows';
import titan from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type:'json' };
import { parseDecisionScripts } from '../src/format/decisionScripts';
import sourceAdmission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type:'json' };
import { CreatureGuestSchema } from '../src/format/speciesBookRows';
import generated from '../src/shards/nalati-grasslands/data/species.generated.json' with { type:'json' };
import rows from '../src/shards/nalati-grasslands/data/speciesRows.json' with { type:'json' };

function controls() {
  const { think,damageMul }=BALBAL_SPECIES;
  if(think===undefined||damageMul===undefined)throw new Error('Missing actual balbal controls');
  return {think,damageMul};
}

const weakPoints=parse(array(tuple([number(),number(),number()])),rows.weak);

test('the actual balbal binding observes native bodies at ten Hz and samples declared weak points',()=>{
  const binding=controls();
  const actor=legacyDouble<Animal>({entityId:'orchard.guard',kind:'stone-guardian',mem:{},position:new Vector3(),yaw:0,scale:1,yOffset:0,
    state:'idle',attackPhase:-1,lookTarget:new Vector3(),lookWeight:0,startAttack:()=>undefined,cancelAttack:()=>undefined,setMotion:()=>undefined});
  const context=legacyDouble<ThinkCtx>({dt:.02,t:.02,player:new Vector3(10,0,0),calm:false,steer:()=>undefined,reach:()=>true,hurt:()=>undefined,sound:()=>undefined});
  binding.think(actor,context);expect(actor.mem['balbalThinkAt']).toBe(.02);expect(actor.mem['orchardThinkAt']).toBeUndefined();
  const before={...actor.mem};context.t=.08;binding.think(actor,context);expect(actor.mem).toEqual(before);
  context.t=.12;binding.think(actor,context);expect(actor.mem['balbalThinkAt']).toBe(.12);
  actor.mem['balbalPlayerX']=0;actor.mem['balbalPlayerZ']=0;
  const weak=weakPoints[0];if(weak===undefined)throw new Error('Missing authored weak point');
  const point=new Vector3(...weak),direction=new Vector3();
  expect(binding.damageMul(actor,new Vector3(2,1,0),direction,legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(1);
  expect(binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(2.5);
  expect(binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.sabre']}))).toBe(1.5);
  actor.mem['field']=1;actor.mem['rise']=.2;
  expect(binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(.25);
});


test('authored weak-point query preserves yaw, body lift, scale and strict radius',()=>{
  const binding=controls();
  const actor=legacyDouble<Animal>({mem:{},position:new Vector3(12,-3,8),yaw:.7,scale:2.75,yOffset:.3});
  const world=(x:number,y:number,z:number):Vector3=>new Vector3(
    actor.position.x+actor.scale*(x*Math.cos(actor.yaw)+z*Math.sin(actor.yaw)),
    actor.position.y+actor.yOffset+y*actor.scale,
    actor.position.z+actor.scale*(-x*Math.sin(actor.yaw)+z*Math.cos(actor.yaw)));
  const reference=(point:Vector3):boolean=>{
    const at=point.clone().sub(actor.position);at.y-=actor.yOffset;
    const c=Math.cos(-actor.yaw),s=Math.sin(-actor.yaw),x=at.x*c+at.z*s,z=-at.x*s+at.z*c;
    return weakPoints.some(([px,py,pz])=>Math.hypot(x/actor.scale-px,at.y/actor.scale-py,z/actor.scale-pz)<rows.balbalGuest.radius);
  };
  for(const [x,y,z] of weakPoints)for(const offset of [-.5,-.25,-.1,0,.1,.25,.5]) {
    const at=world(x+offset,y,z);
    actor.mem['balbalPlayerX']=at.x;actor.mem['balbalPlayerZ']=at.z;
    expect(binding.damageMul(actor,at,new Vector3(),legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(reference(at)?2.5:1);
  }
});

test('named creature observations retain the original bounds before native use',()=>{
  const guest=parse(CreatureGuestSchema,generated.presentation.guest);
  expect(guest.clock).toBe(rows.balbalGuest.clock);
  expect(guest.memory).toEqual(rows.balbalGuest.memory);
  expect(guest.states).toEqual(rows.balbalGuest.states);
  expect(()=>parse(CreatureGuestSchema,{...guest,length:[1,0,1]})).toThrow();
  expect(()=>parse(CreatureGuestSchema,{...guest,writes:Array.from({length:65},()=> 'x')})).toThrow();
});

test('omitted script defaults retain the exact admitted look declaration',()=>{
  const actual=parseDecisionScripts([generated.presentation.lookBook.program.script]);
  expect(actual).toEqual(parseDecisionScripts([sourceAdmission.script]));
  expect(generated.presentation.lookBook.program.bytes).toBe(sourceAdmission.bytes);
});

test('wire defaults preserve every existing Titan program and module',()=>{
  for(const program of Object.values(titan)) {
    const wire=wireProgram(program);
    expect(parseDecisionScripts([wire.script])).toEqual(parseDecisionScripts([program.script]));
    expect(wire.bytes).toBe(program.bytes);
  }
});
