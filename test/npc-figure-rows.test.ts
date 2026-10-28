/// <reference types="node" />
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { FigureRowSchema, type FigureRow, type FigureCatalogueRow } from '../src/format/figures';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { NPC_FIGURE } from '../src/shards/pine-hollow/generators/peopleLook';
import { standInPerson } from './fixtures/npcFigureOracle';
import { FigureSkins, type FigureRig } from '../src/game/systems/npc/figureSkins';
import { PINE_NPC_SKINS as skins } from './fixtures/pine-program';
import { Scope } from '../src/engine/app/scope';
import { reachControl } from '../src/engine/boot/prefetch';
import { ControlRefinement } from '../src/game/shardfile/controlRefinement';
import { FigureCatalogue, type FigureSkinTiming } from '../src/game/models/figureCatalogue';
import { modelContext, specimenReady } from '../src/engine/models/model';
import { live } from '../src/engine/models/live';
import { Rng } from '../src/engine/core/rng';
import { SkyRig } from '../src/engine/world/skyRig';

function row(): FigureRow {
  return v.parse(FigureRowSchema, { id: 'person', name: 'standing', feet: [2, 3, 4], yaw: 0.3,
    fallback: { geometry: 'body', material: 'coat', glass: null, glow: 'glow' }, motion: NPC_FIGURE,
    talkHeight: 1.6, collider: { kind: 'box', ...NPC_FIGURE.collider },
    rig: { skeleton: 'npc.legs.v1', clips: ['idle', 'walk'], sockets: [] }, joints: [], sockets: [],
    visible: [], drawDistance: 140, pointAt: [8, 0, 12], points: true });
}
function resources(): SceneHandles {
  const handles = new SceneHandles({ setupMaterial: () => undefined });
  handles.publish('body', new THREE.BoxGeometry()); handles.publish('coat', new THREE.MeshStandardMaterial());
  handles.publish('glow', new THREE.MeshBasicMaterial()); return handles;
}
function drawState(group: THREE.Group) {
  group.updateMatrixWorld(true);
  return group.children.map(child => ({ position: child.position.toArray(), rotation: child.quaternion.toArray(),
    scale: child.scale.toArray(), world: child.matrixWorld.toArray(), shadow: child.castShadow }));
}

test('standing rows preserve exact fallback pose, prompt and walking anchor traces', () => {
  const handles = resources(), spec = row(), figure = new FigureRows(handles, spec);
  const original = standInPerson({ name: spec.name, feet: { x: 2, y: 3, z: 4 }, yaw: 0.3,
    body: handles.geometry('body'), bodyMaterial: handles.material('coat'), glass: null,
    glowMaterial: () => handles.material('glow'), rig: () => null, pointAt: { x: 8, z: 12 }, points: true, row: NPC_FIGURE });
  const player = new THREE.Vector3(6, 4, 8);
  for (let i = 0; i < 900; i++) {
    if (i === 160) { original.walkTo(8, 4, 12); figure.walkTo(8, 4, 12); }
    original.talking = figure.talking = i > 20 && i < 220;
    const dt = i % 2 === 0 ? 1 / 30 : 1 / 60, time = i / 30;
    original.update(dt, time, player); figure.update(dt, time, player);
    original.lod(i % 170); figure.lod(i % 170);
    expect(drawState(figure.group)).toEqual(drawState(original.group));
    expect(figure.group.position.toArray()).toEqual(original.group.position.toArray());
    expect(figure.talkPoint.toArray()).toEqual(original.talkPoint.toArray());
    expect(figure.collider).toEqual(original.collider);
  }
  figure.dispose(); expect(handles.has('person.root')).toBe(false); expect(handles.has('body')).toBe(true);
});

test('pivot rows own joint publications, fitted replacement and capsule/prompt anchors', async () => {
  const handles = resources(), group = new THREE.Group(), head = new THREE.Mesh(new THREE.BoxGeometry());
  group.position.set(3, 4, 5); group.rotation.y = 0.7; group.add(head);
  handles.publish('source', group); handles.publish('head-source', head); handles.publish('fitted', new THREE.SphereGeometry());
  const { fallback, motion, ...base } = row(); void fallback; void motion;
  const figure = new FigureRows(handles, { ...base, root: { part: 'source' },
    collider: { kind: 'capsule', y: 0.9, halfHeight: 0.62, radius: 0.26 },
    visible: [{ part: 'head-source' }], joints: [{ id: 'person.head', source: { part: 'head-source' } }],
    sockets: [{ id: 'person.socket', joint: 'person.head' }],
    replacement: { target: { part: 'head-source' }, geometry: 'fitted' } });
  await figure.ready;
  expect(handles.object('person.head')).toBe(head); expect(head.geometry).not.toBe(handles.geometry('fitted'));
  expect(handles.object('person.socket')).toBe(head);
  expect(head.geometry.getAttribute('position').array).toEqual(handles.geometry('fitted').getAttribute('position').array);
  expect(figure.headWorld(new THREE.Vector3()).toArray()).toEqual([3, 5.6, 5]);
  expect(figure.colliders).toEqual([{ kind: 'capsule', x: 0, y: 0.9, z: 0, halfHeight: 0.62, radius: 0.26 }]);
  figure.lod(150); expect(head.visible).toBe(false); figure.lod(5); expect(head.visible).toBe(true);
  const successor = new THREE.Group();
  expect(handles.release('person.root', group)).toBe(true); handles.publish('person.root', successor);
  figure.dispose(); expect(handles.has('person.head')).toBe(false); expect(handles.object('source')).toBe(group);
  expect(handles.object('person.root')).toBe(successor);
});

test('figure intake refuses executable callbacks, reflected paths and malformed rows', () => {
  const spec = row();
  expect(() => new FigureRows(resources(), { ...spec, rig: () => null })).toThrow();
  expect(() => v.parse(FigureRowSchema, { ...spec, root: { owner: 'npc', path: ['head'] } })).toThrow();
  expect(() => v.parse(FigureRowSchema, { ...spec, feet: [0, Infinity, 0] })).toThrow();
  expect(() => v.parse(FigureRowSchema, { ...spec, surprise: 'unadmitted' })).toThrow();
  expect(() => new FigureRows(resources(), { ...spec, visible: [{ point: 'body', offset: [1, 0, 0] }] })).toThrow('scene part');
  const missing = resources();
  expect(() => new FigureRows(missing, { ...spec, joints: [{ id: 'person.head', source: { part: 'missing' } }] })).toThrow('Missing');
  expect(missing.has('person.root')).toBe(false);
});

test('async skin replacement preserves exact pose inputs and scoped socket ownership', async () => {
  const load = vi.spyOn(FigureSkins.prototype, 'load');
  const build = vi.spyOn(FigureSkins.prototype, 'rig');
  const pose = vi.fn(), hand = new THREE.Bone(); hand.name = 'handR';
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  mesh.add(hand); mesh.bind(new THREE.Skeleton([hand]));
  const rig: FigureRig = { mesh, handR: hand, handAt: new THREE.Vector3(), height: 1.8, lanternAt: null, walkSpeed: 0.72, walkCycle: 0.72, pose: (...args) => { pose(...args); } };
  const skin = skins.trader.phone;
  let complete: (() => void) | undefined;
  load.mockImplementation(() => new Promise(resolve => { complete = () => { resolve({
    rig: { geometry: mesh.geometry, rest: [], height: 1.8, y0: 0, lantern: null,
      ball: [new THREE.Vector3(), new THREE.Vector3()], walkSpeed: 0.72, walkCycle: 0.72, webs: skin.webs }, map: null, normalMap: null }); }; }));
  build.mockReturnValue(rig);
  try {
    const handles = resources(), spec = v.parse(FigureRowSchema, { ...row(), skin: { ...skin, surface: { name: 'coat', roughness: 0.85, metalness: 0, normalScale: [1, -1] } },
      joints: [{ id: 'person.joint.hand', bone: 'handR' }], sockets: [{ id: 'person.hand', joint: 'handR' }] }), figure = new FigureRows(handles, spec);
    const originalPose = vi.fn();
    const original = standInPerson({ name: spec.name, feet: { x: 2, y: 3, z: 4 }, yaw: 0.3,
      body: handles.geometry('body'), bodyMaterial: handles.material('coat'), glass: null,
      glowMaterial: () => handles.material('glow'), rig: () => ({ ...rig, mesh: mesh.clone(), pose: (...args) => { originalPose(...args); } }),
      pointAt: { x: 8, z: 12 }, points: true, row: NPC_FIGURE });
    if (complete === undefined) throw new Error('Skin load did not start'); complete(); await figure.ready;
    expect(figure.resources.object('person.hand')).toBe(hand);
    expect(handles.object('person.joint.hand')).toBe(hand);
    const player = new THREE.Vector3(6, 4, 8);
    for (let i = 0; i < 600; i++) {
      if (i === 80) { original.walkTo(8, 4, 12); figure.walkTo(8, 4, 12); }
      original.talking = figure.talking = true;
      original.update(1 / 30, i / 30, player); figure.update(1 / 30, i / 30, player);
      expect(pose.mock.lastCall).toEqual(originalPose.mock.lastCall);
      expect(figure.talkPoint.toArray()).toEqual(original.talkPoint.toArray());
      expect(figure.collider).toEqual(original.collider);
    }
    figure.dispose(); expect(handles.has('person.hand')).toBe(false);
    const scope = new Scope('figure-residency'), late = new FigureRows(handles, spec, scope); scope.dispose();
    complete(); await late.ready;
    expect(handles.has('person.hand')).toBe(false); expect(build).toHaveBeenCalledTimes(1);
    expect(late.group.children.some(child => child instanceof THREE.SkinnedMesh)).toBe(false);
    expect(() => new FigureRows(handles, spec, scope)).toThrow('disposed');
  } finally { load.mockRestore(); build.mockRestore(); }
});

test('late lantern attachment stays in the declared mesh frame after world placement', async () => {
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const hand = new THREE.Bone(); hand.name = 'handR'; hand.position.set(-0.3, 1.1, 0.2);
  mesh.add(hand); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([hand]));
  const rig: FigureRig = { mesh, handR: hand, handAt: hand.position.clone(), height: 1.8,
    lanternAt: new THREE.Vector3(-0.3, 0.7, 0.2), walkSpeed: 0.72, walkCycle: 0.72, pose: () => undefined };
  const skin = skins.ranger.phone;
  const load = vi.spyOn(FigureSkins.prototype, 'load').mockResolvedValue({
    rig: { geometry: mesh.geometry, rest: [], height: 1.8, y0: 0, lantern: rig.lanternAt,
      ball: [new THREE.Vector3(), new THREE.Vector3()], walkSpeed: 0.72, walkCycle: 0.72, webs: skin.webs }, map: null, normalMap: null });
  const build = vi.spyOn(FigureSkins.prototype, 'rig').mockReturnValue(rig);
  try {
    const figure = new FigureRows(resources(), { ...row(), yaw: 0,
      skin: { ...skin, surface: { name: 'coat', roughness: 0.85, metalness: 0, normalScale: [1, -1] } } });
    await figure.ready; figure.update(0, 0, new THREE.Vector3()); figure.group.updateMatrixWorld(true);
    const flame = hand.children[0]; if (!(flame instanceof THREE.Mesh)) throw new Error('Missing declared hand attachment');
    expect(flame.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(1.7, 3.7, 4.2))).toBeLessThan(1e-12);
    const dispose = vi.spyOn(flame.geometry, 'dispose'); figure.dispose(); expect(dispose).toHaveBeenCalledOnce();
  } finally { load.mockRestore(); build.mockRestore(); }
});

test('entered figure ids resolve only their live scope and refuse ambiguity', () => {
  const a = new Scope('figure-owner-a'), b = new Scope('figure-owner-b');
  const first = new FigureRows(resources(), row(), a), second = new FigureRows(resources(), row(), b);
  try {
    expect(FigureRows.entered(a, 'person')).toBe(first);
    expect(FigureRows.entered(b, 'person')).toBe(second);
    const duplicate = new FigureRows(resources(), row(), a);
    expect(() => FigureRows.entered(a, 'person')).toThrow();
    duplicate.dispose(); expect(FigureRows.entered(a, 'person')).toBe(first);
    first.dispose(); expect(() => FigureRows.entered(a, 'person')).toThrow();
    b.dispose(); expect(() => FigureRows.entered(b, 'person')).toThrow();
  } finally { a.dispose(); b.dispose(); }
});

test.each(['complete', 'retire-queued', 'retire-started', 'refused'] as const)('off-view figure skins retain the actual control and ownership fence: %s', async mode => {
  const owner = new Scope('late-figure'), level = new Scope('late-figure-control'), frames: FrameRequestCallback[] = [];
  const raf = vi.spyOn(owner, 'raf').mockImplementation(run => { frames.push(run); return frames.length; });
  const queue = new ControlRefinement(owner, level, () => ({ x: 0, z: 0 }), async () => { await Promise.resolve(); });
  const hand = new THREE.Bone(); hand.name = 'handR';
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.add(hand); mesh.bind(new THREE.Skeleton([hand]));
  const rig: FigureRig = { mesh, handR: hand, handAt: new THREE.Vector3(), height: 1.8, lanternAt: null, walkSpeed: .72, walkCycle: .72, pose: () => undefined };
  const skin = skins.trader.phone, refusal = new Error('Original invalid skin');
  let release = (): void => { throw new Error('No started skin read'); };
  const load = vi.spyOn(FigureSkins.prototype, 'load').mockImplementation(async () => {
    await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'refused') throw refusal;
    return { rig: { geometry: mesh.geometry, rest: [], height: 1.8, y0: 0, lantern: null,
      ball: [new THREE.Vector3(), new THREE.Vector3()], walkSpeed: .72, walkCycle: .72, webs: skin.webs }, map: null, normalMap: null };
  });
  const build = vi.spyOn(FigureSkins.prototype, 'rig').mockReturnValue(rig), handles = resources();
  const figure = new FigureRows(handles, { ...row(), skin: { ...skin, late: true, surface: { name: 'coat', roughness: .85, metalness: 0, normalScale: [1, -1] } },
    joints: [{ id: 'person.joint.hand', bone: 'handR' }], sockets: [{ id: 'person.hand', joint: 'handR' }] }, owner,
  run => queue.add('npc', { x: 100, z: 100 }, run));
  const result = (async (): Promise<unknown> => { try { await figure.ready; return undefined; } catch (error: unknown) { return error; } })();
  const paint = (): void => { const frame = frames.shift(); if (frame === undefined) throw new Error('Missing controlled paint'); frame(1); };
  try {
    expect(figure.skinDeferred).toBe(true); expect(load).not.toHaveBeenCalled(); expect(handles.has('person.root')).toBe(true);
    if (mode === 'retire-queued') { owner.dispose(); reachControl(level); expect(await result).toBeUndefined(); expect(load).not.toHaveBeenCalled(); }
    else {
      reachControl(level); expect(load).not.toHaveBeenCalled(); paint(); expect(load).not.toHaveBeenCalled(); paint(); await Promise.resolve();
      expect(load).toHaveBeenCalledOnce(); if (mode === 'retire-started') owner.dispose(); release();
      expect(await result).toBe(mode === 'refused' ? refusal : undefined);
    }
    expect(build).toHaveBeenCalledTimes(mode === 'complete' ? 1 : 0);
    expect(handles.has('person.hand')).toBe(mode === 'complete');
    expect(handles.has('person.root')).toBe(mode === 'complete');
    if (mode === 'complete') { figure.update(0, 0, new THREE.Vector3()); expect(figure.group.children).toContain(mesh); }
  } finally { owner.dispose(); level.dispose(); raf.mockRestore(); load.mockRestore(); build.mockRestore(); }
});

test('catalogue metadata skips explicit late skins while ordinary preparation stays mandatory', async () => {
  const handles = resources(), owner = new Scope('skin-catalogue'), catalogue = new FigureCatalogue();
  const skin = { ...skins.trader.phone, surface: { name: 'coat', roughness: .85, metalness: 0, normalScale: [1, -1] } };
  const early = { ...row(), skin }, late = { ...row(), skin: { ...skin, late: true } };
  const prepare = vi.spyOn(FigureRows, 'prepareSkins').mockResolvedValue(undefined);
  try {
    await catalogue.admit({ figures: { early: { phone: early, desktop: early }, later: { phone: late, desktop: late } } }, handles, owner);
    expect(prepare).toHaveBeenCalledOnce(); expect(prepare.mock.calls[0]?.[0]).toHaveLength(1);
    expect(prepare.mock.calls[0]?.[0][0]?.late).toBeUndefined();
  } finally { owner.dispose(); prepare.mockRestore(); }
});

test('a late figure inside the original draw distance still reads before control', async () => {
  const owner = new Scope('near-figure'), handles = resources(), catalogue = new FigureCatalogue();
  handles.publish('0', handles.geometry('body'));
  const skin = skins.trader.phone, spec = { ...row(), skin: { ...skin, late: true, surface: { name: 'coat', roughness: .85, metalness: 0, normalScale: [1, -1] } } };
  const later = vi.fn<FigureSkinTiming['later']>().mockResolvedValue(false);
  let release: () => void = () => undefined;
  const load = vi.spyOn(FigureSkins.prototype, 'load').mockImplementation(async () => {
    await new Promise<void>(resolve => { release = resolve; });
    return { rig: { geometry: handles.geometry('body'), rest: [], height: 1.8, y0: 0, lantern: null,
      ball: [new THREE.Vector3(), new THREE.Vector3()], walkSpeed: .72, walkCycle: .72, webs: skin.webs }, map: null, normalMap: null };
  });
  try {
    await catalogue.admit({ material: { name: 'figure', roughness: .85, metalness: 0 },
      figures: { person: { phone: spec, desktop: spec, body: 0 } } }, handles, owner);
    expect(load).not.toHaveBeenCalled();
    const timing = { viewer: { x: 0, z: 0 }, later };
    const far = catalogue.create('person', handles, [200, 0, 0], 0, owner, timing);
    const near = catalogue.create('person', handles, [1, 0, 1], 0, owner, timing);
    expect(far.skinDeferred).toBe(true); expect(near.skinDeferred).toBe(false);
    expect(later).toHaveBeenCalledOnce(); expect(load).toHaveBeenCalledOnce();
    expect(near.colliders).toEqual(far.colliders); expect(near.group.position.toArray()).toEqual([1, 0, 1]);
    owner.dispose(); release(); await Promise.all([near.ready, far.ready]);
  } finally { owner.dispose(); release(); load.mockRestore(); }
});

test.each(['ready', 'retired', 'refused'] as const)('a late figure card prepares only its opened view: %s', async mode => {
  const catalogueOwner = new Scope('figure-card-catalogue'), view = new Scope('figure-card-view');
  const handles = resources(), catalogue = new FigureCatalogue(), skin = skins.trader.phone;
  handles.publish('0', handles.geometry('body'));
  const spec = { ...row(), skin: { ...skin, late: true, surface: { name: 'coat', roughness: .85, metalness: 0, normalScale: [1, -1] } } };
  const hand = new THREE.Bone(); hand.name = 'handR';
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.add(hand); mesh.bind(new THREE.Skeleton([hand]));
  const rig: FigureRig = { mesh, handR: hand, handAt: new THREE.Vector3(), height: 1.8, lanternAt: null, walkSpeed: .72, walkCycle: .72, pose: () => undefined };
  let release = (): void => undefined;
  const refusal = new Error('Original cold figure source refusal');
  const prepare = vi.spyOn(FigureRows, 'prepareSkins').mockImplementation(async selected => {
    if (selected.length === 0) return;
    await new Promise<void>(resolve => { release = resolve; });
    if (mode === 'refused') throw refusal;
  });
  const load = vi.spyOn(FigureSkins.prototype, 'load').mockResolvedValue({ rig: { geometry: mesh.geometry, rest: [], height: 1.8, y0: 0,
    lantern: null, ball: [new THREE.Vector3(), new THREE.Vector3()], walkSpeed: .72, walkCycle: .72, webs: skin.webs }, map: null, normalMap: null });
  const makeRig = vi.spyOn(FigureSkins.prototype, 'rig').mockReturnValue(rig);
  const material = vi.spyOn(SkyRig.prototype, 'setupMaterial').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const card: NonNullable<FigureCatalogueRow['figures'][string]['card']> = {
      id: `test/late-figure-${mode}`, name: 'Person', file: 'test/npc-figure-rows.test.ts', pipeline: ['code'], rig: { clips: ['idle'] },
    };
    await catalogue.admit({ material: { name: 'figure', roughness: .85, metalness: 0 }, figures: { person: {
      phone: spec, desktop: spec, body: 0, card,
    } } }, handles, catalogueOwner);
    prepare.mockClear();
    const model = catalogue.model('person');
    expect(live(model).prepare).toBeUndefined(); expect(prepare).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
    expect(() => model.build(modelContext(SkyRig.prototype), {}, new Rng(1))).toThrow('view owner');
    const root = view.run(() => model.build({ ...modelContext(SkyRig.prototype), specimenScope: view }, {}, new Rng(1)));
    if (!(root instanceof THREE.Group)) throw new Error('Missing real cold specimen root');
    const placeholder = root.children[0], ready = specimenReady(root);
    const result = (async (): Promise<unknown> => { try { await ready; return undefined; } catch (error: unknown) { return error; } })();
    expect(prepare).toHaveBeenCalledOnce(); expect(load).not.toHaveBeenCalled();
    if (mode === 'retired') view.dispose();
    release();
    expect(await result).toBe(mode === 'refused' ? refusal : undefined);
    expect(makeRig).toHaveBeenCalledTimes(mode === 'ready' ? 1 : 0);
    if (mode === 'ready') { expect(root.children).not.toContain(placeholder); expect(root.getObjectById(mesh.id)).toBe(mesh); }
    else expect(root.children).toEqual([placeholder]);
    expect(warn).toHaveBeenCalledTimes(mode === 'refused' ? 1 : 0);
  } finally {
    view.dispose(); catalogueOwner.dispose(); prepare.mockRestore(); load.mockRestore(); makeRig.mockRestore(); material.mockRestore(); warn.mockRestore();
  }
});
