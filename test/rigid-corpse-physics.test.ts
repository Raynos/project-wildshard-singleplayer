// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the installed native physics hull builder.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { Bone, Group, Vector3 } from 'three';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { prepareRigidCorpse, type RigidCorpseRecipe } from '../src/engine/physics/rigidCorpse';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { Ragdolls, setRagdollClock, type RagdollSpec } from '../src/engine/physics/ragdoll';
import { groups } from '../src/engine/physics/groups';
import * as v from 'valibot';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { bellbackTuckedClips } from '../src/shards/driftwood-isle/generators/bellbackTuckedClips';
import { RigidCorpsePose } from '../src/engine/entities/rigidCorpsePose';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';

let R: Rapier;
beforeAll(async () => { R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))); });
const recipe: RigidCorpseRecipe = { parts: [{ bone: 'body', points: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] }] };
function rig(scale = 1) { const root = new Group(), body = new Bone(); root.scale.setScalar(scale); root.add(body); body.position.set(0, 2, 0); return { root, bones: { body } }; }
test.each([.5, 1, 2])('prepares once-scaled convex vertices and center at scale %s', scale => {
  const { root, bones } = rig(scale), part = prepareRigidCorpse(R, recipe, root, bones, scale, 'rigid')[0];
  expect(part?.desc.translation.y).toBe(2 * scale);
  expect(part?.desc.shape.type).toBe(R.ShapeType.ConvexPolyhedron);
});
test('rejects unsupported rig/bones/scales and degenerate hulls without native allocation', () => {
  const { root, bones } = rig();
  expect(() => prepareRigidCorpse(R, recipe, root, bones, 1, 'upright')).toThrow();
  expect(() => prepareRigidCorpse(R, recipe, root, bones, 1, 'quadruped')).toThrow();
  expect(() => prepareRigidCorpse(R, recipe, root, {}, 1, 'rigid')).toThrow();
  expect(() => prepareRigidCorpse(R, recipe, root, bones, 0, 'rigid')).toThrow();
  bones.body.scale.y = 2;
  expect(() => prepareRigidCorpse(R, recipe, root, bones, 1, 'rigid')).toThrow();
  bones.body.scale.y = 1;
  expect(() => prepareRigidCorpse(R, { parts: [{ bone: 'body', points: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] }] }, root, bones, 1, 'rigid')).toThrow('Degenerate');
});

function spec(scale = 1, optional = true): RagdollSpec {
  const { root, bones } = rig(scale); root.position.y = 10;
  return { root, bones, scale, build: 'rigid', lite: false,
    dims: { bodyY: 2, bodyHalfLen: 1, bodyRadius: .5, headRadius: .3, halfWidth: .5,
      ...(optional ? { rigidCorpse: recipe } : {}) },
    ...(optional ? { corpsePose: { complete: true, step: () => undefined, render: () => undefined } } : {}),
    velocity: { x: 0, y: 0, z: 0 }, hitPoint: { x: 0, y: 0, z: 0 }, dir: { x: 1, y: 0, z: 0 }, damage: 20 };
}
test.each([.5, 1, 2])('one root preserves legacy mass, COM, tensor and airborne integration at scale %s', scale => {
  const legacy = new Physics(R), posed = new Physics(R);
  try {
    legacy.world.gravity.y = 0; posed.world.gravity.y = 0;
    const old = new Ragdolls(legacy).spawn(spec(scale, false)), system = new Ragdolls(posed), current = system.spawn(spec(scale));
    const a = legacy.world.getRigidBody(0), b = posed.world.getRigidBody(0);
    expect(old?.bodies).toBe(1); expect(current?.bodies).toBe(1);
    expect(a).toBeDefined(); expect(b).toBeDefined();
    legacy.step(); posed.step();
    expect(b.mass()).toBeCloseTo(a.mass(), 5); expect(b.localCom()).toEqual(a.localCom());
    const oldTensor = a.effectiveAngularInertia(), tensor = b.effectiveAngularInertia();
    for (const key of ['m11', 'm12', 'm13', 'm22', 'm23', 'm33'] as const) expect(tensor[key]).toBeCloseTo(oldTensor[key], 4);
    expect(b.numColliders()).toBe(1);
    expect(b.collider(0).collisionGroups()).toBe(groups('DEBRIS')); expect(b.collider(0).solverGroups()).toBe(groups('DEBRIS'));
    for (let i = 0; i < 30; i++) { system.fixedPre(1 / 60); legacy.step(); posed.step(); system.fixedPost(1 / 60); }
    const ap = a.translation(), bp = b.translation(), aq = a.rotation(), bq = b.rotation();
    for (const key of ['x', 'y', 'z'] as const) expect(Math.abs(bp[key] - ap[key])).toBeLessThan(1e-4);
    for (const key of ['x', 'y', 'z', 'w'] as const) expect(bq[key]).toBeCloseTo(aq[key], 4);
    current?.dispose(); current?.dispose(); expect(system.live).toBe(0);
    expect(posed.world.bodies.len()).toBe(0); expect(posed.world.colliders.len()).toBe(0);
  } finally { legacy.dispose(); posed.dispose(); }
});
test('preparation and collider allocation failure are transactional and do not consume cap', () => {
  const physics = new Physics(R), system = new Ragdolls(physics, 1);
  try {
    expect(() => system.spawn({ ...spec(), bones: {} })).toThrow(); expect(system.live).toBe(0);
    const create = physics.world.createCollider.bind(physics.world);
    physics.world.createCollider = () => { throw new Error('injected allocation failure'); };
    expect(() => system.spawn(spec())).toThrow('injected');
    expect(system.live).toBe(0); expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
    physics.world.createCollider = create;
    const r = system.spawn(spec()); expect(r).not.toBeNull(); expect(system.spawn(spec())).toBeNull(); r?.dispose();
  } finally { physics.dispose(); }
});
test('fixed collapse blocks sleep freeze, captures every catch-up root endpoint and freezes together', () => {
  const physics = new Physics(R), system = new Ragdolls(physics); let complete = false, steps = 0, renders = 0;
  try {
    physics.world.gravity.y = 0;
    const source = spec(), r = system.spawn({ ...source, corpsePose: { get complete() { return complete; }, step: () => { steps++; }, render: () => { renders++; } } });
    const b = physics.world.getRigidBody(0); if (r === null) throw new Error('Missing body');
    b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 40; i++) { system.fixedPre(1 / 60); physics.step(); system.fixedPost(1 / 60); }
    expect(r.state).toBe('live'); expect(steps).toBe(40);
    setRagdollClock(() => .5); r.pose(5); r.pose(5); expect(steps).toBe(40); expect(renders).toBe(2);
    complete = true;
    for (let i = 0; i < 80; i++) { system.fixedPre(1 / 60); physics.step(); system.fixedPost(1 / 60); }
    expect(r.state).toBe('frozen'); expect(system.live).toBe(0);
    const frozenSteps = steps; system.fixedPre(1); r.pose(1); expect(steps).toBe(frozenSteps);
  } finally { setRagdollClock(null); physics.dispose(); }
});

test('whole-world teardown before corpse retirement never dereferences freed handles', () => {
  const physics = new Physics(R), system = new Ragdolls(physics), r = system.spawn(spec());
  physics.dispose(); expect(physics.disposed).toBe(true);
  expect(() => { system.fixedPre(1 / 60); system.fixedPost(1 / 60); r?.dispose(); r?.dispose(); }).not.toThrow();
  expect(system.live).toBe(0); expect(r?.state).toBe('gone');
});

test('deterministic native 8-part/435-point fixture follows the actual numeric collapse on one body', () => {
  const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(), v.number(), v.number()]) })),
    parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }),
    JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json', 'utf8')));
  const proposed = v.parse(v.object({ rigidCorpse: rigidCorpseSchema }), JSON.parse(readFileSync('docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json', 'utf8'))).rigidCorpse;
  const root = new Group(), bones: Record<string, Bone> = {};
  for (const row of native.bones) {
    const bone = new Bone(); bone.position.fromArray(row.pos);
    if (row.parent === null) root.add(bone);
    else {
      const parent = bones[row.parent], origin = native.bones.find(b => b.name === row.parent);
      if (parent === undefined || origin === undefined) throw new Error('Missing fixture parent');
      bone.position.sub(new Vector3(...origin.pos)); parent.add(bone);
    }
    bones[row.name] = bone;
  }
  const base = spec(), mem = { 'tg-state': 6, 'tg-clock': 0 }, position = new Vector3();
  const context: AnimalRigContext & { bones: Record<string, Bone> } = { bones, dims: { ...base.dims, bodyY: 1.2000000476837158, legLen: 0, feet: [] },
    dt: 0, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: false, deathT: 0, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const pose = new RigidCorpsePose(context, numericCreaturePose(bellbackTuckedClips()));
  const physics = new Physics(R), system = new Ragdolls(physics); root.position.y = 15;
  try {
    const r = system.spawn({ ...base, root, bones, dims: { ...base.dims, rigidCorpse: proposed }, corpsePose: pose });
    const body = physics.world.getRigidBody(0);
    expect(native.parts.reduce((n, p) => n + p.positions.length / 3, 0)).toBe(13374);
    expect(proposed.parts.reduce((n, p) => n + p.points.length, 0)).toBe(435); expect(body.numColliders()).toBe(8); expect(r?.bodies).toBe(1);
    for (let tick = 0; tick < 48; tick++) {
      system.fixedPre(1 / 60);
      for (let i = 0; i < proposed.parts.length; i++) {
        const part = proposed.parts[i]; if (part === undefined) throw new Error('Missing fixture part');
        const bone = bones[part.bone]; if (bone === undefined) throw new Error('Missing fixture bone');
        root.updateMatrixWorld(true);
        const expected = root.worldToLocal(bone.getWorldPosition(new Vector3())), actual = body.collider(i).translationWrtParent();
        expect(actual?.x).toBeCloseTo(expected.x, 5); expect(actual?.y).toBeCloseTo(expected.y, 5); expect(actual?.z).toBeCloseTo(expected.z, 5);
      }
      physics.step(); system.fixedPost(1 / 60); r?.pose(1 / 6);
      if (tick % 6 === 0 || tick === 47) {
        root.updateMatrixWorld(true);
        const directions = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 1, 1).normalize()];
        for (const direction of directions) {
          let meshMin = Infinity, meshMax = -Infinity, hullMin = Infinity, hullMax = -Infinity;
          for (const part of native.parts) {
            const bone = bones[part.name], rest = native.bones.find(b => b.name === part.name);
            if (bone === undefined || rest === undefined) throw new Error('Missing native rigid part');
            for (let vertex = 0; vertex < part.positions.length; vertex += 3) {
              const point = new Vector3().fromArray(part.positions, vertex).sub(new Vector3(...rest.pos)).applyMatrix4(bone.matrixWorld);
              const support = point.dot(direction); meshMin = Math.min(meshMin, support); meshMax = Math.max(meshMax, support);
            }
          }
          for (const part of proposed.parts) {
            const bone = bones[part.bone]; if (bone === undefined) throw new Error('Missing proposed part');
            for (const point of part.points) {
              const support = new Vector3(...point).applyMatrix4(bone.matrixWorld).dot(direction);
              hullMin = Math.min(hullMin, support); hullMax = Math.max(hullMax, support);
            }
          }
          expect(hullMin).toBeCloseTo(meshMin, 6); expect(hullMax).toBeCloseTo(meshMax, 6);
        }
      }
    }
    expect(pose.complete).toBe(true); r?.dispose(); expect(system.live).toBe(0); expect(physics.world.colliders.len()).toBe(0);
  } finally { physics.dispose(); }
});

test.each([0, 1, 2, 3, 4, 5, 6, 7])('part allocation failure at index %s releases the entire root and permits retry', index => {
  const physics = new Physics(R), system = new Ragdolls(physics, 1), source = spec(), bones: Record<string, Bone> = {};
  const points = recipe.parts[0]?.points; if (points === undefined) throw new Error('Missing tetrahedron');
  const parts = Array.from({ length: 8 }, (_, i) => {
    const name = `part${i}`, bone = new Bone(); source.root.add(bone); bones[name] = bone; return { bone: name, points };
  });
  const input = { ...source, bones, dims: { ...source.dims, rigidCorpse: { parts } } }, create = physics.world.createCollider.bind(physics.world);
  let attempt = 0;
  try {
    physics.world.createCollider = (...args) => { if (attempt++ === index) throw new Error('injected part failure'); return create(...args); };
    expect(() => system.spawn(input)).toThrow('injected'); expect(system.live).toBe(0);
    expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
    physics.world.createCollider = create;
    const next = system.spawn(input); expect(next?.bodies).toBe(1); expect(physics.world.colliders.len()).toBe(8); next?.dispose();
    expect(system.live).toBe(0); expect(physics.world.colliders.len()).toBe(0);
  } finally { physics.dispose(); }
});
test.each([0, 1, 2, 3, 4, 5, 6, 7])('invalid preparation part %s allocates nothing', index => {
  const physics = new Physics(R), system = new Ragdolls(physics), source = spec(), bones: Record<string, Bone> = {};
  const points = recipe.parts[0]?.points; if (points === undefined) throw new Error('Missing tetrahedron');
  const parts = Array.from({ length: 8 }, (_, i) => {
    const name = `part${i}`, bone = new Bone(); source.root.add(bone); bones[name] = bone;
    return { bone: i === index ? 'absent' : name, points };
  });
  try {
    expect(() => system.spawn({ ...source, bones, dims: { ...source.dims, rigidCorpse: { parts } } })).toThrow('Missing');
    expect(system.live).toBe(0); expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
  } finally { physics.dispose(); }
});

test.each([0, .24, -.24])('synthetic convex corpse settles on native plane inclination %s without changing world-only masks', angle => {
  const physics = new Physics(R), system = new Ragdolls(physics), source = spec();
  try {
    const normal = new Vector3(-Math.sin(angle), Math.cos(angle), 0);
    physics.world.createCollider(R.ColliderDesc.cuboid(20, .5, 20)
      .setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })
      .setTranslation(-normal.x * .5, -normal.y * .5, 0).setCollisionGroups(groups('WORLD')).setSolverGroups(groups('WORLD')));
    source.root.position.y = 3;
    const r = system.spawn(source); if (r === null) throw new Error('Missing corpse');
    for (let i = 0; i < 301 && r.state === 'live'; i++) { system.fixedPre(1 / 60); physics.step(); system.fixedPost(1 / 60); r.pose(1 / 60); }
    expect(r.state).toBe('frozen'); expect(system.live).toBe(0);
    const bone = source.bones['body'], part = recipe.parts[0]; if (bone === undefined || part === undefined) throw new Error('Missing tetrahedron');
    source.root.updateMatrixWorld(true);
    const minimum = Math.min(...part.points.map(p => new Vector3(...p).applyMatrix4(bone.matrixWorld).dot(normal)));
    expect(minimum).toBeGreaterThan(-.005); expect(minimum).toBeLessThan(.035);
    expect(physics.world.colliders.len()).toBe(1); r.dispose();
  } finally { physics.dispose(); }
});


test('scope retirement removes active compound ownership before the next fixed publication', () => {
  const scope = new Scope('corpse-owner'), physics = new Physics(R, undefined, scope), system = new Ragdolls(physics);
  try {
    const corpse = system.spawn(spec()); expect(system.live).toBe(1);
    scope.dispose(); expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
    expect(() => { system.fixedPre(1 / 60); system.fixedPost(1 / 60); corpse?.dispose(); }).not.toThrow();
    expect(system.live).toBe(0); expect(corpse?.state).toBe('gone');
  } finally { scope.dispose(); physics.dispose(); }
});

test('MAX_T freezes incomplete pose endpoints together and releases the cap exactly once', () => {
  const physics = new Physics(R), system = new Ragdolls(physics); let ticks = 0;
  try {
    const r = system.spawn({ ...spec(), corpsePose: { complete: false, step: () => { ticks++; }, render: () => undefined } });
    for (let i = 0; i < 310; i++) { system.fixedPre(1 / 60); physics.step(); system.fixedPost(1 / 60); }
    expect(r?.state).toBe('frozen'); expect(ticks).toBeLessThanOrEqual(301); expect(system.live).toBe(0);
    const stopped = ticks; system.fixedPre(1); r?.pose(1); r?.dispose(); r?.dispose(); expect(ticks).toBe(stopped); expect(system.live).toBe(0);
  } finally { physics.dispose(); }
});


test.each(['translation', 'rotation', 'scale'])('opt-in refuses parent %s before allocation while default admission remains unchanged', change => {
  const physics = new Physics(R), system = new Ragdolls(physics), source = spec(), parent = new Group();
  parent.add(source.root);
  if (change === 'translation') parent.position.x = 1;
  if (change === 'rotation') parent.rotation.y = .3;
  if (change === 'scale') parent.scale.setScalar(2);
  try {
    expect(() => system.spawn(source)).toThrow('identity parent');
    expect(system.live).toBe(0); expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
    const defaultSource = spec(1, false); parent.add(defaultSource.root);
    const legacy = system.spawn(defaultSource); expect(legacy?.bodies).toBe(1); legacy?.dispose();
    expect(system.live).toBe(0); expect(physics.world.bodies.len()).toBe(0);
  } finally { physics.dispose(); }
});
