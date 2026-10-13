import { expect, it } from 'vitest';
import { QUEST_MARKERS } from '../src/shards/sunscar-dunes/data/questMarkers';
import physics from '../src/shards/sunscar-dunes/data/physics.generated.json';
import ground from '../src/shards/sunscar-dunes/data/manifestGround.generated.json';
import { SCOUT_AT } from '../src/shards/sunscar-dunes/data/flags';

it('matches every former live marker against the independently captured native prompt positions, bit for bit',()=>{
 const targets:Record<string,number>={logbook:0.4,well:0.6,fire:1,'brazier.0':0.8,'brazier.1':0.8,'brazier.2':0.8};
 const expected:Record<string,{poi:'world';x:number;y:number;z:number}>={scout:{poi:'world',x:SCOUT_AT.x,y:ground.heights.scout,z:SCOUT_AT.z}};
 for(const spot of physics.spots.interact){
  const lift=targets[spot.id];if(lift===undefined)continue;
  const id=spot.id==='fire'?'tower':spot.id.replace('brazier.','waymark.');
  expected[id]={poi:'world',x:spot.x,y:spot.y+lift,z:spot.z};
 }
 expect(QUEST_MARKERS).toEqual(expected);
 for(const [id,point] of Object.entries(expected)){
  const actual=QUEST_MARKERS[id];if(actual===undefined)throw new Error('Missing quest marker');
  expect(new Uint8Array(new Float64Array([actual.x,actual.y,actual.z]).buffer)).toEqual(new Uint8Array(new Float64Array([point.x,point.y,point.z]).buffer));
 }
 expect(QUEST_MARKERS['basin']).toBeUndefined(); // Original placement port delegates that marker to the declared quest.
});
