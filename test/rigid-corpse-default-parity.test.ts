// oxlint-disable-next-line import/no-nodejs-modules -- Read the exact, provenance-pinned pre-feature implementation.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the baseline before executing its controlled module shim.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate only the reviewed repository baseline with whitelisted imports.
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from '@typescript/typescript6';
import * as THREE from 'three';
import { beforeAll, afterEach, expect, test } from 'vitest';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Ragdolls, RAGDOLL_CAP, setRagdollClock, type RagdollSpec, type RagdollBuild } from '../src/engine/physics/ragdoll';
import * as collisionGroups from '../src/engine/physics/groups';
import * as queries from '../src/engine/physics/query';
import * as fixedStep from '../src/engine/core/fixedStep';
import * as tier from '../src/engine/core/tier';
import { packedCreatureBodies, type PackedCreatureBodies } from '../src/game/plugin/geometry';
import bakedCreatures from '../src/shards/driftwood-isle/data/creatureBodies.generated.json' with { type: 'json' };

// The baseline is a byte-for-byte Git blob from this ancestor, not a rewritten oracle.
const BASELINE_SHA = '540a4156ec261fe95e8bcf6b9f420d67bd9532ef';
const BASELINE_HASH = 'a385a470f0940b26c12d9cc255d78a0690882dfaec5eaad122ab471a21e257e3';
interface LegacyRagdoll {
  state: 'live' | 'frozen' | 'gone'; readonly bodies: number; fastest: number;
  pose: (dt: number) => void; dispose: () => void; rootPosition: (out: THREE.Vector3) => THREE.Vector3;
}
interface LegacySystem { live: number; spawn: (spec: RagdollSpec) => LegacyRagdoll | null }
interface LegacyModule {
  Ragdolls: new (physics: Physics, cap?: number) => LegacySystem;
  setRagdollClock: (fn: (() => number) | null) => void;
  RAGDOLL_CAP: { phone: number; desktop: number };
}
let R: Rapier, old: LegacyModule, fixtures: PackedCreatureBodies;
beforeAll(async () => {
  R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  fixtures = packedCreatureBodies(bakedCreatures, undefined, () => Promise.resolve(new Uint8Array(readFileSync(`public${bakedCreatures.file}`))));
  await fixtures.preload();
  const source = readFileSync('docs/reviews/rigid-corpse-default-parity/ragdoll-540a4156.ts.txt', 'utf8');
  expect(createHash('sha256').update(source).digest('hex')).toBe(BASELINE_HASH);
  const imports: Record<string, unknown> = { three: THREE, './groups': collisionGroups, './query': queries,
    '../core/fixedStep': fixedStep, '../core/tier': tier };
  const exports: Record<string, unknown> = {};
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    fileName: `ragdoll-${BASELINE_SHA}.ts` }).outputText;
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unreviewed baseline dependency: ${name}`);
    return imports[name];
  } }, { filename: `ragdoll-${BASELINE_SHA}.js` });
  if (typeof exports['Ragdolls'] !== 'function' || typeof exports['setRagdollClock'] !== 'function') throw new Error('Missing baseline API');
  old = exports as LegacyModule;
});
afterEach(() => { setRagdollClock(null); old.setRagdollClock(null); });

function specimen(build: RagdollBuild, lite: boolean, scale: number, damage = 42): RagdollSpec {
  // Existing committed creature bake: real authored rigs and dimensions, decoded through the native loader.
  // This is a renderer-free physics proof, not evidence of product opt-in or a mounted playtest.
  const kind = build === 'quadruped' ? 'boar' : build === 'upright' ? 'monkey' : 'crab';
  const model = fixtures.copy(kind, kind === 'crab' ? 'small' : kind);
  const root = new THREE.Group(), bones: Record<string, THREE.Bone> = {};
  root.scale.setScalar(scale); root.position.set(.25, 2.5, -.4); root.rotation.set(.08, .37, -.03);
  for (const row of model.bones) {
    const bone = new THREE.Bone(); bone.name = row.name; bone.position.fromArray(row.pos);
    if (row.parent === null) root.add(bone);
    else {
      const parent = bones[row.parent], origin = model.bones.find(value => value.name === row.parent);
      if (parent === undefined || origin === undefined) throw new Error('Missing authored parent');
      bone.position.sub(new THREE.Vector3(...origin.pos)); parent.add(bone);
    }
    bones[row.name] = bone;
  }
  bones['neck1']?.rotation.set(-.38, .07, .06);
  bones['FL_shoulder']?.rotation.set(.18, -.1, .05);
  bones['BR_hip']?.rotation.set(-.16, .04, -.05);
  for (const geometry of [...model.furParts, ...model.hardParts, ...model.eyeParts]) geometry.dispose();
  expect(Object.hasOwn(model.dims, 'rigidCorpse')).toBe(false);
  return { build, lite, root, bones, dims: model.dims, scale, velocity: { x: .7, y: .3, z: -.4 },
    hitPoint: { x: .6, y: 3.2, z: -.1 }, dir: { x: .8, y: .2, z: -.6 }, damage };
}
function physics(): Physics {
  const p = new Physics(R);
  p.world.createCollider(R.ColliderDesc.cuboid(40, .5, 40).setTranslation(0, -.5, 0)
    .setCollisionGroups(collisionGroups.groups('WORLD')).setSolverGroups(collisionGroups.groups('WORLD')));
  return p;
}
function snapshot(p: Physics, system: LegacySystem, r: LegacyRagdoll, spec: RagdollSpec) {
  const bodies: unknown[] = [], colliders: unknown[] = [];
  p.world.bodies.forEach(body => { bodies.push({ p: body.translation(), q: body.rotation(), v: body.linvel(), w: body.angvel(),
    mass: body.mass(), com: body.localCom(), inertia: body.effectiveAngularInertia(), sleep: body.isSleeping(),
    linearDamping: body.linearDamping(), angularDamping: body.angularDamping(), count: body.numColliders() }); });
  p.world.colliders.forEach(c => { colliders.push({ p: c.translation(), q: c.rotation(), type: c.shapeType(),
    mass: c.mass(), friction: c.friction(), restitution: c.restitution(), groups: c.collisionGroups(), solver: c.solverGroups() }); });
  return { state: r.state, live: system.live, count: r.bodies, fastest: r.fastest,
    rootPosition: r.rootPosition(new THREE.Vector3()).toArray(), bodies, colliders, joints: p.world.impulseJoints.len(),
    root: { p: spec.root.position.toArray(), q: spec.root.quaternion.toArray(), s: spec.root.scale.toArray() },
    bones: Object.entries(spec.bones).map(([name, bone]) => ({ name, p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray() })) };
}
const builds = [
  { build: 'rigid', lite: false }, { build: 'upright', lite: false },
  { build: 'quadruped', lite: false }, { build: 'quadruped', lite: true },
] as const;
const cases = builds.flatMap(row => [.5, 1, 2].flatMap(scale => [30, 60, 120].map(hz => ({ build: row.build, lite: row.lite, scale, hz }))));
test.each(cases)('exact old-path trace: $build lite=$lite scale=$scale render=$hz Hz', ({ build, lite, scale, hz }) => {
  const a = physics(), b = physics(), legacy = new old.Ragdolls(a), current = new Ragdolls(b);
  const sa = specimen(build, lite, scale), sb = specimen(build, lite, scale);
  const ra = legacy.spawn(sa), rb = current.spawn(sb);
  if (ra === null || rb === null) throw new Error('Unexpected cap');
  let alpha = 0, accumulator = 0;
  old.setRagdollClock(() => alpha); setRagdollClock(() => alpha);
  try {
    expect(rb.fixedPose).toBe(false);
    expect(current.cap).toBe(RAGDOLL_CAP[tier.TIER]);
    expect(rb.bodies).toBe(build === 'quadruped' ? lite ? 6 : 11 : 1);
    // Exact numeric equality, including throw/spin, masks, mass, COM and tensor before the first integration.
    expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa));
    for (let frame = 0; frame < hz * 6; frame++) {
      accumulator += 1 / hz;
      while (accumulator + 1e-12 >= fixedStep.FIXED_STEP) {
        // Production bootstrap ordering; no legacy hooks existed. Current hooks must remain no-ops here.
        current.fixedPre(fixedStep.FIXED_STEP); a.step(); b.step(); current.fixedPost(fixedStep.FIXED_STEP);
        expect(snapshot(b, current, rb, sb), `fixed endpoint before frame ${frame}`).toEqual(snapshot(a, legacy, ra, sa));
        accumulator -= fixedStep.FIXED_STEP;
      }
      alpha = Math.max(0, accumulator / fixedStep.FIXED_STEP);
      ra.pose(1 / hz); rb.pose(1 / hz);
      expect(snapshot(b, current, rb, sb), `frame ${frame}`).toEqual(snapshot(a, legacy, ra, sa));
    }
    expect(rb.state).toBe('frozen'); expect(current.live).toBe(0);
    sa.root.position.y -= 1; sb.root.position.y -= 1; ra.pose(.1); rb.pose(.1);
    expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa));
    ra.dispose(); rb.dispose(); ra.dispose(); rb.dispose();
    expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa)); expect(rb.state).toBe('gone');
  } finally { ra.dispose(); rb.dispose(); a.dispose(); b.dispose(); }
});

test.each(builds)('sleep, live disposal and cap parity: $build lite=$lite', ({ build, lite }) => {
  const a = physics(), b = physics(), legacy = new old.Ragdolls(a, 1), current = new Ragdolls(b, 1);
  const sa = specimen(build, lite, 1), sb = specimen(build, lite, 1), ra = legacy.spawn(sa), rb = current.spawn(sb);
  if (ra === null || rb === null) throw new Error('Unexpected cap');
  try {
    expect(legacy.spawn(sa)).toBeNull(); expect(current.spawn(sb)).toBeNull();
    a.world.bodies.forEach(body => body.sleep()); b.world.bodies.forEach(body => body.sleep());
    current.fixedPre(1 / 60); current.fixedPost(1 / 60);
    expect(rb.state).toBe('live'); // Defaults freeze in render pose, never in the added fixed hooks.
    ra.pose(0); rb.pose(0);
    expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa)); expect(rb.state).toBe('frozen');
    const na = legacy.spawn(specimen(build, lite, .7)), nb = current.spawn(specimen(build, lite, .7));
    expect(na).not.toBeNull(); expect(nb).not.toBeNull(); na?.dispose(); nb?.dispose(); na?.dispose(); nb?.dispose();
    expect(current.live).toBe(legacy.live); expect(current.live).toBe(0);
    expect(b.world.bodies.len()).toBe(0); expect(b.world.colliders.len()).toBe(1); expect(b.world.impulseJoints.len()).toBe(0);
  } finally { ra.dispose(); rb.dispose(); a.dispose(); b.dispose(); }
});

test.each(['quiet', 'timeout'] as const)('legacy render-clock %s freeze retains exact threshold', mode => {
  const a = physics(), b = physics(), legacy = new old.Ragdolls(a), current = new Ragdolls(b);
  a.world.gravity.y = 0; b.world.gravity.y = 0;
  const sa = specimen('rigid', false, 1), sb = specimen('rigid', false, 1), ra = legacy.spawn(sa), rb = current.spawn(sb);
  if (ra === null || rb === null) throw new Error('Unexpected cap');
  let freezeFrame = -1;
  try {
    for (let frame = 0; frame < 310 && rb.state === 'live'; frame++) {
      for (const world of [a.world, b.world]) world.bodies.forEach(body => {
        body.setLinvel({ x: mode === 'quiet' ? 0 : 10, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      });
      current.fixedPre(1 / 60); a.step(); b.step(); current.fixedPost(1 / 60);
      // No interpolation clock installed: exercise the old sinceStep / FIXED_STEP fallback.
      ra.pose(1 / 60); rb.pose(1 / 60);
      expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa));
      if (rb.bodies === 0) freezeFrame = frame;
    }
    expect(freezeFrame).toBe(mode === 'quiet' ? 30 : 300);
  } finally { ra.dispose(); rb.dispose(); a.dispose(); b.dispose(); }
});

test.each(builds.flatMap(row => [0, 1000].map(damage => ({ build: row.build, lite: row.lite, damage }))))(
  'throw clamps and zero-direction fallback: $build lite=$lite damage=$damage', ({ build, lite, damage }) => {
    const a = physics(), b = physics(), legacy = new old.Ragdolls(a), current = new Ragdolls(b);
    const sa = { ...specimen(build, lite, 1.7, damage), dir: { x: 0, y: 1, z: 0 } };
    const sb = { ...specimen(build, lite, 1.7, damage), dir: { x: 0, y: 1, z: 0 } };
    const ra = legacy.spawn(sa), rb = current.spawn(sb);
    if (ra === null || rb === null) throw new Error('Unexpected cap');
    try {
      expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa));
      for (let tick = 0; tick < 12; tick++) {
        current.fixedPre(1 / 60); a.step(); b.step(); current.fixedPost(1 / 60); ra.pose(1 / 60); rb.pose(1 / 60);
        expect(snapshot(b, current, rb, sb)).toEqual(snapshot(a, legacy, ra, sa));
      }
    } finally { ra.dispose(); rb.dispose(); a.dispose(); b.dispose(); }
  });

test.each([2, 6])('tier-sized cap %s releases exactly one slot on live disposal', cap => {
  const a = physics(), b = physics(), legacy = new old.Ragdolls(a, cap), current = new Ragdolls(b, cap);
  const left: LegacyRagdoll[] = [], right: LegacyRagdoll[] = [];
  try {
    expect(old.RAGDOLL_CAP).toEqual({ phone: 2, desktop: 6 });
    expect(RAGDOLL_CAP).toEqual(old.RAGDOLL_CAP);
    for (let i = 0; i < cap; i++) {
      const ra = legacy.spawn(specimen('rigid', false, 1)), rb = current.spawn(specimen('rigid', false, 1));
      if (ra === null || rb === null) throw new Error('Early cap'); left.push(ra); right.push(rb);
    }
    expect(legacy.spawn(specimen('rigid', false, 1))).toBeNull(); expect(current.spawn(specimen('rigid', false, 1))).toBeNull();
    left[0]?.dispose(); right[0]?.dispose(); expect(current.live).toBe(cap - 1); expect(legacy.live).toBe(cap - 1);
    const ra = legacy.spawn(specimen('rigid', false, 1)), rb = current.spawn(specimen('rigid', false, 1));
    if (ra === null || rb === null) throw new Error('Slot not reclaimed'); left.push(ra); right.push(rb);
    expect(current.live).toBe(cap); expect(legacy.live).toBe(cap);
  } finally { left.forEach(r => r.dispose()); right.forEach(r => r.dispose()); a.dispose(); b.dispose(); }
});
