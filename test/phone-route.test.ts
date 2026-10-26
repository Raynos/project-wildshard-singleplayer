// @vitest-environment node
import { expect, test } from 'vitest';
import { Window } from 'happy-dom';
import { phoneEngine } from '../scripts/parity/phone-route-runner.mjs';
import { phoneRouteFailures, phoneRoutePlans, type PhoneReceipt, type PhoneObservation } from '../scripts/parity/phone-route.mjs';
import { phoneTouchButton } from '../scripts/parity/phone-route-page.mjs';

test('native touch sends the HOVER pointerdown handler and ordinary menu click without changing game state',async()=>{
  const dom=new Window(), button=dom.document.createElement('button'), events:string[]=[];
  button.className='ws-touch-hover';dom.document.body.append(button);
  Object.defineProperty(button,'getClientRects',{value:()=>[{x:0,y:0,width:50,height:50}]});
  button.addEventListener('pointerdown',event=>{events.push('hover');event.preventDefault();});
  button.addEventListener('pointerup',()=>{events.push('up');});
  button.addEventListener('click',()=>{events.push('menu-click');});
  const replacements={document:dom.document,HTMLButtonElement:dom.HTMLButtonElement,PointerEvent:dom.PointerEvent};
  const previous=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  try{
    expect(phoneTouchButton('.ws-touch-hover')).toBe(true);
    expect(events).toEqual(['hover','up','menu-click']);
    button.disabled=true;expect(()=>phoneTouchButton('.ws-touch-hover')).toThrow('Unavailable');
    expect(events).toEqual(['hover','up','menu-click']);
  }finally{
    for(const [key,descriptor] of previous){if(descriptor===undefined)Reflect.deleteProperty(globalThis,key);else Object.defineProperty(globalThis,key,descriptor);}
    await dom.happyDOM.close();
  }
});

function observation(): PhoneObservation {
  return { at: 1000, frame: 100, frameAt: 1000, ready: true, current: 'home', inside: 'home', home: 'home', pitch:562.5,
    feet:{x:0,y:.5,z:0}, cells:[
      {instance:'home',slug:'driftwood-isle',cell:[0,0],shows:'playing',drawn:{far:false,near:false,l0:15,l1:16}},
      {instance:'market',slug:'open-plot-night-market',cell:[-1,1],shows:'tiles',drawn:{far:false,near:false,l0:15,l1:16}},
      {instance:'outer-market',slug:'open-plot-night-market',cell:[-1,-2],shows:'far proxy',drawn:{far:true,near:false,l0:0,l1:0}},
    ], grain:0,frameAvailable:true,hover:false,fps:30,pill:'30 fps',fatal:[],contextLost:false };
}
function receipt(): PhoneReceipt {
  const state=observation(), market=state.cells[1];
  if(market===undefined)throw new Error('Missing fixture market');
  return {protocol:'jake-phone-route/1',sha:'a'.repeat(40),version:{build:'aaaaaaa-fixture'},engine:'webkit-iphone',
    steps:['title','SHARD SELECT','grid','Driftwood','road','Night Market','road return','Driftwood return'],
    paint:{heroMs:420,fcpMs:300,heroURL:'/assets/title/main-crossroads-square.jpg'},
    entry:{at:1000,frame:100,inside:'market',current:'market',ready:true,cell:market,grain:0},
    wall:{from:{x:-93.75,y:.45,z:-218.75},wallX:-82.75,elapsedMs:4000,startedFrame:0,finalFrame:120,
      final:{x:-83.15,y:.45,z:-218.75},hover:true,previous:{yaw:0,hover:false},
      samples:Array.from({length:120},(_,i)=>({ms:(i+1)*1000/30,x:i<80?-93.75+10.6*i/80:-83.15,z:-218.75,hover:true,frame:i+1}))},
    fps:['Driftwood','road','Night Market'].map(label=>({label,elapsedMs:10000,frames:300,worstMs:34,pillFps:30,pill:'30 fps'})),
    observations:Array.from({length:6},()=>observation()),frames:Array.from({length:7},(_,i)=>({label:String(i),width:192,height:400,darkShare:.1})),faults:[],routes:[],failures:[]};
}

test('only an available iOS runtime selects Simulator; unavailable runtime records the WebKit equivalent',()=>{
  expect(phoneEngine({runtimes:[{identifier:'com.apple.CoreSimulator.SimRuntime.iOS-26-0',isAvailable:true}]})).toBe('simulator');
  expect(phoneEngine({runtimes:[{identifier:'com.apple.CoreSimulator.SimRuntime.iOS-26-0',isAvailable:false}]})).toBe('webkit');
  expect(phoneEngine({runtimes:[{identifier:'com.apple.CoreSimulator.SimRuntime.tvOS-26-0',isAvailable:true}]})).toBe('webkit');
  expect(()=>phoneEngine({})).toThrow('Invalid Simulator');
});

test('route follows the served lattice and uses held input for all four actual crossings without a pose seed',()=>{
  const {market,plans}=phoneRoutePlans(observation());
  expect(market).toBe('market');
  expect(plans.map(p=>[p.from,p.to])).toEqual([['home',null],[null,'market'],['market',null],[null,'home']]);
  expect(plans.every(p=>p.start===undefined&&p.finishOnArrival!==true)).toBe(true);
  expect(plans[0]?.waypoints).toEqual([{x:0,z:-281.25}]);
  expect(plans[1]?.waypoints).toEqual([{x:-281.25,z:-281.25},{x:-281.25,z:281.25},{x:-656.25,z:281.25},{x:-656.25,z:343.75}]);
  const invalid=observation();invalid.cells=[];expect(()=>phoneRoutePlans(invalid)).toThrow('unambiguous');
});

test('complete receipt passes, while a near proxy, zero tiles or late readiness fails the first-entry gate',()=>{
  expect(phoneRouteFailures(receipt())).toEqual([]);
  for(const mode of ['proxy','empty','unready','missing'] as const){
    const r=receipt();if(r.entry?.cell===undefined)throw new Error('Missing fixture entry');
    if(mode==='proxy')r.entry.cell={...r.entry.cell,drawn:{...r.entry.cell.drawn,far:true}};
    if(mode==='empty')r.entry.cell={...r.entry.cell,drawn:{...r.entry.cell.drawn,l0:0,l1:0}};
    if(mode==='unready')r.entry.ready=false;
    if(mode==='missing')r.entry=null;
    expect(phoneRouteFailures(r)).toContain('Night Market near tiles absent on first geometric entry');
  }
});

test('wall gate refuses a board crossing, no collider, no movement, or a nonsettling endpoint',()=>{
  for(const mode of ['cross','no-collider','no-movement','no-frames','unmounted'] as const){
    const r=receipt();if(r.wall===null)throw new Error('Missing fixture wall');
    if(mode==='cross')r.wall.samples.push({ms:4000,x:-80,z:-218.75,hover:true,frame:121});
    if(mode==='no-collider')r.wall.wallX=Number.NaN;
    if(mode==='no-movement')r.wall.final.x=r.wall.from.x;
    if(mode==='no-frames')r.wall.finalFrame=1;
    if(mode==='unmounted')r.wall.hover=false;
    expect(phoneRouteFailures(r).some(row=>row.startsWith('Board'))).toBe(true);
  }
});

test('wall-clock freezes, missing pill, slow hero, missing return, grain, black frames and wrong SHA remain red',()=>{
  const modes=['freeze','pill','hero','return','grain','black','sha','fatal'] as const;
  for(const mode of modes){
    const r=receipt();
    if(mode==='freeze')r.fps=[{label:'road',frames:1,elapsedMs:10000,worstMs:9999,pillFps:1,pill:'1 fps'}];
    if(mode==='pill'&&r.fps[0])r.fps[0].pillFps=Number.NaN;
    if(mode==='hero')r.paint.heroMs=501;
    if(mode==='return')r.steps.pop();
    if(mode==='grain'&&r.observations[1])r.observations[1].grain=.12;
    if(mode==='black'&&r.frames[0])r.frames[0].darkShare=.95;
    if(mode==='sha')r.version.build='bbbbbbb-fixture';
    if(mode==='fatal')r.faults.push('runtime refusal');
    expect(phoneRouteFailures(r),mode).not.toEqual([]);
  }
});

