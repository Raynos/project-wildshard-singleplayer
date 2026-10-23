// @vitest-environment happy-dom
import { expect,test } from 'vitest';
import { Vector3 } from 'three';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { Rng } from '../src/engine/core/rng';
import { GOLDEN_KING,GOLDENKING_SPECIES } from '../src/shards/nalati-grasslands/species/goldenKing';
import { GOLDENKING_SPECIES as original } from './fixtures/species-oracle/goldenKingControl';
import { overrideTerrain } from './fake/terrain';
import { manager } from './fake/manager';

function context(heightAt:ThinkCtx['heightAt']):ThinkCtx{
  return {dt:.1,t:0,player:new Vector3(1,2,3),playerSpeed:0,rng:new Rng(65),calm:false,herd:null,world:{},
    hurt:()=>undefined,sound:()=>undefined,heightAt,waterLevel:()=>-100,
    steer:(actor,yaw,speed,turn)=>{actor.setMotion(yaw,speed,turn);},
    flight:{steer:(actor,yaw,speed,altitude,turn)=>{actor.fly(yaw,speed,altitude,turn);}},
    pathYaw:(actor,x,z)=>Math.atan2(x-actor.position.x,z-actor.position.z),confine:()=>undefined,reach:()=>true,claim:()=>true,mayAttack:()=>true};
}
test.each([{}, {pose:4,rise:-0,cape:0,crown:0,floorY:-0}])('unbound King initialization matches the original controls (%j)',initial=>{
  const restore=overrideTerrain({heightAt:()=>0,normalAt:()=>[0,1,0],waterLevel:()=>-100}),world=manager();
  try{
    const a=world.manager.spawn(GOLDEN_KING,7,11,0,'king'),b=world.manager.spawn(GOLDEN_KING,7,11,0,'king');
    a.mem={...initial};b.mem={...initial};let reads=0;
    const ctx=context((x,z)=>{reads++;expect([x,z]).toEqual([7,11]);return -0;});
    original.think?.(a,ctx);GOLDENKING_SPECIES.think?.(b,ctx);
    expect(b.mem).toStrictEqual(a.mem);expect(Object.is(b.mem['floorY'],-0)).toBe(true);expect(Object.is(b.mem['rise'],a.mem['rise'])).toBe(true);
    const first=reads;original.think?.(a,ctx);GOLDENKING_SPECIES.think?.(b,ctx);expect(reads).toBe(first);
    expect(b.mem).toStrictEqual(a.mem);
    original.act?.(a,ctx);GOLDENKING_SPECIES.act?.(b,ctx);
    expect(GOLDENKING_SPECIES.damageMul?.(b,new Vector3(),new Vector3())).toBe(original.damageMul?.(a,new Vector3(),new Vector3()));
    expect(ctx.rng.snapshot()).toStrictEqual(new Rng(65).snapshot());
  }finally{restore();}
});
