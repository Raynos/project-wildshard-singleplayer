import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ForagerPopulation } from '../src/engine/ai/ambientForager';
import { ForagerPopulationSchema } from '../src/format/ambientLife';
import { readPopulationBake } from '../src/game/population/nativeBake';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import policy from '../src/shards/nalati-grasslands/creatures/marmotForager.json' with {type:'json'};

const rows={label:'Orchard',resolution:2,size:32};
function input(){
  const body=SIM_LEVEL.entities[0];if(body===undefined)throw new Error('Missing fixture recipe');
  const heights=btoa(String.fromCodePoint(...new Uint8Array(new Float32Array([0,1,2,3]).buffer)));
  const foragers=new ForagerPopulation(v.parse(ForagerPopulationSchema,{...policy,id:'orchard-sentries'}),73);
  return {version:1,ground:{rows:1,cols:1,heights,friction:.9,groups:1,scale:{x:32,y:1,z:32},at:{x:0,y:0,z:0}},solids:[],
    actors:[{id:body.id,kind:body.spec.kind,variant:body.spec.variant,herd:0,spec:body.spec,seed:body.seed,scale:body.scale,scripted:false}],
    herds:[{kind:'herd',members:[body.id]}],trees:[[2,3,.5]],tops:[6],yurts:[[4,5,6]],grass:[[4,5,.2]],
    spawns:[{id:body.id,at:[0,0,1],yaw:0,mem:{hit:null,age:1}}],groups:[{kind:'herd',members:[body.id],state:'graze'}],
    flocks:[{n:1,cx:2,cz:3,members:[{at:[2,0,3],yaw:0}]}],ledges:[],marmots:foragers.snapshot()};
}

test('orchard bake admission joins native identities and owns decoded terrain buffers',()=>{
  const source=input(),bake=readPopulationBake(source,rows),other=readPopulationBake(source,rows);
  expect(source.spawns[0]?.mem.hit).toBeNull();expect(bake.ground.heights).toEqual(new Float32Array([0,1,2,3]));
  bake.ground.heights[0]=9;expect(other.ground.heights[0]).toBe(0);
  expect(bake.actors.map(row=>row.id)).toEqual(source.actors.map(row=>row.id));expect(bake.marmots).toEqual(source.marmots);
  expect(bake.trees).toEqual(source.trees);expect(bake.tops).toEqual(source.tops);expect(bake.ledges).toEqual(source.ledges);expect(bake.herds).toEqual(source.herds);
});

test('population intake refuses broken native rosters, canopy counts and executable metadata',()=>{
  const source=input();
  expect(()=>readPopulationBake({...source,actors:[...source.actors,...source.actors]},rows)).toThrow('one id per body');
  expect(()=>readPopulationBake({...source,herds:[{kind:'herd',members:['missing']}]},rows)).toThrow('one id per body');
  expect(()=>readPopulationBake({...source,tops:[]},rows)).toThrow('trees and tops');
  expect(()=>readPopulationBake(source,{...rows,check:()=>true})).toThrow();
  expect(()=>readPopulationBake({...source,trees:[[2,3,()=>3]]},rows)).toThrow();
});
