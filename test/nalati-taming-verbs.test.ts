import {expect,test} from 'vitest';
import {runNalatiFieldTaming} from './fixtures/headless/nalati-taming-run';
import {prepareHeadlessRuntime} from './fixtures/nalati-verbs';

test('the entry walk earns a living stallion prompt and all five native bucking rounds',async()=>{
  expect(typeof window).toBe('undefined');expect(typeof document).toBe('undefined');
  let verified=false;
  const report=await runNalatiFieldTaming({prepare:prepareHeadlessRuntime,verifyBonded:(first,restored)=>{
    expect(first.phase).toBe('bonded');expect(first.upgraded).toBe(false);
    for(const flag of ['tamed:horse','talked:elder','won:kokpar','quest:tulpar','quest:golden-king','quest:father-wind'])expect(first.flags).not.toContain(flag);
    expect(first.quests.find(quest=>quest.id==='tulpar')).toMatchObject({started:false,complete:false,current:null});
    expect(restored).toEqual(first);verified=true;
  }});
  expect(verified).toBe(true);
  expect(report.approachTicks).toBeGreaterThan(0);expect(report.breakingTicks).toBeGreaterThan(0);
  expect(report.checkpointTick).toBeGreaterThan(report.approachTicks);expect(report.rounds).toBe(5);
// The existing native taming/checkpoint proof uses this same finite bound.
},180_000);
