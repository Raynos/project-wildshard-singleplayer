import { parseDecisionScripts } from '../src/format/decisionScripts';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import { zlibSync } from 'fflate';
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { parseCarriedQuest } from '../src/format/questSteps';
import { CarriedQuestProp } from '../src/game/quest/carriedProp';
import { carriedQuestRows } from '../src/shards/nalati-grasslands/generators/carriedQuest';
import * as ridingService from '../src/game/riding/client';
import { Mount } from '../src/game/riding/mount';
import { WorldRegistry } from '../src/engine/world/registry';
import { QuestState } from '../src/engine/quest/core';
import { Flags } from '../src/engine/world/interact/flags';
import { publishBoundQuest } from '../src/game/quest/boundState';
import type { ShardContext } from '../src/game/plugin/context';
import * as terrainService from '../src/engine/world/terrainHeight';
import { Scope } from '../src/engine/app/scope';
import { SkyRig } from '../src/engine/world/skyRig';
import { practiceRoom } from '../src/engine/core/practiceRoom';
import rows from '../src/shards/nalati-grasslands/data/kokpar.generated.json' with { type: 'json' };
import { buildKokparRound, KOKPAR_GOALS, type KokparMount } from './fixtures/nalati-kokpar-oracle';


it('matches frozen round rules at 10 Hz while carrying poses stay per frame', () => {
  const scope = new Scope('kokpar projection replay'), practiceBefore = practiceRoom.open;
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const events: string[] = [], expected: string[] = [], player = new THREE.Vector3(rows.home.x, 0, rows.home.z);
  const mount: KokparMount = { mounted: true, gait: 'gallop', horse: { position: player.clone(), yaw: 0 } };
  const floor = (x:number,z:number):number=>x*.001+z*.002;
  vi.spyOn(terrainService,'terrainHeight').mockImplementation(floor);
  const original = buildKokparRound(sky, floor, { toast: text => { expected.push(text); }, sting: kind => { expected.push(kind); }, onWin: () => { expected.push('won'); } }, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  Reflect.set(sky,'csm',{lights:[]});Reflect.set(sky,'sunDir',new THREE.Vector3(0,1,0));
  vi.spyOn(sky,'setupMaterial').mockImplementation(()=>undefined);
  let riding:KokparMount|null=mount;
  const native:unknown=Object.create(Mount.prototype);
  if(!(native instanceof Mount))throw new Error('Missing fixture mount');
  Object.defineProperties(native,{mounted:{get:()=>riding?.mounted??false},gait:{get:()=>riding?.gait??'stand'},horse:{get:()=>riding?.horse??null}});
  const binding=vi.spyOn(ridingService,'pageRidingMount').mockReturnValue(native);
  const ctx={} as ShardContext,flags=new Flags('carried-fixture'),quest:unknown=Object.create(QuestState.prototype);
  if(!(quest instanceof QuestState))throw new Error('Missing fixture quest');
  Object.assign(quest,{flags,def:{id:'tulpar'}});publishBoundQuest(scope,quest);
  const set=vi.spyOn(flags,'set').mockImplementation(()=>{events.push('won');});
  Object.assign(ctx,{
    scope,
    game:{runtime:{
      world:{sky,registry:new WorldRegistry(),player:{position:player,yaw:0}},
      play:{
        hud:{toast:(text:string)=>{events.push(text);}},
        music:{sting:(kind:string)=>{events.push(kind==='chunk'?'win':kind==='death'?'lose':kind);}},
      },
    }},
  });
  const current=new CarriedQuestProp(ctx,carriedQuestRows);
  const requests = vi.spyOn(ReturnProgram.prototype, 'project');
  let pending = 0;
  const project = (dt: number, next: KokparMount | null, win = false): void => {
    riding=next;
    if (win) current.win(); else current.update(dt);
    if (win) original.win();
    else {
      pending += dt;
      if (pending >= 0.1) { const elapsed = pending; pending = 0; original.update(elapsed, player, riding); }
      else if (original.carrying && riding?.horse !== null && riding?.horse !== undefined) {
        const h = riding.horse;
        original.object.position.set(h.position.x + Math.cos(h.yaw) * 0.62, h.position.y + 1.02, h.position.z - Math.sin(h.yaw) * 0.62);
        original.object.rotation.set(0, h.yaw + Math.PI / 2, 0.35);
      }
    }
    expect(events).toEqual(expected);
    expect(current.carrying).toBe(original.carrying);
    expect(current.object.position.toArray()).toEqual(original.object.position.toArray());
    expect(current.object.rotation.toArray()).toEqual(original.object.rotation.toArray());
    events.length = 0; expected.length = 0;
  };
  try {
    expect(rows.goals).toEqual(KOKPAR_GOALS);
    practiceRoom.open = true; project(0.1, mount); practiceRoom.open = false;
    project(0.1, mount); project(30, mount); project(0.000001, mount); project(15, mount);
    project(0.1, mount); project(2.5, { ...mount, gait: 'trot' }); project(0.1, { ...mount, gait: 'trot' });
    project(0.1, mount); project(0.1, null); project(0.1, mount); project(0.1, { ...mount, horse: null });
    project(0.1, mount); player.x += 1000; project(0.1, mount); player.set(rows.home.x, 0, rows.home.z);
    for (const goal of rows.goals) {
      project(0.1, mount); mount.horse?.position.set(goal.x, 3, goal.z); project(0.1, mount);
      project(4, mount); mount.horse?.position.copy(player);
    }
    project(0, mount, true); project(4, mount);
    const before = requests.mock.calls.length;
    for (let i = 0; i < 60; i++) project(1 / 60, mount);
    expect(requests.mock.calls.length - before).toBeLessThanOrEqual(10);
    // Exact pickup radius and fractional frames, repeat through 10,000 decisions.
    let rng = 613;
    for (let i = 0; i < 10000; i++) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const n = rng / 4294967296;
      player.set(rows.home.x + (i % 37 === 0 ? 3.6 : n * 3), n, rows.home.z);
      const h = mount.horse; if (h !== null) { h.position.copy(player); h.yaw = n * Math.PI; }
      project([1 / 60, 1 / 30, 1 / 20, 0, 0.100001][i % 5] ?? 0, i % 29 === 0 ? null : { ...mount, gait: n < 0.5 ? 'trot' : 'canter' });
    }
  } finally { practiceRoom.open = practiceBefore; requests.mockRestore(); scope.dispose(); binding.mockRestore();set.mockRestore();vi.restoreAllMocks(); }
});


it('an orchard delivery uses its own shape, program profile and quest effects',()=>{
  vi.spyOn(terrainService,'terrainHeight').mockImplementation(()=>0);
  const scope=new Scope('orchard carried prop'),sky:unknown=Object.create(SkyRig.prototype),native:unknown=Object.create(Mount.prototype),quest:unknown=Object.create(QuestState.prototype);
  if(!(sky instanceof SkyRig)||!(native instanceof Mount)||!(quest instanceof QuestState))throw new Error('Missing native fixture');
  Reflect.set(sky,'csm',{lights:[]});Reflect.set(sky,'sunDir',new THREE.Vector3(0,1,0));vi.spyOn(sky,'setupMaterial').mockImplementation(()=>undefined);
  const position=new THREE.Vector3(4,0,6),horse={position:position.clone(),yaw:0},events:string[]=[],ctx={} as ShardContext;
  Object.defineProperties(native,{mounted:{get:()=>true},gait:{get:()=>'gallop'},horse:{get:()=>horse}});vi.spyOn(ridingService,'pageRidingMount').mockReturnValue(native);
  const registry=new WorldRegistry();let deck:number|undefined;vi.spyOn(registry,'floorAt').mockImplementation(()=>deck);
  const flags=new Flags('orchard-carry');Object.assign(quest,{def:{id:'orchard'},flags});publishBoundQuest(scope,quest);
  Object.assign(ctx,{scope,game:{runtime:{world:{sky,registry,player:{position,yaw:0}},play:{hud:{toast:(text:string)=>{events.push(text);}},music:{sting:()=>undefined}}}}});
  const script=parseDecisionScripts([carriedQuestRows.program.script])[0],model=carriedQuestRows.model[0];if(script===undefined||model===undefined)throw new Error('Missing fixture rows');
  const shape=new THREE.BoxGeometry(1,1,1);shape.clearGroups();const blocks:Uint8Array[]=[],layout=writeGeometry(shape,blocks,'orchard crate');
  let compressed='';for(const byte of zlibSync(join(blocks)))compressed+=String.fromCodePoint(byte);
  const orchardRows={...carriedQuestRows,quest:'orchard',objectName:'harvest-crate',home:{x:4,z:6},goals:[{x:12,z:6},{x:-4,z:6}],
    model:[{...model,model:{...model.model,id:'orchard/crate',name:'Harvest crate'},source:{kind:'inline',data:btoa(compressed),geometry:layout,material:{id:'orchard-crate',family:'painterly',rim:.2,bands:.5}}}],
    program:{...carriedQuestRows.program,script:{...script,id:'orchard.carry',params:{...script.params,homeX:4,homeZ:6,goal0X:12,goal0Z:6,goal1X:-4,goal1Z:6}}},
    events:[{value:1,effects:[{kind:'toast',text:'Harvest loaded'}]},{value:7,effects:[{kind:'toast',text:'Harvest delivered'},{kind:'flag',flag:'harvest:delivered'}]}],
  };
  try{
    const prop=new CarriedQuestProp(ctx,orchardRows);prop.update(.1);expect(prop.carrying).toBe(true);expect(events).toEqual(['Harvest loaded']);
    horse.position.set(12,0,6);prop.update(.1);expect(prop.carrying).toBe(false);expect(flags.has('harvest:delivered')).toBe(true);
    expect(events).toEqual(['Harvest loaded','Harvest delivered']);expect(prop.object.position.x).toBe(12);expect(prop.object.name).toBe('harvest-crate');
    for(const [window,height,expected] of [[.75,.5,.5],[.75,.75,0],[.75,0,0],[.75,-.5,0],[2,1.5,1.5],[0,.5,0]] as const){
      deck=height;
      const sample=new CarriedQuestProp(ctx,{...orchardRows,floorWindow:window});
      expect(sample.object.position.y).toBe(expected+orchardRows.poses.home.height);
    }
    const {floorWindow,...missingWindow}=orchardRows;
    expect(floorWindow).toBe(2);
    for(const invalid of [missingWindow,{...orchardRows,floorWindow:-1},{...orchardRows,floorWindow:Infinity}])expect(()=>parseCarriedQuest(invalid)).toThrow();
    scope.dispose();expect(()=>new CarriedQuestProp(ctx,{...orchardRows,update:()=>0})).toThrow();
  }finally{scope.dispose();shape.dispose();vi.restoreAllMocks();}
});
