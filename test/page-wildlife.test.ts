import { App } from '../src/engine/app/app';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import { PlayerHealth } from '../src/engine/combat/health';
import type { ShardContext } from '../src/game/plugin/context';
import { bindPageGroups, wildEnv } from '../src/game/population/pageGroups';
import { PagePastureRaid } from '../src/game/riding/pagePasture';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { PageWildlife } from '../src/game/population/wildlife';
import { CrowdTargets } from '../src/game/shardfile/crowdRuntime';
import { FlockBrain } from '../src/engine/ai/flock';
import { parseFlock } from '../src/format/crowds';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { Player } from '../src/engine/player/Player';
import { knockdownVelocity } from '../src/game/population/relations';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { legacyDouble } from './fake/FakeGame';
import { headlessAssembly } from '../src/shards/nalati-grasslands/generators/nativeGroups';

test('orchard population emits crowd work between native groups and mount placement', () => {
  const previous=app.levelScope,previousHealth=wildEnv.playerHealth01,scope=new Scope('orchard.health');app.levelScope=scope;
  const health=new PlayerHealth(app.events,{now:()=>0,dodging:()=>false,dodgeGuard:()=>false,position:()=>new Vector3()});app.registerPlayer(health,scope);health.attributes.health=40;
  try{
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0,1,0],() => -1000);
  const source = headlessAssembly.constants.pageWildlife,bodies: Animal[] = [],herds: AnimalManager['herds'] = [];
  const manager = legacyDouble<AnimalManager>({ animals: bodies,herds,wetAt: () => false,
    addHerd: (kind,x,z) => { herds.push({ kind,cx: x,cz: z,members: [] }); return herds.length-1; },
    spawn: (kind,x,z,yaw,variant) => {
      const position = new Vector3(x,0,z),body = legacyDouble<Animal>({ entityId: `orchard:${String(bodies.length)}`,kind,variant: typeof variant === 'string' ? variant : 'plain',position,yaw,
        herd: -1,seed: .5,setMotion: () => undefined,scale: 1,mem: {},lastHitT: -Infinity,maxHp: 100,hp: 100,alive: true,speed: 0,
        place: (px,pz,heading) => { position.set(px,0,pz); body.yaw = heading; } }); bodies.push(body); return body;
    } });
  const rows = { ...source,pastureActor: { ...source.pastureActor,kind: 'deer',variant: 'tame',label: 'Orchard rider',raiders: ['elder','russet'],cues: { ...source.pastureActor.cues,start: { text: 'Orchard raid',sound: null } } },kinds: { predator: 'boar',mount: 'deer',guardian: 'hound',guardianVariant: 'black' },coats: ['russet'],young: ['fawn','pale-fawn'],leader: 'antlered',
    groups: { ...source.groups,pack: { ...source.groups.pack,id: 'orchard.pack' },herd: { ...source.groups.herd,id: 'orchard.herd' } },
    packs: [{ x: 1,z: 1,variants: ['elder'] }],herds: [],flocks: [{ x: 4,z: 4,count: 24,dog: false,range: 12 }],
    mountables: [{ x: 8,z: 8,yaw: 0,variant: 'tame' }],foragers: null };
  const population = new PageWildlife(manager,rows),build = population.buildSteps();
  expect(build.next().value).toEqual({ kind: 'pause' }); expect(bodies.map(body => body.kind)).toEqual(['boar']);
  const command = build.next().value; if (command?.kind !== 'crowd') throw new Error('Missing explicit crowd work');
  expect(command.index).toBe(0); expect(bodies).toHaveLength(1);
  const controller = new FlockBrain({ heightAt: () => 0,normalY: () => 1,inBounds: () => true,wetAt: () => false,playerCrouched: () => false,
    grassHeightAt: () => .5,trample: () => undefined,centre: () => undefined },parseFlock({ id: 'orchard.crowd',kind: 'flock',...command.options,runSpeed: 4,walkSpeed: 1,grazeStep: .2,bleatCue: 'bleat' }));
  controller.initialize(); const view = new CrowdTargets(controller,{ preyY: .5,hits: [[0,.5,.4]] });
  expect(population.attachCrowd(command.index,view)).toBeNull(); expect(build.next().value).toEqual({ kind: 'pause' }); expect(build.next().done).toBe(true);
  expect(population.mountables[0]?.kind).toBe('deer'); expect(population.flocks).toEqual([view]);
  population.beginFrame(.1,{ position: new Vector3(),forward: new Vector3(0,0,-1),crouching: true },{});
  expect(wildEnv.playerHealth01).toBe(.4);health.attributes.health=25;
  population.beginFrame(.1,{position:new Vector3(),forward:new Vector3(0,0,-1),crouching:true},{});expect(wildEnv.playerHealth01).toBe(.25);
  expect(population.predators.map(body => body.kind)).toEqual(['boar']);
  population.killCrowd({ flock: view,index: 0 }); expect(view.alive).toBe(23);
  population.endFrame(.1,new Vector3(),0,true);
  const raid = new PagePastureRaid(manager,population,population.pastureProfile);
  expect(raid.shepherd?.kind).toBe('deer'); expect(raid.shepherd?.label).toBe('Orchard rider');
  expect(raid.start(true)).toBe(true); expect(raid.raids).toBe(1);
  expect(raid.nextCue()).toMatchObject({ kind: 'start',text: 'Orchard raid' });
  const saved = raid.snapshot(); raid.restore(saved); expect(raid.nextCue()).toBeUndefined(); expect(raid.snapshot()).toEqual(saved);
  for(let i=0;i<5;i++)raid.update(1/60,new Vector3(),[],i/60);
  expect(raid.snapshot().state).toEqual(saved.state);
  raid.update(1/60,new Vector3(),[],.1); expect(raid.snapshot().elapsed).toBe(0);
  }finally{scope.dispose();app.levelScope=previous;wildEnv.playerHealth01=previousHealth;}
});


test.each([false,true])('orchard group admission restores observations across retained=%s entry',retained=>{
  const scope=new Scope('orchard.groups'),previous=wildEnv.wind;
  const rows={...headlessAssembly.constants.pageGroups,wind:{x:1,z:0,strength:.25}},base=legacyDouble<ShardContext>({scope,app:new App()});
  const hooks=retained?new RetainedRuntimeHooks(base,{deferActivation:true}):null,ctx=hooks?.context??base;
  try{
    bindPageGroups(ctx,rows);if(hooks!==null){expect(wildEnv.wind).toBe(previous);hooks.activate();}
    expect(wildEnv.wind).toEqual(rows.wind);expect(wildEnv.wind).not.toBe(previous);
    if(hooks!==null){wildEnv.wind.strength=.7;hooks.deactivate();expect(wildEnv.wind).toBe(previous);hooks.activate();expect(wildEnv.wind.strength).toBe(.7);}
    expect(()=>bindPageGroups(ctx,{...rows,install:()=>undefined})).toThrow();
  }finally{scope.dispose();}
  expect(wildEnv.wind).toBe(previous);
});


test('orchard population rows own notice cooldowns and native knockback effects until exit',()=>{
  const scope=new Scope('orchard.effects'),application=new App(),toast=vi.fn<(text:string)=>void>(),flash=vi.fn<()=>void>(),dash=vi.fn<Player['dash']>();
  const world=legacyDouble<NonNullable<ShardRuntime['world']>>({player:legacyDouble<Player>({dash})});
  const hud=legacyDouble<NonNullable<ShardRuntime['play']>['hud']>({toast,damageFlash:flash});
  const runtime=legacyDouble<ShardRuntime>({world,play:legacyDouble<NonNullable<ShardRuntime['play']>>({hud})});
  const ctx=legacyDouble<ShardContext>({scope,app:application,game:legacyDouble<ShardContext['game']>({runtime})});
  const rows={...headlessAssembly.constants.pageGroups,effects:{notices:[{signal:'grunt',text:'Boars nearby',every:2}],knockdown:{speed:4,min:.25,max:2,seconds:.5,text:'Fallen',every:1}}};
  try{
    bindPageGroups(ctx,rows);
    application.events.emit('creature.signal',{name:'grunt',x:0,z:0});application.events.emit('creature.signal',{name:'grunt',x:0,z:0});
    application.events.emit('creature.signal',{name:'howl',x:0,z:0});application.events.flush('update');expect(toast.mock.calls).toEqual([['Boars nearby']]);
    application.clock.tick(2);application.events.emit('creature.signal',{name:'grunt',x:0,z:0});application.events.flush('update');expect(toast).toHaveBeenCalledTimes(2);
    application.events.emit('creature.knockdown',{x:3,z:4,strength:4});application.events.emit('creature.knockdown',{x:3,z:4,strength:4});
    application.events.flush('update');expect(dash).toHaveBeenCalledTimes(2);expect(dash).toHaveBeenLastCalledWith(4.8,6.4,.5);expect(flash).toHaveBeenCalledTimes(2);expect(toast).toHaveBeenLastCalledWith('Fallen');expect(toast).toHaveBeenCalledTimes(3);
    const out={x:9,z:9};knockdownVelocity(rows.effects.knockdown,0,0,0,out);expect(out).toEqual({x:0,z:0});
    expect(()=>bindPageGroups(ctx,{...rows,effects:{...rows.effects,knockdown:{...rows.effects.knockdown,min:3}}})).toThrow();
  }finally{scope.dispose();}
  application.events.emit('creature.knockdown',{x:3,z:4,strength:4});application.events.emit('creature.signal',{name:'grunt',x:0,z:0});application.events.flush('update');expect(dash).toHaveBeenCalledTimes(2);expect(toast).toHaveBeenCalledTimes(3);
});
