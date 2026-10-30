import * as v from 'valibot';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {HeadlessJourneyPlanSchema} from '../src/sdk/headlessJourney';
import {openProductSession} from './fixtures/headless/productSession';
import {physicsRoutes} from './fixtures/headless/physicsRoutes';

describe('driftwood-isle',{concurrent:false,shuffle:false},()=>{
let session:Awaited<ReturnType<typeof openProductSession>>|undefined;
beforeAll(async()=>{session=await openProductSession('driftwood-isle');});
afterAll(async()=>{
  if(session===undefined)return;
  await session.sim.dispose();await expect(session.sim.step()).rejects.toThrow();
});
// The maintained browser ruler runs the legs in order in one living world.
for(const {slug,leg} of physicsRoutes.filter(row=>row.slug==='driftwood-isle'))it(`${leg.name}: completes native physics route without a snag`,async()=>{
  if(session===undefined)throw new Error('Missing native Driftwood physics world');
  const {sim}=session;
  const plan=v.parse(HeadlessJourneyPlanSchema,{ticks:Math.ceil(leg.timeout*60),start:leg.start,once:true,
    points:[{x:leg.start.x,z:leg.start.z},...leg.waypoints],...(leg.inside===undefined?{}:{inside:leg.inside})});
  const report=await sim.walkLeg(plan),diagnostic=JSON.stringify({slug,leg:leg.name,...report});
  expect(report.stuck,diagnostic).toEqual([]);
  expect(report.out,diagnostic).toBe(0);
  expect(report.complete,diagnostic).toBe(true);
  expect(report.final.position.every(Number.isFinite)).toBe(true);
  expect(sim.quarantined).toBe(false);
},60_000);
});
