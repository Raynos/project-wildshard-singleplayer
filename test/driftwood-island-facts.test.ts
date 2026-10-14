import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {prototypeFacts} from '../src/shards/driftwood-isle/generators/islandFacts';

it('keeps native bounds around every prototype vertex and fits wide rocks',()=>{
 const pos=new Float32Array([-2,-1,-1,3,2,1,1,0,4]);
 const facts=prototypeFacts('smallrock0',{pos,col:new Uint8Array(12),index:new Uint32Array([0,1,2])});
 const box=new Box3(new Vector3(facts.min.x,facts.min.y,facts.min.z),new Vector3(facts.max.x,facts.max.y,facts.max.z));
 for(let i=0;i<pos.length;i+=3)expect(box.containsPoint(new Vector3().fromArray(pos,i))).toBe(true);
 expect(facts.half).toBeGreaterThan(2);expect(facts.top).toBeGreaterThan(1);expect(facts.empty).toBe(false);
 const empty=prototypeFacts('absent',undefined);expect(empty.empty).toBe(true);expect(empty.half).toBeGreaterThan(0);expect(empty.top).toBeGreaterThan(0);
});
