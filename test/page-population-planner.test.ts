import { PopulationRelations } from '../src/game/population/relations';
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { afterEach, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { PagePopulationPlanner, PageGroups, wildEnv, renderedPackOf, renderedHerdOf } from '../src/game/population/pageGroups';
import { nearestPopulationActor } from '../src/game/shardfile/groupRuntime';
import { Scope } from '../src/engine/app/scope';
import { zlibSync } from 'fflate';
import brains from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { legacyDouble } from './fake/FakeGame';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };

afterEach(() => { setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000); });

test('marsh page groups resolve native ids, adoption and water from rows without ports', () => {
  const make = (id: string,variant: string,x: number): Animal => legacyDouble<Animal>({ entityId: id,variant,position: new Vector3(x,0,0),
    yaw: 0,scale: 1,lastHitT: -Infinity,maxHp: 100,hp: 100,mem: {},alive: true });
  const scout = make('marsh.scout','reed',0),kid = make('marsh.kid','fawn',3),buck = make('marsh.buck','antlered',5);
  const manager = legacyDouble<AnimalManager>({ animals: [scout,kid,buck] });
  const wet = btoa(String.fromCodePoint(...zlibSync(new Uint8Array(Float32Array.from([1,1,1,1]).buffer))));
  const rows = { pack: { ...brains.pack,id: 'marsh.pack',members: ['unused'],home: [0,0],leaderVariant: 'reed',runSpeed: 6 },
    herd: { ...brains.herd,id: 'marsh.herd',members: ['unused'],stallionVariant: 'antlered',foalPrefix: 'fawn' },
    contacts: { pack: strikes.wolf,herd: strikes.stallion },world: { res: 2,size: 32,water: -1,wet,pond: wet },
    wind: { x: 0,z: 1,strength: .5 },prey: 'marsh',damage: admission };
  const scope = new Scope('marsh');
  try {
    wildEnv.enter(scope,rows,ReturnProgram.page(admission,scope)); const groups = new PageGroups(manager,[],rows),pack = groups.pack([scout.entityId],0,0),herd = groups.herd([kid.entityId]);
    herd.adoptStallion(buck);
    expect(renderedPackOf(scout)).toBe(pack); expect(renderedHerdOf(kid)).toBe(herd); expect(renderedHerdOf(buck)).toBe(herd);
    expect(pack.findPrey?.(0,0,10)).toBe(kid); expect(herd.findThreat?.(3,0,10)).toBe(scout);
    expect(wildEnv.wetAt(0,0)).toBe(true); expect(wildEnv.downwind(0,5,new Vector3())).toBe(true);
    expect(() => groups.pack(['marsh.missing'],0,0)).toThrow('Missing rendered group actor');
  } finally { scope.dispose(); }
});

test('an unrelated marsh roster uses guest member plans and preserves group allocation order', () => {
  setTerrainHeight(() => 2); setTerrainPlacement(() => [0, 1, 0], () => 0);
  const bodies: Animal[] = [], herds: AnimalManager['herds'] = [];
  const manager = legacyDouble<AnimalManager>({ animals: bodies, herds, wetAt: () => false,
    addHerd: (kind, x, z) => { herds.push({ kind, cx: x, cz: z, members: [] }); return herds.length - 1; },
    spawn: (kind, x, z, yaw, variant) => {
      if (typeof variant !== 'string') throw new Error('Expected a declared variant');
      const position = new Vector3(x, 2, z);
      const body = legacyDouble<Animal>({ kind, variant, position, yaw, herd: -1,
        place: (px, pz, heading) => { position.set(px, 2, pz); body.yaw = heading; } }); bodies.push(body); return body;
    } });
  const random = new Rng(90), planner = new PagePopulationPlanner(manager, ReturnProgram.page(admission), random,
    { begin: 'begin', spot: 'spot', accept: 'accept', yaw: 'yaw' });
  const result = planner.planned({ kind: 'marsh-deer', x: 12, z: 18, variants: ['reed', 'russet', 'fawn', 'pale-fawn', 'antlered'],
    observations: { mares: 2, foals: 1, stallion: 1, coats: 2 }, start: 'herdStart', member: 'herdMember', offset: 'foal' });
  expect(result.every((body, index) => body === bodies[index])).toBe(true); expect(result).toHaveLength(4);
  expect(herds[0]?.members.every((body, index) => body === result[index])).toBe(true);
  expect(result.every(body => body.herd === 0)).toBe(true);
  expect(result[2]?.variant).toBe('fawn'); expect(result[3]?.variant).toBe('antlered');
  expect(result[3]?.position).toEqual(new Vector3(28, 2, 22));
  const younger = result[2], parent = result[0]; if (younger === undefined || parent === undefined) throw new Error('Missing family');
  expect(Math.abs(younger.position.x - parent.position.x)).toBeLessThanOrEqual(2);
  const scattered = planner.scatter({ kind: 'marsh-crane', x: -30, z: 20, radius: 5, variants: ['grey', 'white'] });
  expect(scattered.map(body => body.variant)).toEqual(['grey', 'white']); expect(scattered.every(body => body.herd === 1)).toBe(true);
});

test('marsh groups apply AS alert and range gates to their original owners', () => {
  const body = legacyDouble<Animal>({ position: new Vector3(0, 0, 0), mem: {}, alive: true });
  const scares: number[] = [], disturbances: number[] = [], stampedes: number[] = [];
  const pack = { members: [body], awareness: .1, scare: (_x: number, _z: number, radius: number) => { scares.push(radius); } };
  const herd = { members: [body], cx: 100, cz: 0, stampeding: true,
    disturb: (x: number) => { disturbances.push(x); }, stampede: (x: number) => { stampedes.push(x); } };
  const relations = new PopulationRelations(ReturnProgram.page(admission), { packs: [pack], herds: [herd], crowds: [] },
    { alert: 'whistle', range: 'scare', packRadius: 7, disturbRadius: 12, disturbSeconds: 2, scareSeconds: 3 });
  expect(nearestPopulationActor([body], 2, 0, 3)).toBe(body);
  expect(nearestPopulationActor([body], 2, 0, 2)).toBeNull();
  relations.alert(0, 0); expect(body.mem['aw']).toBeCloseTo(.3); expect(pack.awareness).toBeCloseTo(.4);
  relations.disturb(2, 0); expect(disturbances).toEqual([2]);
  relations.scare(0, 0, 20); expect(stampedes).toEqual([]); expect(scares).toEqual([7]);
  relations.scare(100, 0, 20); expect(stampedes).toEqual([100]);
  relations.ripple(); expect(scares).toEqual([7, 7, 7]);
});
