import { expect,test } from 'vitest';
import { Vector3 } from 'three';
import { huntMemoryCodec,type HuntMemory } from '../src/engine/ai/huntPattern';
import { DRIFTWOOD_HUNT_MEMORY_FIELDS } from '../src/shards/driftwood-isle/data/fauna';

const memory=():HuntMemory=>({timer:2,tx:4,tz:8,fleeT:0,fleeUntil:12,chargeCd:0,callT:0,awareness:0.7,freeze:0,
  spooked:false,wary:0,sensed:true,windup:0.3,backoff:0,side:1,committed:true,path:[new Vector3(4,1,8)],pathI:0,goalX:4,goalZ:8,repathAt:2});
test('old memory resumes its actual hunt fields and real path vectors in both modes',()=>{
  const original=memory(),saved=huntMemoryCodec.save(original),pine=memory(),drift=memory();pine.timer=0;drift.timer=0;
  huntMemoryCodec.restore(pine,saved);huntMemoryCodec.restore(drift,huntMemoryCodec.save(original,DRIFTWOOD_HUNT_MEMORY_FIELDS),false);
  expect(pine.timer).toBe(original.timer);expect(drift.committed).toBe(original.committed);expect(pine.path[0]).toBeInstanceOf(Vector3);
  expect(pine.path[0]?.equals(original.path[0]??new Vector3())).toBe(true);expect(pine.path[0]).not.toBe(original.path[0]);
  const subset=memory();huntMemoryCodec.restore(subset,{timer:9},false);expect(subset.tx).toBe(original.tx);
});
test('missing, retyped or corrupt path fields refuse before memory mutation',()=>{
  const live=memory(),saved=huntMemoryCodec.save(live),before=huntMemoryCodec.save(live);
  expect(()=>huntMemoryCodec.restore(live,{...saved,timer:false})).toThrow();expect(huntMemoryCodec.save(live)).toEqual(before);
  expect(()=>huntMemoryCodec.restore(live,{...saved,path:[[Number.NaN,0,0]]})).toThrow();expect(huntMemoryCodec.save(live)).toEqual(before);
  expect(()=>huntMemoryCodec.restore(live,{timer:0})).toThrow();expect(()=>huntMemoryCodec.restore(live,{unknown:0},false)).toThrow();
});
