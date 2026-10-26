// oxlint-disable-next-line import/no-nodejs-modules -- validate generated shelter observations without inferring the full physics JSON type
import {readFileSync} from 'node:fs';
import {array,finite,number,object,parse,pipe,tuple} from 'valibot';
import {expect,test} from 'vitest';
import {nativeWeatherBundle} from '../src/game/weather/reactions';
import weather from '../src/shards/nalati-grasslands/data/weather.json' with {type:'json'};
import {weatherWitness as reactions} from './fixtures/weatherInlineWitness';
import {nalatiNativeShelters} from '../src/shards/nalati-grasslands/generators/shelters';

const scalar=pipe(number(),finite());
const physics=parse(object({yurts:array(tuple([scalar,scalar,scalar]))}),
 JSON.parse(readFileSync('src/shards/nalati-grasslands/data/physics.generated.json','utf8')));
const places=parse(object({rows:array(object({colliders:array(object({x:scalar,z:scalar,hw:scalar,hd:scalar,yTop:scalar,yBottom:scalar}))}))}),
 JSON.parse(readFileSync('src/shards/nalati-grasslands/data/places.json','utf8')));

test('native weather admits current camp shelters without a physics-bake field',()=>{
 const circles=nalatiNativeShelters(places);
 expect(circles.length).toBeGreaterThan(0);expect(circles).toEqual(physics.yurts);
 const bundle=nativeWeatherBundle({weather,reactions},circles);
 expect(bundle.reactions.shelter.circles).toEqual(circles);
 expect(()=>nativeWeatherBundle({weather,reactions},[[0,0,()=>3]])).toThrow();
});

test('owned collider rows preserve original shelter order and detach every circle',()=>{
 const before=JSON.stringify(places),circles=nalatiNativeShelters(places),next=nalatiNativeShelters(places);
 expect(circles).toStrictEqual(physics.yurts);
 expect(JSON.stringify(circles)).toBe(JSON.stringify(physics.yurts));
 const circle=circles[0];if(circle===undefined)throw new Error('Missing original shelter');
 circle[0]=999;
 expect(next).toStrictEqual(physics.yurts);
 expect(nalatiNativeShelters(places)).toStrictEqual(physics.yurts);
 expect(JSON.stringify(places)).toBe(before);
});

test('shelter bounds and strict square deduplication retain the original boundary behavior',()=>{
 const collider=(x:number,z:number,hw=2.5,hd=hw,yTop=2.5,yBottom=0)=>({x,z,hw,hd,yTop,yBottom});
 const rows=[{colliders:[collider(0,0,2.2),collider(.099,.099,3.6),collider(.1,0,3.6),
  collider(20,0,2.199999),collider(30,0,3.600001),collider(40,0,2.5,2.489999),
  collider(50,0,2.5,2.5,2.499999),collider(60,0,2.5,2.49)]},
 {colliders:[collider(.1,0),collider(0,.1)]}];
 expect(nalatiNativeShelters({rows})).toStrictEqual([[0,0,2.2/.93],[.1,0,3.6/.93],[60,0,2.5/.93],[0,.1,2.5/.93]]);
 const empty={rows:[]},first=nalatiNativeShelters(empty),second=nalatiNativeShelters(empty);
 expect(first).toEqual([]);expect(first).not.toBe(second);
});
