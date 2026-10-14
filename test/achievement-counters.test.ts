import { expect,test } from 'vitest';
import { createAchievementCounters } from '../src/game/achievements';
import { PINE_FEAT_COUNTERS } from '../src/shards/pine-hollow/data/questInventory';
import { DRIFTWOOD_FEAT_COUNTERS } from '../src/shards/driftwood-isle/data/questInventory';

test('old progress advances with original matching, identities, saturation and write order',()=>{
  let drift:Record<string,number>={crab10:4};const emitted:string[]=[];
  const counter=createAchievementCounters(DRIFTWOOD_FEAT_COUNTERS,{read:()=>({...drift}),write:state=>{drift=state;},emit:(fact,id)=>{expect(drift['crab10']).toBeLessThan(6);emitted.push(`${fact}/${id}`);}});
  counter.kill('crab');counter.count('crab10',6.8);expect(drift['crab10']).toBe(6);expect(emitted).toContain('driftwood.crab10/crab10:5');expect(emitted).toContain('driftwood.crab10/crab10:6');
  const pine:Record<string,number>={deer5:2,ghost:0};const witnessed:string[]=[];
  const policy=createAchievementCounters(PINE_FEAT_COUNTERS,{read:()=>({...pine}),write:state=>{Object.assign(pine,state);},emit:(fact,id)=>{witnessed.push(`${fact}/${id}`);}});
  policy.replay();expect(witnessed).toContain('pine.feat.deer5/deer5:2');const saved=pine['ghost'];
  policy.kill('deer','ordinary');expect(pine['ghost']).toBe(saved);expect(pine['deer5']).toBeGreaterThan(2);
  policy.kill('deer','ghost');expect(pine['ghost']).toBeGreaterThan(saved??0);policy.event('resin',1000);expect(pine['resin']).toBeLessThanOrEqual(30);
  const last=pine['resin'];policy.event('resin',0);expect(pine['resin']).toBe(last);
});
test('unknown explicit feat and malformed row bounds refuse without writes',()=>{
  let written=false;const ports={read:()=>({}),write:()=>{written=true;},emit:()=>undefined};
  const counter=createAchievementCounters(DRIFTWOOD_FEAT_COUNTERS,ports);expect(()=>counter.count('missing',1)).toThrow();expect(()=>counter.count('crab10',Number.NaN)).toThrow();expect(written).toBe(false);
  expect(()=>createAchievementCounters({...DRIFTWOOD_FEAT_COUNTERS,feats:[{id:'bad',count:Infinity}]},ports)).toThrow();
});
