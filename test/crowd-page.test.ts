import {admissionPage,admission} from './fixtures/nalati-return-modules';
import {parse} from 'valibot';
import {ActorProjectionStepV2Schema} from '../src/format/actorProjectionV2';
import {bindOriginalPageGuard,originalPageGuard,type OriginalGuardBinding} from './fixtures/originalPageGuard';
import {Scope} from '../src/engine/app/scope';
import {AnimalSim} from '../src/engine/entities/AnimalSim';
import {app} from '../src/engine/app/runtime';
import {ActorProjectionV2} from '../src/game/population/actorProjectionV2';
import guardProjection from '../src/shards/nalati-grasslands/data/crowdProjection.json' with {type:'json'};
import {SIM_LEVEL} from './fixtures/sim-level/level';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { createPageCrowds, thinkCrowdGuard } from '../src/game/ambient/crowdPage';
import type { SkyRig } from '../src/engine/world/skyRig';
import { legacyDouble } from './fake/FakeGame';
import { admittedSheepBody } from './fake/admittedSheep';
import view from '../src/shards/nalati-grasslands/data/crowdView.json' with { type: 'json' };
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { wildEnv } from '../src/game/population/pageGroups';

/** The live Nalati sheep body, read through the page crowd's own product reader. */
const sheepBody = admittedSheepBody;

function projectedRows(guard:OriginalGuardBinding['row']){
  const rows=parse(ActorProjectionStepV2Schema,guardProjection);
  rows.clock=guard.clock;rows.every=guard.every;
  const keys=new Map([['dogThinkAt',guard.clock],['barkT',guard.memory.bark],['rest',guard.memory.rest],['snarl',guard.memory.snarl],['low',guard.memory.low]]);
  for(const column of rows.columns){if(column.source.kind==='memory')column.source.key=keys.get(column.source.key)??column.source.key;if(column.source.kind==='crowd')column.source.distance=guard.straggler;}
  for(const operation of rows.operations){if(operation.kind==='memory')operation.key=keys.get(operation.key)??operation.key;
    if(operation.kind==='sound-position'){operation.cue=guard.bark;operation.height=guard.soundHeight;}
    if(operation.kind==='state')operation.states=guard.states;}
  return rows;
}

test('an unrelated marsh crowd uses its own bounds, identity, material and native cadence', async () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000);
  const sky = legacyDouble<SkyRig>({ csm: legacyDouble<SkyRig['csm']>({ lights: [] }), sunDir: new Vector3(0, 1, 0), setupMaterial: () => undefined });
  const body = await sheepBody(), geometry = body.geometry,scope=new Scope('marsh.guard');
  const row = { id: 'marsh.cranes', kind: 'flock', x: 12, z: -25, count: 3, seed: 17, range: 20, runSpeed: 4, walkSpeed: .8, grazeStep: .2, bleatCue: 'crane.call' };
  const guard = { signal: 'dog', clock: 'marsh.guardClock', every: .2, straggler: 15, bark: 'crane.alarm', soundHeight: .8, memory: { bark: 'marsh.bark', rest: 'marsh.rest', snarl: 'marsh.snarl', low: 'marsh.low' }, states: ['idle', 'alert', 'stalk', 'wander'] };
  const data = { guard:{projection:projectedRows(guard)}, slug: 'reed-marsh', hull: null, bounds: [-40, 70, -90, 40], rows: [row], material: { rim: .3, bands: .6 }, view: { ...view, name: 'marsh.cranes' } };
  const wet = wildEnv.wetAt.bind(wildEnv), grass = wildEnv.grassHeightAt.bind(wildEnv);
  wildEnv.wetAt = () => false; wildEnv.grassHeightAt = () => 0;
  try {
    const invalidGuard={...data.guard.projection,operations:data.guard.projection.operations.map(operation=>operation.kind==='state'?{...operation,states:['missing.guard.state']}:operation)};
    expect(()=>createPageCrowds(sky,5,body,{...data,guard:{projection:invalidGuard}},[],scope)).toThrow('Invalid crowd guardian states');
    const crowds = createPageCrowds(sky, 5, body, data,[],scope);
    expect(crowds.runtime.policies.has('marsh.cranes')).toBe(true);
    expect(() => crowds.factory({ x: 0, z: 0, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    const draw = crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0);
    const actor = legacyDouble<Animal>({ entityId:'marsh.guard',alive: true, position: new Vector3(12, 0, -25), mem: {}, lookTarget: new Vector3(), lookWeight: 0, state: 'idle', yaw: 0, setMotion: () => undefined });
    crowds.guardian(actor, 0, admissionPage(scope), new Rng(4));
    const frame = legacyDouble<ThinkCtx>({ dt: .1, t: 1, player: new Vector3(), pathYaw: () => 0, steer: () => undefined, confine: () => undefined });
    thinkCrowdGuard(actor, frame); expect(actor.mem['marsh.guardClock']).toBe(1); expect(Number.isFinite(actor.mem['marsh.bark'])).toBe(true);
    frame.t = 1.1; thinkCrowdGuard(actor, frame); expect(actor.mem['marsh.guardClock']).toBe(1);
    expect(draw.mesh.name).toBe('marsh.cranes'); expect(draw.n).toBe(3);
    crowds.advance(draw, 0, 1, new Vector3(14, 0, -20), .1, .1, crowds.runtime.advance);
    expect(() => crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    draw.mesh.geometry.dispose();
    for (const material of Array.isArray(draw.mesh.material) ? draw.mesh.material : [draw.mesh.material]) material.dispose();
    draw.mesh.customDepthMaterial?.dispose();
    expect(() => createPageCrowds(sky, 5, body, { ...data, bounds: [10, -10, 0, 40] })).toThrow('bounds');
  } finally { scope.dispose();wildEnv.wetAt = wet; wildEnv.grassHeightAt = grass; geometry.dispose(); }
});

test('entered page rows reuse the original admission owner and keep guard cadence, sound, RNG and native operation order',async()=>{
  setTerrainHeight(()=>2);setTerrainPlacement(()=>[0,1,0],()=>-1000);
  const sky=legacyDouble<SkyRig>({csm:legacyDouble<SkyRig['csm']>({lights:[]}),sunDir:new Vector3(0,1,0),setupMaterial:()=>undefined});
  const body=await sheepBody(),scope=new Scope('guard-page'),world={slug:'reed-marsh',hull:null,bounds:[-50,50,-50,50],
    rows:[{id:'marsh',kind:'flock',x:0,z:0,count:3,seed:17,range:20,runSpeed:4,walkSpeed:.8,grazeStep:.2,bleatCue:'sheep'}],
    material:{rim:.3,bands:.6},view:{...view,name:'marsh'}};
  const oldGuard={signal:'dog',clock:'dogThinkAt',every:.1,straggler:12,bark:'dog_bark',soundHeight:.6,
    memory:{bark:'barkT',rest:'rest',snarl:'snarl',low:'low'},states:['idle','alert','stalk','wander']};
  const traces:unknown[][]=[[],[]],actors:Animal[]=[],randoms:Rng[]=[],frames:ThinkCtx[]=[],draws:ReturnType<ReturnType<typeof createPageCrowds>['factory']>[]=[];
  const wet=wildEnv.wetAt.bind(wildEnv),grass=wildEnv.grassHeightAt.bind(wildEnv),emit=vi.spyOn(app.events,'emit');
  wildEnv.wetAt=()=>false;wildEnv.grassHeightAt=()=>0;
  try{
    for(let index=0;index<2;index++){
      const trace=traces[index];if(trace===undefined)throw new Error('Missing trace');
      const first=SIM_LEVEL.entities[0];if(first===undefined)throw new Error('Missing actor');
      const sim=new AnimalSim(first.spec,first.seed,first.scale,'guard',{heightAt:()=>2,random:()=>.5});
      const actor:Animal=legacyDouble<Animal>({entityId:sim.entityId,alive:true,position:sim.position,mem:sim.mem,lookTarget:sim.lookTarget,lookWeight:0,state:'idle',yaw:0,setMotion:sim.setMotion.bind(sim),
        snapshot:()=>{const saved=sim.snapshot();return {...saved,state:actor.state,motion:{...saved.motion,lookWeight:actor.lookWeight}};}});
      actor.position.set(3,2,4);actors.push(actor);
      const wolf=legacyDouble<Animal>({alive:true,position:new Vector3(10,2,0)});
      const data={...world,guard:{projection:projectedRows(oldGuard)}};
      const crowds=createPageCrowds(sky,5,body,data,[wolf],scope),draw=crowds.factory({x:0,z:0,count:3,seed:22,range:20},0);draws.push(draw);
      const random=new Rng(31);randoms.push(random);
      const programme=index===0?ReturnProgram.page({script:admission.script,bytes:admission.bytes}):admissionPage(scope);
      if(index===0)bindOriginalPageGuard(actor,{row:oldGuard,flock:draw,wolves:[wolf],author:programme,random});else crowds.guardian(actor,0,programme,random);
      if(index===1)expect(new ActorProjectionV2('guard',{program:admission,step:guardProjection}).program(scope)).toBe(programme);
      frames.push(legacyDouble<ThinkCtx>({dt:1/60,t:0,player:new Vector3(9,2,4),pathYaw:(_actor:Animal,x:number,z:number,period=1)=>{trace.push(['path',x,z,period]);return .3;},
        steer:(_actor:Animal,yaw:number,speed:number,turn:number)=>{trace.push(['steer',yaw,speed,turn]);},confine:()=>{trace.push(['confine']);}}));
    }
    for(let tick=0;tick<120;tick++){
      for(const [index,actor]of actors.entries()){
        const frame=frames[index],trace=traces[index];if(frame===undefined||trace===undefined)throw new Error('Missing frame');
        frame.t=tick/60;emit.mockClear();if(index===0)originalPageGuard(actor,frame);else thinkCrowdGuard(actor,frame);
        for(const [name,event]of emit.mock.calls)if(name==='creature.sound')trace.push(['sound',event]);
      }
      const first=actors[0],second=actors[1];if(first===undefined||second===undefined)throw new Error('Missing guards');
      expect(second.snapshot()).toStrictEqual(first.snapshot());expect(randoms[1]?.snapshot()).toStrictEqual(randoms[0]?.snapshot());
      expect(traces[1]).toStrictEqual(traces[0]);traces.forEach(trace=>{trace.length=0;});
    }
  }finally{
    emit.mockRestore();scope.dispose();wildEnv.wetAt=wet;wildEnv.grassHeightAt=grass;
    for(const draw of draws){for(const material of Array.isArray(draw.mesh.material)?draw.mesh.material:[draw.mesh.material])material.dispose();draw.mesh.customDepthMaterial?.dispose();}
    body.geometry.dispose();
  }
});
