// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Color, MeshBasicMaterial, Scene, Vector3, BoxGeometry, BufferGeometry, PlaneGeometry, Float32BufferAttribute, PerspectiveCamera, Group } from 'three';
import { ArenaFightPageSchema, ArenaRoomEncounter, ArenaRoomPortal, BossArenaRoom, arenaRoomViews } from '../src/game/boss/arenaRoom';
import { ArenaFireView } from '../src/game/boss/arenaFire';
import { AnimalGroup } from '../src/engine/entities/animalMatrices';
import { BossEncounterDefinitionSchema } from '../src/format/bossEncounter';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { WorldRegistry } from '../src/engine/world/registry';
import marsh from './fixtures/boss-owner/marsh-room.json' with { type: 'json' };
import view from '../src/shards/nalati-grasslands/data/kurganView.json' with { type: 'json' };
import { bossArena } from './fake/bossArena';
import { SHAPES } from './fixtures/nalatiShapes';
import { ReturnProgram } from '../src/game/population/returnProgram';
import titan from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import king from '../src/shards/nalati-grasslands/data/goldenKing.generated.json' with { type: 'json' };

test('second-shard arena owns its translated floor, gate, cover and sand', () => {
 const source = structuredClone(view);
 const root = source.scene.nodes.find(node => node.id === source.scene.root);
 if (root === undefined || !('position' in root)) throw new Error('Missing room root');
 root.position = [30, 20, 40];
 const shapes = new Map([...source.scene.nodes, ...source.static.nodes].flatMap(row => 'geometry' in row ? [[row.geometry, SHAPES.handle(row.geometry).copy()]] as const : []));
 const sand = new PlaneGeometry(12,12,8,8); sand.rotateX(-Math.PI/2);
 const count = sand.getAttribute('position').count; sand.setAttribute('light',new Float32BufferAttribute(new Float32Array(count*3).fill(1),3)); sand.setAttribute('color',new Float32BufferAttribute(new Float32Array(count*3).fill(1),3));
 const sandRow = source.scene.nodes.find(row => row.id === marsh.sand);
 if (sandRow === undefined || !('geometry' in sandRow)) throw new Error('Missing floor grid');
 shapes.set(sandRow.geometry,sand);
 const room = new BossArenaRoom({ ...marsh, view: source }, shapes).build(true);
 expect(room.world(1, 2, 3).toArray()).toEqual([31, 22, 43]);
 expect(room.inChamber(new Vector3(30, 20, 40))).toBe(true);
 expect(room.inChamber(new Vector3(37, 20, 40))).toBe(false);
 expect(room.inDromos(new Vector3(30, 20, 50))).toBe(true);
 expect(room.floorHeightAt(28, 41)).toBe(20.3);
 expect(room.floorHeightAt(100, 100)).toBeUndefined();
 room.addSand(0, 0, 3, .7); expect(room.sandAt(0, 0)).toBeGreaterThan(.2);
 const before = room.sandAt(0, 0); room.drainSand(1); expect(room.sandAt(0, 0)).toBeLessThan(before);
 room.setSealed(true); const registry = new WorldRegistry(); room.register(registry);
 expect(registry.pieceList().map(piece => piece.id)).toEqual(['marsh-vault','marsh-vault-gate']);
 expect(registry.pieceList()[1]?.active?.()).toBe(true);
 const calls = arenaRoomViews(room, { reach: 3, ringMax: 12, beamRadius: 5 });
 calls['arena.lid.open']?.(1); calls['hazard.ring']?.(0, 32, 42, 3);
 expect(room.rings[0]?.mesh.position.toArray()).toEqual([2,.06,2]);
 room.setVisible(true); room.update(.1,1); expect(sand.getAttribute('position').getY(40)).toBeGreaterThan(0);
 room.clearSand(); expect(room.sandAt(0, 0)).toBe(0);
 room.setSealed(false); expect(registry.pieceList()[1]?.active?.()).toBe(false);
 const first = bossArena().build(true); expect(first.inVolume(new Vector3(30,20,40))).toBe(false);
});

test('second-shard fire rows bound capacity, own graph ids, expire and reset', () => {
 const scope = new Scope('marsh-fire'), scene = new Scene();
 const ids: string[] = [];
 lendLooks(scope, { materials: new Map(['reed-flame','reed-smoke'].map(id => [id, new MeshBasicMaterial()])),
  setParam: id => { ids.push(id); }, setTexture: () => undefined, bindMeshMap: () => { throw new Error('Unused'); } });
 try {
  const fire = new ArenaFireView(scene, { flameLook: 'reed-flame', smokeLook: 'reed-smoke', flameCount: 2, smokeCount: [3,4], smokeDetail: [0,0],
   front: [.5,.3], heat: [.2,.8], flameWidth: .8, life: [.2,0], rise: [1,0], radius: [.5,0], expansion: [2,0] }, new BufferGeometry().copy(new BoxGeometry()).toJSON());
  fire.begin(); for (let i=0;i<4;i++) fire.flame(i,0,0,i,1,1,1); fire.end(); expect(fire.flames.count).toBe(2);
  fire.puff(0,0,0,1); fire.update(.05,1,1,0,2,new Color('white'),0); expect(fire.smoke.count).toBe(1);
  expect(new Set(ids)).toEqual(new Set(['reed-flame','reed-smoke']));
  fire.out(); expect(fire.flames.count).toBe(0); expect(fire.smoke.count).toBe(1);
  fire.update(.3,1.3,1,0,2,new Color('white'),0); expect(fire.smoke.count).toBe(0);
  fire.puff(0,0,0,1); fire.clear(); fire.update(.01,1.4,0,0,0,new Color('white'),0); expect(fire.smoke.count).toBe(0);
 } finally { scope.dispose(); }
});

test('the reed vault portal owns fade, isolation, floor recovery and exit placement', async () => {
 const source = structuredClone(view), root = source.scene.nodes.find(node => node.id === source.scene.root);
 if (root === undefined || !('position' in root)) throw new Error('Missing room root');
 root.position = [30,20,40];
 const shapes = new Map([...source.scene.nodes,...source.static.nodes].flatMap(row => 'geometry' in row ? [[row.geometry,SHAPES.handle(row.geometry).copy()]] as const : []));
 const room = new BossArenaRoom({ ...marsh, sandCells: 40, view: source },shapes);
 const game = { scene: new Scene(), camera: new PerspectiveCamera() }, animals = { calm: false, group: new AnimalGroup() };
 const player = { position: new Vector3(200,2,202), velocity: new Vector3(1,-2,3), yaw: 3, pitch: .5, moveScale: 1 };
 const outside = new Group(); outside.position.set(-200,0,-200);
 game.scene.add(animals.group,game.camera,outside);
 const portalRows = { signal: 'kingDoor', spawn: { x: 0,z: 9,yaw: .3 }, end: 12,
  exitOffset: 3, slow: .4, fade: { out: 100,hold: .2,in: 300 }, keep: 'reed-sky|arrow',near: 10,floor: { tolerance: .02,depth: 4 } };
 const entrance = { x: 200,y: 2,z: 200,facing: 0 };
 const encounter = new ArenaRoomEncounter(room,{ definition: { ...v.parse(BossEncounterDefinitionSchema,king.encounter),id: 'reed-warden',name: 'The Reed Warden' },reward: { tier: 'RARE',name: 'Reed bow',flavour: '',prompt: 'TAKE REED BOW' },
  page: { ...v.parse(ArenaFightPageSchema,king.page),body: 'marsh.warden',add: { kind: 'reed-guard',variant: 'green',memory: {} } },portal: portalRows,program: titan.rules,
  client: { light: { colour: 0x88bb77,drop: 5 },prewarm: { kind: 'reed-guard',variant: 'green' },system: 'marsh.warden.power',debugZ: 9 } },entrance);
 await encounter.buildSliced({ scene: game.scene,registry: new WorldRegistry() });
 expect(encounter.spareLight.position.toArray()).toEqual([30,15,40]); expect(game.scene.children).toContain(room.group);
 const portal = new ArenaRoomPortal({ game,animals,player },room,portalRows,ReturnProgram.page(titan.rules),entrance);
 portal.update(.1,0); expect(portal.inside).toBe(false);
 portal.update(.1,.1); expect(portal.inside).toBe(false);
 portal.update(.11,.21); expect(portal.inside).toBe(true);
 expect(player.position.toArray()).toEqual([30,20,49]); expect(player.velocity.length()).toBe(0);
 expect(outside.visible).toBe(false); expect(animals.calm).toBe(true);
 portal.setLocked(true); expect(player.moveScale).toBe(0);
 portal.setLocked(false); expect(player.moveScale).toBe(1);
 player.position.set(30,19,40); portal.update(.1,.31); expect(player.position.y).toBeGreaterThanOrEqual(20);
 portal.leave(true); expect(portal.inside).toBe(true);
 portal.update(.21,.52); expect(portal.inside).toBe(false);
 expect(player.position.toArray()).toEqual([200,2,197]); expect(outside.visible).toBe(true); expect(animals.calm).toBe(false);
});
