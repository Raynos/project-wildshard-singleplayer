import { PagePastureRaid } from '../src/game/riding/pagePasture';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { PageWildlife } from '../src/game/population/wildlife';
import { CrowdTargets } from '../src/game/shardfile/crowdRuntime';
import { FlockBrain } from '../src/engine/ai/flock';
import { parseFlock } from '../src/format/crowds';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { legacyDouble } from './fake/FakeGame';
import { headlessAssembly } from '../src/shards/nalati-grasslands/generators/nativeGroups';

test('orchard population emits crowd work between native groups and mount placement', () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0,1,0],() => -1000);
  const source = headlessAssembly.constants.pageWildlife,bodies: Animal[] = [],herds: AnimalManager['herds'] = [];
  const manager = legacyDouble<AnimalManager>({ animals: bodies,herds,wetAt: () => false,
    addHerd: (kind,x,z) => { herds.push({ kind,cx: x,cz: z,members: [] }); return herds.length-1; },
    spawn: (kind,x,z,yaw,variant) => {
      const position = new Vector3(x,0,z),body = legacyDouble<Animal>({ entityId: `orchard:${String(bodies.length)}`,kind,variant: variant ?? 'plain',position,yaw,
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
  population.beginFrame(.1,{ position: new Vector3(),forward: new Vector3(0,0,-1),crouching: true },{ health01: .4 });
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
});
