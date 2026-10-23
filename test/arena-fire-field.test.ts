import { afterEach, expect, test } from 'vitest';
import { parse } from 'valibot';
import { ArenaWhirlsSchema,ArenaFireSchema,ArenaSceneSchema } from '../src/format/encounterRows';
import { BoxGeometry, BufferGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial, Scene, Vector3 } from 'three';
import { parsePrivateScene } from '../src/format/clientChannels';
import { ArenaSceneView } from '../src/game/boss/encounterView';
import { Scope } from '../src/engine/app/scope';
import { overrideTerrain } from './fake/terrain';
import { ArenaFireView, ArenaWhirlsView } from '../src/game/boss/arenaFire';
import { arenaFireView, arenaWhirlsView } from './fake/arenaViews';
import { fireViewRows } from '../src/shards/nalati-grasslands/generators/titanFireView';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };

// A made-up reed marsh (the fire cells' fixture second user): a 3 × 2 field of 2 m cells on a 1 m bank, burning 1 s.
const reeds = { flameLook: 'reed-flame', smokeLook: 'reed-smoke', flameCount: 8, smokeCount: [4, 4], smokeDetail: [0, 0],
  front: [0.5, 0.5], heat: [0.5, 0.5], flameWidth: 1, life: [0.5, 0], rise: [1, 0], radius: [0.5, 0], expansion: [1, 0],
  cells: { burn: 1, scatter: 0, sink: 0.25, size: 2, smoke: [1000, 1000], scorch: { jitter: 0, lift: 0.1, scale: [1, 0] } } };
const marsh = { x: 10, z: 20, width: 3, depth: 2, cell: 2, observations: { cx: 13, cz: 22, radius: 50, burn: 1 },
  neighbours: [[-1, 0], [1, 0]] as [number, number][], states: { idle: 0,active: 1,spent: 2 },channels: { state: 'mode',lifetime: 'burn',clock: 't',pulse: 'spread',neighbours: 'mask' },
    signals: { activate: 'fieldIgnite', step: 'fire', clock: 'fieldClock' } };

let restore = (): void => undefined;
afterEach(() => { restore(); });

function burning() {
  restore = overrideTerrain({ heightAt: () => 1, normalAt: () => [0, 1, 0] });
  const scope = new Scope('reed-marsh'), scene = new Scene();
  lendLooks(scope, { materials: new Map(['reed-flame', 'reed-smoke'].map(id => [id, new MeshBasicMaterial()])),
    setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('Unused'); } });
  const rows = parse(ArenaFireSchema, reeds), fire = new ArenaFireView(scene, rows, new BufferGeometry().copy(new BoxGeometry()).toJSON());
  const scorch = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2); scorch.count = 0;
  // R6: the fire's drawing is its view module (behaviour/titanFireView), driven here over the marsh's field and the reeds
  const view = arenaFireView(scope, marsh, rows, { flames: fire.flames, smoke: fire.smoke, scorch });
  view.ground.fill(1); view.values['smokeRate'] = reeds.cells.smoke[0] ?? 0; view.values['windX'] = 1;
  return { fire, view, scorch, scope };
}

test('a second shard\'s burning cells draw as flames on its bank with smoke rolling off', () => {
  const { fire, view, scope } = burning();
  try {
    // (11, 21) and (15, 21): cells 0 and 2 of the 3 x 2 field, burning their whole second
    for (const cell of [0, 2]) { view.modes[cell] = marsh.states.active; view.lifetimes[cell] = reeds.cells.burn; }
    expect(view.program.frame(0.1, 0)).toBe(true);
    expect(fire.flames.count).toBe(2);
    const at = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(fire.flames.instanceMatrix.array, 0));
    expect(at.x).toBeCloseTo(11, 5); expect(at.y).toBeCloseTo(0.75, 5); expect(at.z).toBeCloseTo(21, 5);
    fire.update(0, 0, 0, 0, new Color('white'), 0); view.program.frame(0.01, 0.1);
    expect(fire.smoke.count).toBeGreaterThan(0);
    view.values['on'] = 0; view.program.frame(0.01, 0.11); expect(fire.flames.count).toBe(0);
  } finally { scope.dispose(); }
});

test('burnt-out cells leave a bounded scorch that a reset clears', () => {
  const { view, scorch, scope } = burning();
  try {
    view.burnt.set([3, 0, 1, 2]); view.program.frame(0.1, 0);
    expect(scorch.count).toBe(2);
    const at = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(scorch.instanceMatrix.array, 16));
    expect(at.toArray().map(n => Math.round(n * 1000) / 1000)).toEqual([13, 1.1, 21]);
    view.burnt[0] = 0; view.values['clear'] = 1; view.program.frame(0.1, 0.1); expect(scorch.count).toBe(0);
  } finally { scope.dispose(); }
});

test('a fire without cell rows refuses to draw a field', () => {
  const { scope } = burning(), { cells: _cells, ...plain } = reeds;
  try {
    expect(() => fireViewRows(marsh, parse(ArenaFireSchema, plain))).toThrow('cell rows');
  } finally { scope.dispose(); }
});

// A made-up quarry's two dust devils (the whirlwinds' fixture second user) on their own laws, funnels and debris.
const devil = (x: number) => ({ signal: 'whirl', initial: { x, z: 0, vx: 0, vz: 0, cd: 0 }, parameters: { cx: 0, cz: 0, radius: 40, flank: 2 },
  retain: { x: 'x', z: 'z', vx: 'vx', vz: 'vz', cd: 'cd' } });
const devils = { laws: [devil(-8), devil(8)], ease: 4, spin: 2, sink: 0.2, breathe: [0.1, 1],
  debris: { count: 3, climb: 0.5, turn: 1, step: 2, radius: [0.5, 2], height: 6, axis: [0, 1, 0], roll: 1, scale: [0.5, 0.25, 2] } };

test('a second shard\'s dust devils ease in only while armed and live, spin their funnels and climb their debris', () => {
  restore = overrideTerrain({ heightAt: () => 3, normalAt: () => [0, 1, 0] });
  const funnels = [new Group(), new Group()], debris = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 6), scope = new Scope('quarry');
  const rows = parse(ArenaWhirlsSchema, devils), view = new ArenaWhirlsView(rows, ReturnProgram.page(program.wind), funnels, debris);
  // R6: the funnels' and the debris' drawing is the whirl view module (behaviour/titanWhirlsView), at the fight's slot
  const draw = arenaWhirlsView(scope, rows, funnels, debris, view.drawn);
  try {
    view.update(0.1, 0, true, 0, { wx: 1, wz: 0, px: 0, pz: 30 }); draw.frame(0.1, 0);
    expect(funnels.every(funnel => !funnel.visible)).toBe(true); expect(debris.count).toBe(0);
    view.arm(0b10);
    for (let i = 0; i < 10; i++) { view.update(0.1, i * 0.1, true, 0, { wx: 1, wz: 0, px: 0, pz: 30 }); draw.frame(0.1, i * 0.1); }
    expect(funnels[0]?.visible).toBe(false); expect(funnels[1]?.visible).toBe(true);
    const [fx = 0, fy = 0, fz = 0] = funnels[1]?.position.toArray() ?? [];
    expect(fx).toBeCloseTo(8, 5); expect(fy).toBeCloseTo(2.8, 5); expect(fz).toBeCloseTo(0, 5); expect(debris.count).toBe(3);
    const first = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(debris.instanceMatrix.array, 0));
    expect(first.y).toBeGreaterThanOrEqual(3); expect(first.y).toBeLessThanOrEqual(9);
    for (let i = 0; i < 40; i++) { view.update(0.1, 1 + i * 0.1, false, 0, { wx: 1, wz: 0, px: 0, pz: 30 }); draw.frame(0.1, 1 + i * 0.1); }
    expect(funnels[1]?.visible).toBe(false); expect(debris.count).toBe(0);
    view.reset(); expect(debris.count).toBe(0);
    expect(() => new ArenaWhirlsView(rows, ReturnProgram.page(program.wind), [new Group()], debris)).toThrow('funnel');
  } finally { scope.dispose(); }
});

// The quarry's own dressing (the arena scene's fixture second user): a dust curtain that rises with its seal, a lit spoil
// heap of instanced rocks and a scorch decal, each in its declared material.
const curtain = parsePrivateScene({ version: 1, root: 'pit', materials: ['dust', 'rock', 'burn'].map(id => ({ kind: 'port', id, source: id })), nodes: [
  { kind: 'group', id: 'pit', children: ['curtain', 'rocks', 'burnt'] },
  { kind: 'mesh', id: 'curtain', geometry: 'ring', material: 'dust', missing: 'empty', visible: false },
  { kind: 'mesh', id: 'rocks', geometry: 'rock', material: 'rock', missing: 'empty', instances: 4 },
  { kind: 'mesh', id: 'burnt', geometry: 'rock', material: 'burn', missing: 'empty', instances: 2 }] });
const box = (): Omit<ReturnType<BufferGeometry['toJSON']>, 'uuid'> => { const { uuid: _uuid, ...row } = new BufferGeometry().copy(new BoxGeometry()).toJSON(); return row; };
const quarry = parse(ArenaSceneSchema,{ scene: curtain, geometry: { ring: box(), rock: box() },
  materials: { dust: { kind: 'fx', mode: 'stream', colour: [0.6, 0.5, 0.4], alpha: 0.7, additive: false }, rock: { kind: 'lambert', colour: 0x806040 },
    burn: { kind: 'decal', colour: 0x101010, size: 2, alpha: [0, 0, 0, 255, 0, 0, 0, 128, 0, 0, 0, 64, 0, 0, 0, 0], opacity: 0.5, offset: -1 } },
  wall: { parts: ['curtain'], spin: [2], at: [5, 6], sink: 1, ease: 10 }, tells: { rockfall: { kind: 'ring', colour: [2, 1, 0.5], count: 2 } } });

test('a second shard\'s arena dresses in its own materials and raises its curtain only while sealed', () => {
  restore = overrideTerrain({ heightAt: () => 4, normalAt: () => [0, 1, 0] });
  const scene = new Scene(), view = new ArenaSceneView(scene, quarry), wall = view.mesh('curtain');
  expect(view.instances('rocks').material).toBeInstanceOf(MeshLambertMaterial); expect(view.instances('burnt').material).toHaveProperty('opacity', 0.5);
  expect(wall.position.toArray()).toEqual([5, 3, 6]);
  view.update(0.05, 0, false); expect(wall.visible).toBe(false);
  for (let i = 0; i < 20; i++) view.update(0.05, i * 0.05, true);
  expect(wall.visible).toBe(true); expect(wall.scale.y).toBeGreaterThan(0.9); expect(wall.rotation.y).toBeCloseTo(2.1, 5);
  for (let i = 0; i < 40; i++) view.update(0.05, 1 + i * 0.05, false);
  expect(wall.visible).toBe(false);
  expect(() => view.instances('curtain')).toThrow('instances');
  expect(view.tells('rockfall')).toHaveLength(2); expect(view.tell('rockfall', 1)).toBe(view.tells('rockfall')[1]); expect(() => view.tell('rockfall', 2)).toThrow('tell');
  view.tell('rockfall').ring(5, 6, 3, 1); expect(view.tell('rockfall').mesh.visible).toBe(true);
  const burn=quarry.materials['burn'];
  if(burn?.kind!=='decal')throw new Error('Expected fixture decal');
  expect(() => new ArenaSceneView(new Scene(), { ...quarry, materials: { ...quarry.materials, burn: { ...burn, alpha: [0] } } })).toThrow('RGBA');
});
