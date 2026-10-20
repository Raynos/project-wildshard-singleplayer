import { expect,test } from 'vitest';
import { Vector3 } from 'three';
import { PageCreatureGuest } from '../src/game/population/creatureGuest';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import type { DamageRequest } from '../src/engine/combat/pipeline';
import { legacyDouble } from './fake/FakeGame';
import rows from '../src/shards/nalati-grasslands/species/speciesRows.json' with { type:'json' };
import presentation from '../src/shards/nalati-grasslands/data/species.generated.json' with { type:'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type:'json' };

test('orchard guardian guest observes native bodies at ten Hz and samples declared weak points',()=>{
  const guest=new PageCreatureGuest({...rows.balbalGuest,program:presentation.program,strike:strikes.balbal,
    clock:'orchardThinkAt',playerKeys:['orchardPlayerX','orchardPlayerZ'],weak:[[0,1,0]],radius:.3});
  const actor=legacyDouble<Animal>({entityId:'orchard.guard',kind:'stone-guardian',mem:{},position:new Vector3(),yaw:0,scale:1,yOffset:0,
    state:'idle',attackPhase:-1,lookTarget:new Vector3(),lookWeight:0,startAttack:()=>undefined,cancelAttack:()=>undefined,setMotion:()=>undefined});
  const context=legacyDouble<ThinkCtx>({dt:.02,t:.02,player:new Vector3(10,0,0),calm:false,steer:()=>undefined,reach:()=>true,hurt:()=>undefined,sound:()=>undefined});
  guest.binding.think(actor,context);expect(actor.mem['orchardThinkAt']).toBe(.02);expect(actor.mem['balbalThinkAt']).toBeUndefined();
  const before={...actor.mem};context.t=.08;guest.binding.think(actor,context);expect(actor.mem).toEqual(before);
  context.t=.12;guest.binding.think(actor,context);expect(actor.mem['orchardThinkAt']).toBe(.12);
  actor.mem['orchardPlayerX']=0;actor.mem['orchardPlayerZ']=0;
  const point=new Vector3(0,1,0),direction=new Vector3();expect(guest.weakPoint(actor,point)).toBe(true);expect(guest.weakPoint(actor,new Vector3(2,1,0))).toBe(false);
  expect(guest.binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(2.5);
  expect(guest.binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.sabre']}))).toBe(1.5);
  actor.mem['field']=1;actor.mem['rise']=.2;
  expect(guest.binding.damageMul(actor,point,direction,legacyDouble<DamageRequest>({sourceTags:['weapon.javelin']}))).toBe(.25);
});
