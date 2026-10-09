import { expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercises the exact serialized browser fixture in an isolated context.
import { runInNewContext } from 'node:vm';
import { publicGridIntentCode, publicGridPlans, readPublicGridWitness, publicGridWitnessFailures, type PublicGridWitness } from '../scripts/public-grid.mjs';

const cells = [{instance:'driftwood-isle',slug:'driftwood-isle',cell:[0,0] as const},
  {instance:'template-2',slug:'_template',cell:[1,1] as const}];
const witness = (): PublicGridWitness => ({developer:false,savedDeveloper:false,runtimeLevel:'platform.grid',homeResidency:{instance:'driftwood-isle',bytes:1000},
  refusals:{},state:{home:'driftwood-isle',inside:'driftwood-isle',cells,
    live:{crossing:{phase:'settled',issue:null},live:{current:'driftwood-isle',worldFeet:{x:0,y:.55,z:0},crossings:0,transitions:[],residents:['driftwood-isle'],gameplayReady:true}}}});

it('seeds only the expiring canonical intent and leaves Developer false', () => {
  const values = new Map<string,string>();
  const session = {getItem:(key:string)=>values.get(key) ?? null,setItem:(key:string,value:string)=>values.set(key,value)};
  localStorage.clear();
  localStorage.setItem('wildshard.save.v2.device',JSON.stringify({keys:{devMode:{v:1,data:false}}}));
  vi.spyOn(Date,'now').mockReturnValue(123456);
  try {
    runInNewContext(publicGridIntentCode({instance:'driftwood-isle',slug:'driftwood-isle'}),{localStorage,sessionStorage:session,Date});
    const device:unknown = JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}');
    const savedSession:unknown = JSON.parse(session.getItem('wildshard.save.v2.session') ?? '{}');
    const intent={v:1,data:{instance:'driftwood-isle',slug:'driftwood-isle',at:123456}};
    expect(device).toEqual({keys:{devMode:{v:1,data:false},'gridIntent.once':intent}});
    expect(savedSession).toEqual({keys:{gridIntent:intent}});
  } finally {
    vi.restoreAllMocks(); localStorage.clear();
  }
});

it('drives the corner copy through the road, with one initial approach and no template teleport', () => {
  const [road,copy] = publicGridPlans({home:'driftwood-isle',cells});
  expect(road).toMatchObject({from:'driftwood-isle',to:null,start:{x:0,z:230},waypoints:[{x:0,z:277.5},{x:277.5,z:277.5}]});
  expect(copy).toMatchObject({from:null,to:'template-2',waypoints:[{x:277.5,z:555},{x:325,z:555},{x:555,z:555}],requiredResidents:['template-2']});
  expect(copy?.start).toBeUndefined();
});

it('walks the new northern public copy around its real hut instead of driving through its back wall', () => {
  const [road,copy] = publicGridPlans({home:'driftwood-isle',cells:[{instance:'driftwood-isle',slug:'driftwood-isle',cell:[0,0]},
    {instance:'template-1',slug:'_template',cell:[0,1]}]});
  expect(road).toMatchObject({start:{x:0,z:230},waypoints:[{x:0,z:277.5}]});
  expect(copy).toMatchObject({to:'template-1',waypoints:[{x:0,z:325},{x:-8,z:530},{x:-8,z:555},{x:0,z:555}],requiredResidents:['template-1']});
  expect(copy?.start).toBeUndefined();
});

it('requires effective public mode and excludes every Developer-only runtime resident', () => {
  expect(publicGridWitnessFailures(witness(),false)).toEqual([]);
  const checks: ((row:PublicGridWitness)=>void)[] = [row=>{row.developer=true;},row=>{row.savedDeveloper='false';},
    row=>{row.homeResidency={instance:'driftwood-isle',bytes:0};},row=>{row.homeResidency=undefined;},row=>{row.runtimeLevel='pine-hollow';},row=>{row.state.live.live.residents.push('pine-hollow');},
    row=>{row.state.live.live.residents.push('nalati-grasslands');},row=>{row.state.live.live.residents.push('far-reach');}];
  for (const change of checks) {const row=witness();row.state.cells=[...cells];change(row);expect(publicGridWitnessFailures(row,false).length).toBeGreaterThan(0);}
});

it('allows the G258 public hybrids without fabricating admission or residency', () => {
  for (const slug of ['pine-hollow','nalati-grasslands','far-reach']) {
    const row=witness();row.state.cells=[...cells,{instance:slug,slug,cell:[0,1]}];
    row.state.live.live.residents=[slug];
    expect(publicGridWitnessFailures(row,false)).toEqual([]);
    row.refusals[slug]='too-big';row.cellScreens=[{instance:slug,status:'refused',issue:'Over the memory cap'}];
    // This catalogue witness preserves the actual refusal. It never claims a walk into that cell passed.
    expect(row.refusals[slug]).toBe('too-big');
    expect(publicGridWitnessFailures(row,true)).toContain('Public template entry and residency were not witnessed');
  }
});

it('still excludes unfinished Signal Dunes and Nine Dragon from the public catalogue', () => {
  for (const slug of ['sunscar-dunes','nine-dragon-stack']) {
    const row=witness();row.state.cells=[...cells,{instance:slug,slug,cell:[0,1]}];
    expect(publicGridWitnessFailures(row,false)).toContain('Developer-only region is present in the public catalogue');
  }
});

it('requires the real template to be entered and resident at the final route witness', () => {
  const row=witness();
  expect(publicGridWitnessFailures(row,true)).toEqual(['Public template entry and residency were not witnessed']);
  row.state.inside='template-2';row.state.live.live.current='template-2';row.state.live.live.residents=['template-2'];
  expect(publicGridWitnessFailures(row,true)).toEqual([]);
  row.state.live.live.residents=[];
  expect(publicGridWitnessFailures(row,true)).toHaveLength(1);
  row.state.live.live.residents=['template-2'];row.state.live.live.current=null;
  expect(publicGridWitnessFailures(row,true)).toHaveLength(1);
});

it('reads live grid refusal screens and their original issues without writing a refusal cache', () => {
  const initial = witness();
  const state = { ...initial.state, screens: { shown: [{instance:'pine-hollow',status:'refused'}, {instance:'nalati-grasslands',status:'refused'}] },
    live: { ...initial.state.live, live: { ...initial.state.live.live, issues: {'pine-hollow':'Live sim admission deferred by the shared budget','nalati-grasslands':'Live sim admission deferred by the shared budget'} } } };
  const result: unknown = runInNewContext(`(${readPublicGridWitness.toString()})()`, {
    window: { __wildshard: { shard: { grid: { state: () => state, residency: () => ({home:initial.homeResidency}) } }, world: {game:{level:{id:'driftwood-isle'}}} } },
    document: {documentElement:{dataset:{}}}, localStorage: {getItem:()=>JSON.stringify({keys:{devMode:{data:false}}})}, sessionStorage: {getItem:()=>null},
  });
  const cellScreens=[{instance:'pine-hollow',status:'refused',issue:'Live sim admission deferred by the shared budget'},
    {instance:'nalati-grasslands',status:'refused',issue:'Live sim admission deferred by the shared budget'}];
  expect(result).toMatchObject({refusals:{},cellScreens});
  const observed={...initial,refusals:{},cellScreens};
  expect(publicGridWitnessFailures(observed,false)).toEqual([]);
});
