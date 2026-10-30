// @vitest-environment node
// oxlint-disable-next-line import/no-nodejs-modules -- Real native physics, no DOM or renderer host.
import {readFileSync} from 'node:fs';
import {beforeAll,expect,test} from 'vitest';
import * as v from 'valibot';
import {loadRapier,type Rapier} from '../src/engine/physics/rapier';
import {createSimHost} from '../src/engine/sim';
import {headlessTapePlanSchema,runTrustedHeadlessTape,type HeadlessTapePlan} from '../src/sdk/headlessTape';
import {TickCommandSchema,simPlayerCommand} from '../src/sdk/tickProtocol';
import {SIM_LEVEL} from './fixtures/sim-level/level';

let rapier:Rapier;
beforeAll(async()=>{rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));});
const schema=headlessTapePlanSchema(TickCommandSchema);
const plan:HeadlessTapePlan={version:1,observe:['counter'],segments:[
  {id:'walk',ticks:120,commands:[{kind:'player',moveX:.2,moveZ:0,yaw:0}]},
  {id:'release',ticks:60,commands:[]},
]};

test('tape admission is finite, capped, distinct and uses the actual canonical command grammar',()=>{
  expect(v.safeParse(schema,plan).success).toBe(true);
  for(const bad of [{...plan,segments:[]},{...plan,observe:['counter','counter']},
    {...plan,segments:[plan.segments[0],plan.segments[0]]},
    {...plan,segments:[{id:'x',ticks:18_001,commands:[]}]},
    {...plan,segments:Array.from({length:4},(_,i)=>({id:String(i),ticks:18_000,commands:[]}))},
    {...plan,segments:[{id:'x',ticks:1,commands:[{kind:'launcher',slot:1,ads:1,pitch:Number.NaN}]}]},
    {...plan,run:()=>undefined}])expect(v.safeParse(schema,bad).success).toBe(false);
});

test('compact tape executes every native tick and reads actual owners at each segment end',()=>{
  const host=createSimHost({...SIM_LEVEL,entities:[]},{rapier});let count=0;
  host.onStep('counter',()=>{count++;},{snapshot:()=>({count}),restore:()=>undefined});
  try {
    const report=runTrustedHeadlessTape(host,commands=>{
      const player=commands.find(command=>command.kind==='player');host.step(player===undefined?undefined:simPlayerCommand(player));
    },()=>[],v.parse(schema,plan));
    expect(report.ticks).toBe(180);expect(count).toBe(180);
    expect(report.observations.map(row=>row.tick)).toEqual([120,180]);
    expect(report.observations[0]?.position[0]).toBeGreaterThan(0);
    expect(report.observations[1]?.grounded).toBe(true);
    expect(report.observations.map(row=>v.parse(v.object({count:v.number()}),JSON.parse(row.adapters[0]?.state??'null')))).toEqual([{count:120},{count:180}]);
    expect(host.state.tick).toBe(180);
  }finally{host.dispose();}
});

test('missing, replaced and nonfinite owners cannot publish a successful tape observation',()=>{
  const host=createSimHost({...SIM_LEVEL,entities:[]},{rapier});
  try {
    expect(()=>runTrustedHeadlessTape(host,()=>host.step(),()=>[],plan)).toThrow('Missing tape observation owner');
    expect(host.state.tick).toBe(0);
    host.onStep('counter',()=>undefined,{snapshot:()=>({value:Number.NaN}),restore:()=>undefined});
    expect(()=>runTrustedHeadlessTape(host,()=>host.step(),()=>[],plan)).toThrow('Nonfinite tape owner');
    expect(()=>runTrustedHeadlessTape(host,()=>{host.step();host.adapters.delete('counter');},()=>[],plan)).toThrow('owner changed');
  }finally{host.dispose();}
  expect(()=>runTrustedHeadlessTape(host,()=>undefined,()=>[],plan)).toThrow('owner retired');
});


test('a declared route uses actual movement and refuses a blocked endpoint instead of advancing it',()=>{
  const host=createSimHost({...SIM_LEVEL,entities:[]},{rapier});
  const route:HeadlessTapePlan={version:1,observe:[],segments:[{id:'approach',ticks:600,commands:[],route:[{x:0,z:0},{x:2,z:0}]}]};
  try {
    const report=runTrustedHeadlessTape(host,commands=>{const command=commands.find(row=>row.kind==='player');host.step(command===undefined?undefined:simPlayerCommand(command));},()=>[],v.parse(schema,route));
    expect(report.ticks).toBeGreaterThan(0);expect(report.ticks).toBeLessThan(600);
    expect(report.observations[0]?.position[0]).toBeGreaterThan(1.2);
    const blocked=createSimHost({...SIM_LEVEL,entities:[]},{rapier});
    try {expect(()=>runTrustedHeadlessTape(blocked,()=>blocked.step(),()=>[],v.parse(schema,route))).toThrow('route stuck');}
    finally{blocked.dispose();}
  }finally{host.dispose();}
});
