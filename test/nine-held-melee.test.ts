// oxlint-disable-next-line import/no-nodejs-modules -- The native regression uses the real shipped Rapier bytes.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as v from 'valibot';
import {createSimHost,type SimHost} from '../src/engine/sim';
import {loadRapier} from '../src/engine/physics/rapier';
import {createNativeCombatFrame,installNativeItems} from '../src/game/plugin/nativeItems';
import {parseItems} from '../src/format/items';
import assembly from '../src/shards/nine-dragon-stack/data/headlessAssembly.json' with {type:'json'};
import items from '../src/shards/nine-dragon-stack/data/items.json' with {type:'json'};
import {installNineJian} from './fixtures/weapon-oracle/nineJian';
import {SIM_LEVEL} from './fixtures/sim-level/level';

const policy=assembly.constants.jianPolicy,step=assembly.constants.jianStep;
const saved=v.looseObject({swings:v.number(),hits:v.number(),windows:v.optional(v.number()),
 clock:v.optional(v.unknown()),clocks:v.optional(v.array(v.unknown()))});
function snapshot(host:SimHost):string {
 const value=host.adapters.get(step)?.snapshot();if(typeof value!=='string')throw new Error('Missing held clock');return value;
}

it('keeps Nine combos, held heavies, active windows and old single-clock saves on the shared native owner',async()=>{
 const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
 const level={...SIM_LEVEL,entities:[]},old=createSimHost(level,{rapier}),current=createSimHost(level,{rapier});
 const row=parseItems(items).rows.find(item=>item.id==='weapon.jian');if(row?.kind!=='weapon')throw new Error('Missing Jian');
 const frame=createNativeCombatFrame();
 installNineJian(old,row,()=>frame.melee.attack!==null,()=>frame.melee.heavy);
 const native=installNativeItems(current,frame,{kind:'swept',policy,items:items.rows});
 try{
  for(let tick=0;tick<900;tick++){
   frame.melee.attack=tick%13===0?'absent':null;frame.melee.heavy=tick%150>=40&&tick%150<90;
   old.step();current.step();
   const before=v.parse(saved,JSON.parse(snapshot(old))),after=v.parse(saved,JSON.parse(snapshot(current)));
   expect(after.swings,`swings at ${String(tick)}`).toBe(before.swings);
   expect(after.windows,`active windows at ${String(tick)}`).toBe(before.hits);
   expect(after.clocks?.[0],`clock at ${String(tick)}`).toEqual(before.clock);
   expect(native.hits()).toBe(0);
   if(tick===190||tick===222){
    current.adapters.get(step)?.restore(snapshot(old));
    expect(v.parse(saved,JSON.parse(snapshot(current))).clocks?.[0]).toEqual(before.clock);
   }
  }
  expect(native.swings()).toBeGreaterThan(10);
 }finally{old.dispose();current.dispose();}
});
