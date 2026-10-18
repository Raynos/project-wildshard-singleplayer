import { describe, expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, Group, MeshBasicMaterial, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { SaveStore, type SaveStorage } from '../src/engine/saves/store';
import { WorldRegistry } from '../src/engine/world/registry';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema, emptyBuildingLifeRows, type BuildingLifeLook } from '../src/format/buildings';
import { SceneRefSchema, ObservationRefSchema, admitSceneRefs } from '../src/format/sceneRefs';
import shrineRows from '../src/shards/driftwood-isle/data/buildingLife.json' with { type: 'json' };
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { createBuildingCloud } from '../src/game/shardfile/buildingCloud';

const look: BuildingLifeLook = { wheel: -0.7, door: { seconds: 2, angle: -Math.PI / 2 }, fire: [0.4, 0.6], lamp: [0, 1], glass: [0.25, 0.75],
  flicker: { depth: 0.2, waves: [[2, 3, 0.5]] }, swing: { z: [[2, 1, 0.1]], x: [3, 0.2] } };
/** Made-up second building: outward iron gate, blue lamps and a counter-rotating wheel. */
function secondBuilding(lifeLook: BuildingLifeLook = look) {
  const resources = new SceneHandles({ setupMaterial: () => undefined }), root = new Group(), gate = new Group(), wheel = new Group(), lamp = new PointLight(0x4080ff, 12), glass = new MeshStandardMaterial();
  root.add(gate, wheel, lamp); root.updateMatrixWorld(true);
  resources.publish('gate-pivot', gate); resources.publish('wheel-object', wheel); resources.publish('site', root);
  resources.publish('blue-lamp', lamp); resources.publish('glass', glass);
  const rows = emptyBuildingLifeRows();
  rows.doors.push({ id: 'east-gate', pivot: 'gate-pivot', at: [8, 2, -4], reach: 3, open: 'Enter tower', close: 'Seal tower', slab: { kind: 'box', x: 0.5, y: 1, z: 0, hx: 0.5, hy: 1, hz: 0.1, surface: 'wood' } });
  rows.wheels.push({ id: 'mill', object: 'wheel-object' }); rows.swings.push({ pivot: 'blue-lamp', seed: 4 });
  rows.flickers.push({ light: 'blue-lamp', base: 12, seed: 2, kind: 'lamp' }); rows.lamps.push({ material: 'glass', full: 5 });
  const life = new LivingBuildings(resources, lifeLook); life.add(rows); life.wheelSpeed = -0.7;
  return { resources, root, gate, wheel, lamp, glass, life, rows };
}

describe('living-building platform rows', () => {
  test('the shrine material pulse matches its original clock math day and night', () => {
    const resources = new SceneHandles({ setupMaterial: () => undefined }), material = new MeshBasicMaterial();
    resources.publish('materials.glyphs', material);
    const rows = v.parse(v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema, initialDusk: v.number() }), shrineRows);
    const life = new LivingBuildings(resources, rows.look); life.add(rows.life);
    let time = 0;
    for (const dusk of [0, 0.35, 1]) for (const dt of [0, 1 / 30, 0.1, 2]) {
      life.setDusk(dusk); life.update(dt); time += dt;
      const pulse = 0.55 + 0.45 * Math.sin(time * 1.1) * Math.sin(time * 0.37 + 1);
      const expected = new Color('#7fd9ff').multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * dusk));
      expect(material.color.toArray()).toEqual(expected.toArray());
    }
    material.dispose();
  });
  test('a second building reverses its prompted collider leaf and restores in motion', () => {
    const a = secondBuilding(), b = secondBuilding(), eye = new Vector3();
    const prompt = a.life.interactables[0], leaf = a.life.doorPieces()[0];
    if (prompt === undefined || leaf === undefined) throw new Error('Missing gate');
    expect(prompt.position.toArray()).toEqual([8, 2, -4]); expect(prompt.radius).toBe(3);
    prompt.onInteract(); a.life.tick(0.75, 0.75, eye, 0);
    expect(prompt.label).toBe('Seal tower'); expect(leaf.swinging()).toBe(true);
    expect(leaf.colliders).toEqual([a.rows.doors[0]?.slab]);
    const saved = structuredClone(a.life.snapshot()); b.life.restore(saved);
    expect(b.life.snapshot()).toEqual(a.life.snapshot()); expect(b.gate.rotation.y).toBe(a.gate.rotation.y);
    for (const fixture of [a, b]) { fixture.life.use('east-gate'); fixture.life.tick(0.25, 1, eye, 1); }
    expect(b.life.snapshot()).toEqual(a.life.snapshot()); expect(b.gate.rotation.y).toBe(a.gate.rotation.y);
    expect(prompt.label).toBe('Enter tower');
    for (const fixture of [a, b]) fixture.life.tick(1, 2, eye, 1);
    expect(leaf.swinging()).toBe(false); expect(a.gate.rotation.y).toBe(0);
    a.glass.dispose(); b.glass.dispose();
  });

  test('day/night, flicker, swing and wheel reuse their original resources', () => {
    const fixture = secondBuilding(), { life, lamp, glass, wheel } = fixture, eye = new Vector3();
    const children = [...fixture.root.children];
    life.tick(0.25, 3, eye, 0);
    expect(lamp.intensity).toBe(0); expect(glass.emissiveIntensity).toBe(1.25);
    expect(wheel.rotation.x).toBe(-0.175); expect(lamp.rotation.z).toBe(Math.sin(10) * 0.1);
    life.tick(0.25, 3, eye, 1);
    expect(lamp.intensity).toBe(12 * (1 + 0.2 * Math.sin(12) * 0.5));
    expect(glass.emissiveIntensity).toBe(5); expect(fixture.root.children).toEqual(children);
    glass.dispose();
  });

  test('registered leaves stay passable through motion and restore until the player clears', () => {
    const collisionLook = { ...look, door: { ...look.door, collision: { name: 'Tower gate', file: 'tower.json', surface: 'metal' as const, rearmRadius: 1.4 } } };
    const a = secondBuilding(collisionLook), registry = new WorldRegistry(), scope = new Scope('gate'), player = new Vector3();
    registry.scope = scope; a.life.registerDoors(registry, player);
    const piece = registry.get('east-gate');
    if (piece?.active === undefined) throw new Error('Missing kinematic gate');
    expect(piece.follows).toBe(a.gate); expect(piece.colliders).toEqual([a.rows.doors[0]?.slab]);
    expect(piece.active()).toBe(true); expect(() => a.life.registerDoors(registry, player)).toThrow('one declared');
    a.life.use('east-gate'); expect(piece.active()).toBe(false);
    a.life.tick(0.75, 0.75, player, 0);
    const b = secondBuilding(collisionLook), restored = new WorldRegistry(), resumedScope = new Scope('resumed-gate');
    b.life.restore(a.life.snapshot()); restored.scope = resumedScope; b.life.registerDoors(restored, player);
    const resumed = restored.get('east-gate');
    if (resumed?.active === undefined) throw new Error('Missing restored gate');
    expect(resumed.active()).toBe(false);
    b.life.tick(1.25, 2, player, 0); expect(resumed.active()).toBe(false);
    player.x = 1.4; expect(resumed.active()).toBe(false);
    player.x = 1.41; expect(resumed.active()).toBe(true);
    b.life.use('east-gate'); expect(resumed.active()).toBe(false);
    player.x = 0; b.life.tick(2, 4, player, 0); expect(resumed.active()).toBe(false);
    scope.dispose(); resumedScope.dispose(); expect(registry.pieces).toEqual([]); expect(restored.pieces).toEqual([]);
    a.glass.dispose(); b.glass.dispose();
  });

  test('pooled site ignition and indoor rank do not change the light count', () => {
    const { resources, root, life, glass } = secondBuilding();
    const pool = new PointLight(), outside = new Group(), inside = new Group(); root.add(outside, inside, pool);
    resources.publish('pool', pool); resources.publish('outside', outside); resources.publish('inside', inside);
    const rows = emptyBuildingLifeRows(); rows.shared.push('pool');
    rows.sites.push({ id: 'tower', root: 'site', anchors: [{ anchor: 'outside', color: 0x4080ff, intensity: 9, distance: 12, decay: 2, seed: 0, kind: 'lamp', rank: 0 }] });
    life.add(rows); const count = root.children.length;
    life.setLit('tower', false); life.tick(0, 0, new Vector3(), 1); expect(pool.intensity).toBe(0);
    life.setLit('tower', true); life.tick(0, 0, new Vector3(), 1); expect(pool.intensity).toBe(9);
    expect(root.children).toHaveLength(count); glass.dispose();
  });

  test('malformed batches and continuations refuse atomically', () => {
    const { life, rows, glass } = secondBuilding(), before = life.snapshot();
    expect(() => life.add(rows)).toThrow('Duplicate');
    expect(() => life.restore({ ...before, speed: 99, wheels: [{ id: 'foreign-wheel', angle: 10 }] })).toThrow('Incompatible');
    expect(life.snapshot()).toEqual(before);
    expect(() => life.restore({ ...before, doors: [{ id: 'east-gate', open: true, t: 2 }] })).toThrow();
    expect(() => life.add({ ...emptyBuildingLifeRows(), lamps: [{ material: 'gate-pivot', full: 2 }] })).toThrow('Expected scene material');
    const extra = { ...emptyBuildingLifeRows(), hook: () => undefined }; expect(() => life.add(extra)).toThrow('plain JSON');
    expect(life.snapshot()).toEqual(before); glass.dispose();
  });

  test('durable continuation survives fresh native identities and instance isolation', () => {
    const values = new Map<string, string>(), storage: SaveStorage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
    const store = new SaveStore({ local: storage, session: null }), a = secondBuilding(), first = new Scope('first');
    a.life.persist(store, first, { id: 'tower-one', shard: 'made-up-shard', group: 'buildings' });
    a.life.use('east-gate'); a.life.tick(0.75, 0.75, new Vector3(), 0); const expected = a.life.snapshot(); first.dispose();
    const b = secondBuilding(), second = new Scope('second'); b.life.persist(new SaveStore({ local: storage, session: null }), second, { id: 'tower-one', shard: 'made-up-shard', group: 'buildings' });
    expect(b.life.snapshot()).toEqual(expected); expect(b.gate.rotation.y).toBe(a.gate.rotation.y);
    const c = secondBuilding(), third = new Scope('third'); c.life.persist(store, third, { id: 'tower-two', shard: 'made-up-shard', group: 'buildings' });
    expect(c.life.snapshot().doors[0]?.open).toBe(false);
    expect(store.resetShard({ id: 'tower-one' })).toBe(true); second.dispose();
    const d = secondBuilding(), fresh = new Scope('new-game'); d.life.persist(store, fresh, { id: 'tower-one', shard: 'made-up-shard', group: 'buildings' });
    expect(d.life.snapshot().doors[0]?.open).toBe(false);
    fresh.dispose(); third.dispose(); for (const fixture of [a, b, c, d]) fixture.glass.dispose();
  });

  test('camp baked quads and hearth seed quads retain exact authored data and bounds', () => {
    const resources = new SceneHandles({ setupMaterial: () => undefined }), material = new MeshStandardMaterial();
    const baked = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6]), 3));
    const seeds = new BufferGeometry().setAttribute('seed', new BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), 4));
    resources.publish('baked', baked); resources.publish('seeds', seeds); resources.publish('smoke', material);
    const common = { material: 'smoke', name: 'camp-smoke', at: [4, 5, 6] as const, center: [0, 5, 0] as const, radius: 18, order: 3, visible: true };
    const camp = createBuildingCloud(resources, { ...common, geometry: 'baked', seeds: false });
    const hearth = createBuildingCloud(resources, { ...common, geometry: 'seeds', seeds: true });
    expect(camp.geometry.getAttribute('position').array).toEqual(baked.getAttribute('position').array);
    expect(camp.geometry).not.toBe(baked); expect(camp.material).toBe(material); expect(camp.position.toArray()).toEqual([4, 5, 6]);
    expect(hearth.geometry.getAttribute('aSeed').array).toEqual(seeds.getAttribute('seed').array);
    expect(hearth.geometry.boundingSphere?.center.toArray()).toEqual([0, 5, 0]); expect(hearth.geometry.boundingSphere?.radius).toBe(18);
    camp.geometry.dispose(); hearth.geometry.dispose(); baked.dispose(); seeds.dispose(); material.dispose();
  });
});

// Z11: buildings and Z2 share one namespace and typed point references.
test('scene and building handles refuse cross-kind collisions', () => {
  const handles = new SceneHandles(), root = new Group(), material = new MeshBasicMaterial();
  root.position.set(4, 2, -3); handles.publish('tower.root', root);
  handles.publish('tower.glow', material); handles.publishColliders('tower.colliders', []);
  expect(handles.object('tower.root')).toBe(root);
  expect(handles.material('tower.glow')).toBe(material);
  expect(handles.colliders('tower.colliders')).toEqual([]);
  expect(handles.point({ part: 'tower.root' }, new Vector3()).toArray()).toEqual([4, 2, -3]);
  expect(handles.point({ point: 'tower.root', offset: [1, -1, 2] }, new Vector3()).toArray()).toEqual([5, 1, -1]);
  expect(() => handles.publish('tower.root', material)).toThrow('Duplicate');
  expect(() => handles.publishColliders('tower.glow', [])).toThrow('Duplicate');
  expect(() => handles.geometry('tower.root')).toThrow('Expected scene geometry');
  expect(() => handles.point({ part: 'missing.root' }, new Vector3())).toThrow('Missing');
  expect(handles.lend(root)).toBe(handles.lend(root)); material.dispose();
});

test('figure eviction releases only its own still-current loan', () => {
  const handles = new SceneHandles(), before = new Group(), after = new Group();
  handles.publish('figure.root', before);
  expect(handles.release('figure.root', after)).toBe(false);
  expect(handles.object('figure.root')).toBe(before);
  expect(handles.release('figure.root', before)).toBe(true);
  expect(handles.has('figure.root')).toBe(false);
  handles.publish('figure.root', after);
  expect(handles.release('figure.root', before)).toBe(false);
  expect(handles.object('figure.root')).toBe(after);
});

test('cloud scene points convert into the named parent frame', () => {
  const handles = new SceneHandles(), parent = new Group(), socket = new Group();
  parent.position.set(4, 2, -3); parent.rotation.y = 0.6; parent.scale.setScalar(2);
  socket.position.set(1, 2, 3); parent.add(socket);
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const material = new MeshBasicMaterial();
  handles.publish('tower.root', parent); handles.publish('tower.socket', socket);
  handles.publish('cloud.geometry', geometry); handles.publish('cloud.material', material);
  const row = { geometry: 'cloud.geometry', material: 'cloud.material', seeds: false, name: 'cloud',
    at: { part: 'tower.socket' }, parent: 'tower.root', center: [0, 0, 0] as const, radius: 1, order: 0, visible: true };
  const cloud = createBuildingCloud(handles, row);
  expect(cloud.position.x).toBeCloseTo(1); expect(cloud.position.y).toBeCloseTo(2); expect(cloud.position.z).toBeCloseTo(3);
  expect(() => createBuildingCloud(handles, { ...row, parent: 'missing.root' })).toThrow('Missing');
  expect(() => createBuildingCloud(handles, { ...row, at: [0, 0, 0] })).toThrow('Cloud parent');
  cloud.geometry.dispose(); geometry.dispose(); material.dispose();
});


test('scene and observation refs admit only declared JSON identities', () => {
  const published = new Set(['tower.root']);
  expect(() => admitSceneRefs([{ part: 'tower.root' }, { point: 'tower.root', offset: [0, 1, 0] }, { prompt: 'gate' }], published, new Set(['gate']))).not.toThrow();
  expect(() => admitSceneRefs([{ part: 'foreign.root' }], published)).toThrow('Missing scene reference');
  expect(() => admitSceneRefs([{ prompt: 'foreign' }], published)).toThrow('Missing scene reference');
  for (const ref of [{ owner: 'world', path: ['root'] }, { part: 'tower.root', path: ['child'] }, { part: 'Tower.root' }, { point: 'tower.root', offset: [0, Number.NaN, 0] }]) expect(v.safeParse(SceneRefSchema, ref).success).toBe(false);
  for (const ref of [{ flag: 'quest.lit' }, { mark: 'gate.used' }, { mover: 'gate', state: 'moving' }]) expect(v.safeParse(ObservationRefSchema, ref).success).toBe(true);
  expect(v.safeParse(ObservationRefSchema, { owner: 'world', path: ['lit'] }).success).toBe(false);
  expect(v.safeParse(ObservationRefSchema, { mover: 'gate', state: 'unknown' }).success).toBe(false);
});
