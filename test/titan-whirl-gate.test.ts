import {lendNalatiPasture} from './fixtures/nalati-return-modules';
import {parse} from 'valibot';
import {ArenaWhirlsSchema} from '../src/format/encounterRows';
import {expect,test,vi} from 'vitest';
import {BoxGeometry,Group,InstancedMesh,MeshBasicMaterial} from 'three';
import {Scope} from '../src/engine/app/scope';
import {ArenaWhirlsView} from '../src/game/boss/arenaFire';
import {ArenaWhirlsView as OriginalWhirls} from './fake/originalArenaFire';
import {ProjectedState,ReturnProgram} from '../src/game/population/returnProgram';
import {overrideTerrain} from './fake/terrain';
import {TITAN_WHIRLS,titanWhirlGate,titanWhirlView} from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import programmes from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

function trace(original:boolean,ease:number,count:number):unknown[]{
  const scope=new Scope('titan.whirl-gate'),calls:unknown[]=[],snapshots:unknown[]=[];
  const restore=overrideTerrain({heightAt:(x,z)=>{calls.push(['ground',x,z]);return x*.03-z*.01;},normalAt:()=>[0,1,0]});
  const rows=parse(ArenaWhirlsSchema,{...TITAN_WHIRLS,ease,view:titanWhirlView(count),gate:titanWhirlGate(count),laws:TITAN_WHIRLS.laws.slice(0,count)});
  const funnels=rows.laws.map(()=>new Group()),geometry=new BoxGeometry(),material=new MeshBasicMaterial(),debris=new InstancedMesh(geometry,material,count*rows.debris.count);
  lendNalatiPasture(scope);
  const wind=ReturnProgram.page(programmes.wind,scope),law=wind.project.bind(wind);
  vi.spyOn(wind,'project').mockImplementation((signal,frame,random,candidates)=>{calls.push(['law',signal,{...frame}]);return law(signal,frame,random,candidates);});
  const view=original?new OriginalWhirls(rows,wind,funnels,debris):new ArenaWhirlsView(rows,wind,funnels,debris,ReturnProgram.page(programmes.attack,scope),scope);
  let time=0,mask=0;const weights=Array.from({length:count},()=>0);
  try{
    for(let frame=0;frame<160;frame++){
      if(frame%11===0){mask=[0,1,3,-1,2,7,2**40+1,-(2**40)+2,1.9,Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY][Math.floor(frame/11)%12]??0;view.arm(mask);}
      if(frame===35||frame===79){view.reset();mask=0;expect(funnels.every(funnel=>!funnel.visible)).toBe(true);expect(debris.count).toBe(0);}
      const dt=[-0,.001,.016,.037,.1,.25,1][frame%7]??0,live=frame%13<9,think=frame%3===0?.1:0;time+=dt;
      const before=calls.length,hits=view.update(dt,time,live,think,{wx:.5,wz:-0,px:2,pz:3});
      for(let i=0;i<count;i++){
        const old=weights[i]??0;weights[i]=old+((live&&(mask&(1<<i))!==0?1:0)-old)*Math.min(1,dt*ease);
        if(view instanceof ArenaWhirlsView)expect(Object.is(view.drawn[i]?.k,weights[i])).toBe(true);
      }
      snapshots.push({visible:funnels.map(funnel=>funnel.visible),hits:hits.map(point=>point.toArray()),calls:calls.slice(before)});
    }
    return snapshots;
  }finally{scope.dispose();restore();geometry.dispose();material.dispose();}
}

test.each([[1.2,3],[4,2],[0,1],[-1,2]])('same-slot AS gate preserves original laws, shared cooldown and ground order (ease %s, count %s)',(ease,count)=>{
  expect(trace(false,ease,count)).toStrictEqual(trace(true,ease,count));
});

test('signed-zero gate operands and sparse arm frames keep their exact original arithmetic',()=>{
  const scope=new Scope('titan.whirl-signed-zero'),gate=titanWhirlGate(1);
  const state=new ProjectedState({...gate.law,signals:{step:gate.law.signal,arm:gate.arm},signal:'step'},ReturnProgram.page(programmes.attack,scope));
  try{
    state.set({zzzzWhirl0K:-0,zzzzWhirl0Shown:-0});
    state.event('arm',{zzMask:0});expect(Object.is(state.value('zzzzWhirl0K'),-0)).toBe(true);expect(Object.is(state.value('zzzzWhirl0Shown'),-0)).toBe(true);
    const old=-0,expected=old+(0-old)*Math.min(1,-0*1.2);
    state.project({dt:-0,open:0,amount:1.2,index:0});expect(Object.is(state.value('zzzzWhirl0K'),expected)).toBe(true);
  }finally{scope.dispose();}
});

test('retention maps output channels to distinct native state slots',()=>{
  const scope=new Scope('titan.whirl-alias'),rows=parse(ArenaWhirlsSchema,{...TITAN_WHIRLS,laws:TITAN_WHIRLS.laws.slice(0,1),view:titanWhirlView(1),gate:titanWhirlGate(1)});
  rows.gate.law.initial={x:0,z:0,hit:0};
  rows.gate.law.parameters={count:1,zzzzWhirl0K:.5,zzzzWhirl0On:1,zzzzWhirl0Shown:0};
  rows.gate.law.retain={zzzzWhirl0K:'x',zzzzWhirl0On:'z',zzzzWhirl0Shown:'hit'};
  rows.gate.slots=[{weight:'x',armed:'z',shown:'hit'}];
  ArenaWhirlsView.preflight(rows,ReturnProgram.projectionBindings(programmes.attack));
  const gate=rows.gate,state=new ProjectedState({...gate.law,signals:{step:gate.law.signal,arm:gate.arm},signal:'step',outputs:Object.keys(gate.law.retain)},ReturnProgram.page(programmes.attack,scope));
  try{
    state.project({dt:.25,open:1,amount:1,index:0});
    expect(state.state).toStrictEqual({x:.625,z:1,hit:1});
    expect(state.value('x')).toBe(.625);expect(state.value('hit')).toBe(1);
  }finally{scope.dispose();}
});

test('gate slots, input columns and event channels refuse before native allocation',()=>{
  const bindings=ReturnProgram.projectionBindings(programmes.attack);
  for(const kind of ['slot','same-slot','count','slot-count','input','aliased-input','initial-column','arm','channel','aliased-retain']){
    const rows=parse(ArenaWhirlsSchema,structuredClone(TITAN_WHIRLS));
    if(kind==='slot')rows.gate.slots=[{weight:'missing',armed:'missing',shown:'missing'},...rows.gate.slots.slice(1)];
    if(kind==='same-slot')rows.gate.slots=rows.gate.slots.map(slot=>({...slot,shown:slot.weight}));
    if(kind==='count')rows.gate.law.parameters['count']=9;
    if(kind==='slot-count')rows.gate.slots.pop();
    if(kind==='input')rows.gate.inputs.delta='missing';
    if(kind==='aliased-input')rows.gate.inputs.delta=rows.gate.inputs.live;
    if(kind==='initial-column')rows.gate.law.initial['missing']=0;
    if(kind==='arm')rows.gate.arm='missing';
    if(kind==='channel')rows.gate.law.retain['zzzzWhirl0K']='missing';
    if(kind==='aliased-retain')rows.gate.law.retain['zzzzWhirl0K']='zzzzWhirl0On';
    expect(()=>ArenaWhirlsView.preflight(rows,bindings)).toThrow();
  }
});

function reentrant(original:boolean,where:'law'|'ground',operation:'reset'|'arm'):unknown[]{
  const scope=new Scope('titan.whirl-reentrant'),calls:unknown[]=[],snapshots:unknown[]=[];
  const rows=parse(ArenaWhirlsSchema,{...TITAN_WHIRLS,gate:titanWhirlGate(3)}),funnels=rows.laws.map(()=>new Group());
  const geometry=new BoxGeometry(),material=new MeshBasicMaterial(),debris=new InstancedMesh(geometry,material,3*rows.debris.count);
  lendNalatiPasture(scope);
  const wind=ReturnProgram.page(programmes.wind,scope),project=wind.project.bind(wind);
  let view:OriginalWhirls|ArenaWhirlsView|null=null,armed=false;
  const interrupt=(slot:string):void=>{if(armed&&slot===where){armed=false;calls.push([operation]);if(operation==='reset')view?.reset();else view?.arm(2);}};
  const restore=overrideTerrain({heightAt:(x,z)=>{calls.push(['ground',x,z]);interrupt('ground');return x*.03-z*.01;},normalAt:()=>[0,1,0]});
  vi.spyOn(wind,'project').mockImplementation((signal,frame,random,candidates)=>{calls.push(['law',signal,{...frame}]);interrupt('law');return project(signal,frame,random,candidates);});
  try{
    view=original?new OriginalWhirls(rows,wind,funnels,debris):new ArenaWhirlsView(rows,wind,funnels,debris,ReturnProgram.page(programmes.attack,scope),scope);
    view.arm(7);view.update(.1,0,true,.1,{wx:.5,wz:0,px:2,pz:3});armed=true;
    for(let i=0;i<30;i++){
      const begin=calls.length,hits=view.update(.1,(i+1)*.1,true,.1,{wx:.5,wz:0,px:2,pz:3});
      snapshots.push({visible:funnels.map(funnel=>funnel.visible),hits:hits.map(point=>point.toArray()),calls:calls.slice(begin)});
    }
    return snapshots;
  }finally{scope.dispose();restore();geometry.dispose();material.dispose();}
}
test.each([['law','reset'],['ground','reset'],['law','arm'],['ground','arm']] as const)('reentrant %s %s keeps later members at their original native slots',(where,operation)=>{
  expect(reentrant(false,where,operation)).toStrictEqual(reentrant(true,where,operation));
});
