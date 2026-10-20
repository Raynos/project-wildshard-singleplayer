import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3, type Vector2 } from 'three';
import { parse } from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { app } from '../src/engine/app/runtime';
import type { Game } from '../src/engine/core/Game';
import { CombatCues } from '../src/engine/combat/cues';
import { Impacts } from '../src/engine/fx/Impacts';
import { CueDirector } from '../src/game/audio/cueDirector';
import { CueDirectorSchema } from '../src/format/cueDirector';
import * as sceneSources from '../src/game/shardfile/sceneSources';
import { createModelLibrary } from '../src/game/plugin/geometry';
import type { ShardContext } from '../src/game/plugin/context';
import king from '../src/shards/pine-hollow/data/kingCues.json' with { type: 'json' };

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function nativeGame(scope: Scope): Game {
  const game = {} as Game;
  Object.defineProperties(game, { levelScope: { value: scope }, app: { value: app }, scene: { value: new Scene() }, onUpdate: { value: () => () => undefined },
    camera: { value: new PerspectiveCamera(60) }, renderer: { value: { getDrawingBufferSize: (out: Vector2) => out.set(800, 600) } } });
  return game;
}

test('real King rows preserve native impact kind, count, position and direction', () => {
  const scope = new Scope('king-cues'), game = nativeGame(scope), burst = vi.spyOn(Impacts.for(game), 'burst').mockImplementation(() => undefined);
  const director = new CueDirector(game, king), point = new Vector3(100, 12.5, -37), direction = new Vector3(0.3, -0.2, 0.9);
  const observed: { material: string; point: number[]; direction: number[]; count: number | undefined }[] = [];
  burst.mockImplementation((material, at, aim, count) => { observed.push({ material, point: at.toArray(), direction: aim.toArray(), count }); });
  for (const id of ['cue.king.bark', 'cue.king.ember.open', 'cue.king.ember.shut']) director.cue(id, point, direction);
  director.cue('cue.king.stomp', point, new Vector3(0, 1, 0)); director.cue('cue.king.lantern', point, new Vector3(0, 1, 0));
  expect(observed).toEqual([
    { material: 'wood', point: [100, 12.5, -37], direction: [-0.3, 0.2, -0.9], count: 8 },
    { material: 'sparks', point: [100, 12.5, -37], direction: [-0.3, 0.2, -0.9], count: 14 },
    { material: 'sparks', point: [100, 12.5, -37], direction: [-0.3, 0.2, -0.9], count: 5 },
    { material: 'dirt', point: [100, 12.8, -37], direction: [0, 1, 0], count: 24 },
    { material: 'sparks', point: [100, 12.8, -37], direction: [0, 1, 0], count: 16 },
  ]);
  expect(point.toArray()).toEqual([100, 12.5, -37]); expect(direction.toArray()).toEqual([0.3, -0.2, 0.9]);
  scope.dispose(); expect(() => director.cue('cue.king.bark', point, direction)).toThrow('disposed');
});

test('field cues share one native cosmetic salt and keep source-clock motion before sound', () => {
  const scope = new Scope('field-cues'), root = new Group(), game = nativeGame(scope), sound = vi.fn(() => true), cues = new CombatCues(sound);
  const material = scope.own(new MeshBasicMaterial()), library = createModelLibrary<string, string>({ meshes: [], hd: [], meshUrls: {}, hdUrls: {}, hdLooks: {}, aoFloor: 1 }, 'cue fixture');
  library.bindLooks(scope, { materials: new Map([['streak', material]]), bindMeshMap: () => material });
  vi.spyOn(sceneSources, 'sceneModelSource').mockReturnValue(library);
  const ctx = { scope, root, product: {}, game: { runtime: { world: { game }, play: { cues } } } } as ShardContext;
  let tick: ((dt: number, time: number) => void) | undefined;
  Object.defineProperty(ctx, 'system', { value: (system: Parameters<ShardContext['system']>[0]) => { tick = system.run; } });
  const field = { library: 'fixture', look: 'streak', name: 'streak', shape: 'streak', count: 3, life: 0.7 };
  const director = CueDirector.install(ctx, { version: 1, fields: [{ id: 'streaks', ...field }, { id: 'petals', ...field }], rows: [
    { id: 'cue.wind', sound: 'cue.sword.heavy', soundPhase: 'heavy', vfx: ['streaks', 'petals'].map(id => ({ kind: 'field', field: id, ahead: 0.2, offset: [0, -0.25, 0] })) },
  ] });
  const random = vi.spyOn(app.rng.stream('cosmetic'), 'next');
  const point = new Vector3(3, 7, -1), direction = new Vector3(0.3, 0.8, -0.4);
  director.cue('cue.wind', point, direction);
  expect(random).toHaveBeenCalledTimes(1); expect(sound).toHaveBeenCalledWith('cue.sword.heavy', { phase: 'heavy' });
  const salts = root.children.map(object => {
    expect(object.position.toArray()).toEqual([3.06, 6.75, -1.08]); expect(object.visible).toBe(true);
    if (!(object instanceof Mesh || object instanceof Points)) throw new Error('Field requires geometry');
    const geometry: unknown = object.geometry;
    if (!(geometry instanceof BufferGeometry)) throw new Error('Field requires buffer geometry');
    const attribute: unknown = geometry.getAttribute('aBurst');
    if (!(attribute instanceof BufferAttribute)) throw new Error('Field requires its native burst attribute');
    return attribute;
  });
  const [first, second] = salts;
  if (first === undefined || second === undefined) throw new Error('Both fields must exist');
  expect(first.array).toEqual(second.array);
  if (tick === undefined) throw new Error('Field clock is absent');
  tick(0.2, 0.2); expect(first.getX(0)).toBeCloseTo(0.2); tick(0.51, 0.71);
  expect(root.children.every(object => !object.visible)).toBe(true); scope.dispose(); expect(root.children).toHaveLength(0);
});

test('delayed cues copy source values and are cancelled with the owner', () => {
  vi.useFakeTimers();
  const scope = new Scope('delayed-cues'), game = nativeGame(scope), burst = vi.spyOn(Impacts.for(game), 'burst').mockImplementation(() => undefined);
  const director = new CueDirector(game, { ...king, rows: [{ ...king.rows[0], delay: 0.1 }] });
  const point = new Vector3(1, 2, 3), direction = new Vector3(0, 0, 1);
  director.cue('cue.king.bark', point, direction); point.set(9, 9, 9); vi.advanceTimersByTime(100);
  expect(burst.mock.calls[0]?.[1].toArray()).toEqual([1, 2, 3]);
  director.cue('cue.king.bark', point, direction); scope.dispose(); vi.advanceTimersByTime(100); expect(burst).toHaveBeenCalledTimes(1);
});

test('unknown cues, callbacks, duplicate ids and unbound field targets refuse', () => {
  for (const rows of [{ ...king, owner: () => 1 }, { ...king, rows: [king.rows[0], king.rows[0]] },
    { version: 1, fields: [], rows: [{ id: 'cue.bad', vfx: [{ kind: 'field', field: 'missing', ahead: 0, offset: [0, 0, 0] }] }] }])
    expect(() => parse(CueDirectorSchema, rows)).toThrow();
  const scope = new Scope('missing-cue'), director = new CueDirector(nativeGame(scope), king);
  expect(() => director.cue('cue.missing', new Vector3(), new Vector3())).toThrow('Unknown'); scope.dispose();
});

// A made-up ember marsh (the director's fixture second user): lit mud that falls and settles, unlit sparks pushed downwind.
const marsh = { version: 1, fields: [], sprays: [
  { id: 'mud', capacity: 8, additive: false, lit: true, renderOrder: 3, fade: [4, 0, 1], vertexShader: 'void main(){}', fragmentShader: 'void main(){}' },
  { id: 'sparks', capacity: 4, additive: true, lit: false, renderOrder: 4, fade: [2, 6, 0.2], vertexShader: 'void main(){}', fragmentShader: 'void main(){}' }],
rows: [{ id: 'cue.marsh.splash', vfx: [
  { kind: 'spray', spray: 'mud', count: 6, speed: 2, up: 3, push: 0, life: 1, size: 0.1, colour: [0.3, 0.2, 0.1], jitter: 0, spread: 0.2, flags: ['gravity', 'bounce'], offset: [0, 0.5, 0] },
  { kind: 'spray', spray: 'sparks', count: 2, speed: 0, up: 0, push: 4, life: 0.5, size: 0.2, colour: [2, 1, 0.2], jitter: 0, spread: 0, flags: ['grow'], offset: [0, 0, 0] }] }] };

function sprayOf(scene: Scene, name: string): { renderOrder: number; attribute: (name: string) => BufferAttribute; material: ShaderMaterial } {
  const points = scene.getObjectByName(name);
  if (!(points instanceof Points)) throw new Error(`Missing spray ${name}`);
  const geometry: unknown = points.geometry, material: unknown = points.material;
  if (!(geometry instanceof BufferGeometry) || !(material instanceof ShaderMaterial)) throw new Error('Spray requires buffer geometry and its shaders');
  return { renderOrder: points.renderOrder, material, attribute: attributeName => {
    const attribute: unknown = geometry.getAttribute(attributeName);
    if (!(attribute instanceof BufferAttribute)) throw new Error(`Missing ${attributeName}`); return attribute;
  } };
}

test('a second shard\'s sprays burst, fall, settle, grow and fade by its rows, lit only where declared', () => {
  const restore = overrideTerrain({ heightAt: () => 2 });
  try {
    const scope = new Scope('marsh-sprays'), game = nativeGame(scope), director = new CueDirector(game, marsh);
    const mud = sprayOf(game.scene, 'cue-mud'), sparks = sprayOf(game.scene, 'cue-sparks');
    expect(mud.renderOrder).toBe(3); expect(sparks.material.blending).not.toBe(mud.material.blending);
    director.cue('cue.marsh.splash', new Vector3(10, 2, -4), new Vector3(1, 0, 0));
    const lift = mud.attribute('position');
    for (let i = 0; i < 6; i++) { expect(lift.getY(i)).toBeGreaterThanOrEqual(2.5); expect(Math.hypot(lift.getX(i) - 10, lift.getZ(i) + 4)).toBeLessThanOrEqual(0.2); }
    director.update(0.1);
    expect(sparks.attribute('position').getX(0)).toBeCloseTo(10 + 4 * 0.965 * 0.1, 5);
    expect(sparks.attribute('aSize').getX(0)).toBeGreaterThan(0.2 * 0.6);
    for (let i = 0; i < 60; i++) director.update(1 / 60);
    for (let i = 0; i < 6; i++) expect(mud.attribute('position').getY(i)).toBeGreaterThan(2.029);
    director.setLight(0.3); expect(mud.material.uniforms['uLight']?.value).toBe(0.3); expect(sparks.material.uniforms['uLight']?.value).toBe(1);
    for (let i = 0; i < 60; i++) director.update(1 / 30);
    for (let i = 0; i < 6; i++) expect(mud.attribute('aAlpha').getX(i)).toBe(0);
    scope.dispose(); expect(game.scene.getObjectByName('cue-mud')).toBeUndefined();
  } finally { restore(); }
});

test('spray targets refuse undeclared sprays', () => {
  expect(() => parse(CueDirectorSchema, { ...marsh, sprays: [] })).toThrow();
  expect(() => parse(CueDirectorSchema, { ...marsh, sprays: [marsh.sprays[0], marsh.sprays[0]] })).toThrow();
});
