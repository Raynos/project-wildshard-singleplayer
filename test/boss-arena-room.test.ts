import { parseClientPlan } from '../src/format/clientPlan';
import { installArenaRoomEntry } from '../src/game/shardfile/clientEntryBinds';
import { entryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { HeldClaims, type HeldSlotKit } from '../src/game/loadout/claims';
import type { ShardContext } from '../src/game/plugin/context';
import type { ModelDef } from '../src/engine/models/model';
import { currentOwner } from '../src/engine/app/ownership';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Color, MeshBasicMaterial, Scene, Vector3, BoxGeometry, BufferGeometry, PlaneGeometry, Float32BufferAttribute, PerspectiveCamera, Group, InstancedMesh } from 'three';
import { ArenaFightPageSchema, ArenaRoomEncounter, ArenaRoomPortal, BossArenaRoom, arenaRoomViews } from '../src/game/boss/arenaRoom';
import { ArenaFireView } from '../src/game/boss/arenaFire';
import { arenaFireView } from './fake/arenaViews';
import { ArenaFireSchema } from '../src/format/encounterRows';
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
import {titanPrograms as titan} from './fixtures/titanInlineWitness';
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
  const rows = v.parse(ArenaFireSchema, { flameLook: 'reed-flame', smokeLook: 'reed-smoke', flameCount: 2, smokeCount: [3,4], smokeDetail: [0,0],
   front: [.5,.3], heat: [.2,.8], flameWidth: .8, life: [.2,0], rise: [1,0], radius: [.5,0], expansion: [2,0],
   cells: { burn: 1, scatter: 0, sink: 0, size: 1, smoke: [1000,1000], scorch: { jitter: 0, lift: .1, scale: [1,0] } } });
  const fire = new ArenaFireView(scene, rows, new BufferGeometry().copy(new BoxGeometry()).toJSON());
  // R6: the drawing is the fire view module over a 2 x 2 field of 1 m cells, all four burning
  const field = { x: 0, z: 0, width: 2, depth: 2, cell: 1, states: { idle: 0, active: 1 } };
  const scorch = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4), fireView = arenaFireView(scope, field, rows, { flames: fire.flames, smoke: fire.smoke, scorch });
  fireView.modes.fill(1); fireView.lifetimes.fill(1); fireView.values['smokeRate'] = 1000;
  fireView.program.frame(.05,1); expect(fire.flames.count).toBe(2);
  fire.update(1,1,0,2,new Color('white'),0); fireView.program.frame(.05,1.05);
  expect(fire.smoke.count).toBeGreaterThan(0); expect(fire.smoke.count).toBeLessThanOrEqual(fire.smoke.instanceMatrix.count);
  expect(new Set(ids)).toEqual(new Set(['reed-flame','reed-smoke']));
  fireView.values['on'] = 0; fireView.program.frame(.01,1.06); expect(fire.flames.count).toBe(0); expect(fire.smoke.count).toBeGreaterThan(0);
  fireView.program.frame(.3,1.36); expect(fire.smoke.count).toBe(0);
  fireView.values['on'] = 1; fireView.program.frame(.05,1.4); fireView.values['clear'] = 1; fireView.values['on'] = 0; fireView.program.frame(.01,1.41); expect(fire.smoke.count).toBe(0);
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
 // The declaration borrows this actual world-built room; it never reconstructs it.
 const entryScope=new Scope('reed.entry'),ctx=legacyDouble<ShardContext>({scope:entryScope});
 const claims=HeldClaims.fromSlots({version:1,id:'reed.kit',slots:[{id:'blade',kind:'blade',item:'weapon.blade',source:{kind:'passes',file:'blade.json'}}],
  registration:['blade'],equipment:{primary:'blade',extras:[]},selection:{unlock:[]},mount:[],refills:[],upgrades:[]});
 const kit=legacyDouble<HeldSlotKit>({}),reward=legacyDouble<ModelDef<object>>({id:'reed/reward'}),seen:unknown[]=[];
 const bind=vi.spyOn(encounter,'bind').mockImplementation((actual,held,model)=>{seen.push(actual,held,model,currentOwner());});
 const pageKit=vi.spyOn(claims,'pageKit').mockReturnValue(null),model=vi.spyOn(claims,'model').mockReturnValue(reward);
 const entry={kind:'arena-room.entry' as const,owner:'reed.room',claims:'reed.kit',reward:'reedBow',publish:'reed.vault'};
 try{
  expect(()=>installArenaRoomEntry(ctx,entry)).toThrow('Missing live entry owner');
  publishEntryOwner(entryScope,'arena-room',entry.owner,encounter);publishEntryOwner(entryScope,'claims',entry.claims,claims);
  expect(()=>installArenaRoomEntry(ctx,entry)).toThrow('unbound original kit');expect(model).not.toHaveBeenCalled();
  pageKit.mockReturnValue(kit);installArenaRoomEntry(ctx,entry);
  expect(seen).toHaveLength(4);expect(seen[0]).toBe(ctx);expect(seen[1]).toBe(kit);expect(seen[2]).toBe(reward);expect(seen[3]).toBe(entryScope);expect(model).toHaveBeenCalledWith('reedBow');
  expect(entryOwner(entryScope,'arena-room',entry.publish)).toBe(encounter);
  expect(()=>installArenaRoomEntry(ctx,entry)).toThrow('unbound original kit');expect(bind).toHaveBeenCalledTimes(1);
  entryScope.dispose();expect(()=>entryOwner(entryScope,'arena-room',entry.publish)).toThrow('scope has ended');
  expect(game.scene.children).toContain(room.group);
 }finally{entryScope.dispose();bind.mockRestore();pageKit.mockRestore();model.mockRestore();}

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

test('room and approved open-arena entries keep distinct owners and strict equipment rows',()=>{
 const room={kind:'arena-room.entry',owner:'reed.room',claims:'reed.kit',reward:'reedBow',publish:'reed.vault'};
 const open={...room,owner:'reed.open',reward:'reedBlade',publish:'reed.fight',equipment:'held-finishes'};
 expect(parseClientPlan({version:1,features:[open,room]}).features).toEqual([open,room]);
 for(const features of [[room,{...open,owner:room.owner}],[room,{...open,publish:room.publish}],
   [{...open,equipment:{locker:'reflected'}}],[{...open,equipment:()=>undefined}],[{...open,locker:'new'}]])
  expect(()=>parseClientPlan({version:1,features})).toThrow();
});
