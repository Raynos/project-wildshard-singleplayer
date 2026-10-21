// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the retained packed candidate, without changing its frozen evidence.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact retained input identities, not runtime loading.
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test, vi } from 'vitest';
import { Bone, MeshStandardMaterial, Raycaster, Skeleton, SkinnedMesh, Vector3, type Intersection } from 'three';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { mergeAnimalGeometry } from '../src/engine/models/animalGeometry';
import { PracticeNativeMeshHit } from '../src/game/practice/PracticeNativeMeshHit';
import { authoredTargets } from '../src/engine/combat/targets';
import { TrainingArena, type PracticeOpponent } from '../src/engine/practice/TrainingArena';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { Events } from '../src/engine/events/events';
import type { Targets } from '../src/engine/combat/types';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { numericCreaturePose, installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { iguanaOwnedClips } from './proof/iguana-eight-owner-hit/clips';

const folder = 'test/proof/iguana-eight-owner-hit';
async function fixture() {
  const metadata: unknown = JSON.parse(readFileSync(`${folder}/metadata.json`, 'utf8'));
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${folder}/payload.bin`))));
  await loader.preload(); const parts = loader.copy('bloomthroat-iguana', 'bloomthroat-iguana');
  const geometry = mergeAnimalGeometry(parts.furParts, parts.hardParts, parts.eyeParts);
  const material = new MeshStandardMaterial(), mesh = new SkinnedMesh(geometry, material);
  const bones: Record<string, Bone> = {}, ordered: Bone[] = [];
  for (const row of parts.bones) {
    const bone = new Bone(); bone.name = row.name; bone.position.fromArray(row.pos); bones[row.name] = bone; ordered.push(bone);
    if (row.parent === null) mesh.add(bone);
    else {
      const parent = bones[row.parent], rest = parts.bones.find(value => value.name === row.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing real Iguana bind parent');
      bone.position.sub(new Vector3(...rest.pos)); parent.add(bone);
    }
  }
  mesh.updateMatrixWorld(true); mesh.bind(new Skeleton(ordered));
  const hit = new PracticeNativeMeshHit(mesh);
  const frame = { deathT: -1, flinch: 0, t: 0, speed: 0 }, strike = { phase: 0, elapsed: 0, index: 0 };
  const clip = iguanaOwnedClips(), owners = new Map<string, unknown>(Object.entries(bones).map(([name, bone]) => [`joint.${name}`, bone]));
  owners.set('frame', frame); owners.set('strike', strike);
  const programs = installChannelPrograms(clip.programs, clip.group, owners);
  const publish = () => { programs.evaluate({ time: frame.t, delta: 1 / 60, values: {} }); mesh.updateMatrixWorld(true); };
  publish();
  const close = () => { hit.dispose(); mesh.skeleton.dispose(); geometry.dispose(); material.dispose(); };
  return { mesh, bones, hit, frame, strike, publish, close, dims: parts.dims };
}
function triangle(mesh: SkinnedMesh, face: number) {
  const index = mesh.geometry.index, indices = [0, 1, 2].map(corner => index?.getX(face * 3 + corner) ?? face * 3 + corner);
  const vertices = indices.map(i => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
  const [a, b, c] = vertices;
  if (a === undefined || b === undefined || c === undefined) throw new Error('Missing triangle');
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
  return { center, normal, indices };
}

test('real packed Iguana: every retained triangle including tail and four paws has exact live ray coverage', async () => {
  const f = await fixture();
  try {
    const count = (f.mesh.geometry.index?.count ?? f.mesh.geometry.getAttribute('position').count) / 3;
    expect(count).toBe(3870);
    const ownerHits = new Map<string, number>(), skin = f.mesh.geometry.getAttribute('skinIndex');
    const before = JSON.stringify({ frame: f.frame, strike: f.strike, bones: Object.values(f.bones).map(b => [b.position.toArray(), b.quaternion.toArray(), b.scale.toArray()]) });
    for (let face = 0; face < count; face++) {
      const t = triangle(f.mesh, face), origin = t.center.clone().addScaledVector(t.normal, .00001), direction = t.normal.clone().negate();
      const result = f.hit.cast(origin, direction, .00002);
      expect(result, `triangle ${face}`).not.toBeNull();
      expect(result?.point.distanceTo(t.center)).toBeLessThan(1e-8);
      const first = t.indices[0]; if (first === undefined) throw new Error('Missing corner');
      const name = f.mesh.skeleton.bones[skin.getX(first)]?.name;
      if (name === undefined) throw new Error('Missing triangle owner');
      expect(result?.headshot).toBe(name === 'head'); ownerHits.set(name, (ownerHits.get(name) ?? 0) + 1);
    }
    expect([...ownerHits.keys()].sort()).toEqual(['body', 'head', 'bloom0', 'tail0', 'legFL', 'legFR', 'legBL', 'legBR'].sort());
    expect(JSON.stringify({ frame: f.frame, strike: f.strike, bones: Object.values(f.bones).map(b => [b.position.toArray(), b.quaternion.toArray(), b.scale.toArray()]) })).toBe(before);
  } finally { f.close(); }
});

test('exact-source cache matches native SkinnedMesh rays after actual authored motion and root movement', async () => {
  const f = await fixture();
  try {
    const ray = new Raycaster(), hits: Intersection[] = [], count = (f.mesh.geometry.index?.count ?? f.mesh.geometry.getAttribute('position').count) / 3;
    const getVertex = vi.spyOn(f.mesh, 'getVertexPosition');
    for (const [phase, elapsed, time] of [[1, .7, 1], [2, .08, 2], [3, .5, 3]]) {
      f.strike.phase = phase ?? 0; f.strike.elapsed = elapsed ?? 0; f.strike.index = 1; f.frame.t = time ?? 0; f.frame.speed = 1;
      f.mesh.position.set(4, 900, -3); f.mesh.rotation.y = .7; f.mesh.scale.setScalar(1.2); f.publish();
      // Deliberately stale rendering bound must NOT reject the exact query cache.
      f.mesh.computeBoundingSphere(); f.mesh.computeBoundingBox();
      for (let face = 0; face < count; face += 97) {
        const t = triangle(f.mesh, face), origin = t.center.clone().addScaledVector(t.normal, .02), direction = t.normal.clone().negate();
        hits.length = 0; ray.set(origin, direction); ray.far = .04; f.mesh.raycast(ray, hits); hits.sort((a, b) => a.distance - b.distance);
        const actual = f.hit.cast(origin, direction, .04);
        expect(actual === null).toBe(hits.length === 0);
        if (actual !== null) expect(actual.point.distanceTo(hits[0]?.point ?? new Vector3(Infinity, 0, 0))).toBeLessThan(1e-8);
        const calls = getVertex.mock.calls.length; f.hit.cast(origin, direction, .04);
        expect(getVertex.mock.calls.length).toBe(calls); // repeated sweep rays do not reskin
      }
    }
  } finally { f.close(); }
});

test('bounds follow current displayed tail, range/miss and disposal do not affect original resources', async () => {
  const f = await fixture();
  try {
    const tail = f.bones['tail0']; if (tail === undefined) throw new Error('Missing tail');
    const skin = f.mesh.geometry.getAttribute('skinIndex'), tailIndex = f.mesh.skeleton.bones.indexOf(tail);
    let face = 0;
    while (skin.getX(f.mesh.geometry.index?.getX(face * 3) ?? face * 3) !== tailIndex) face++;
    f.mesh.computeBoundingSphere(); f.mesh.computeBoundingBox();
    const bindBounds = f.mesh.boundingSphere.clone();
    // A diagnostic changed publication outside the old bound, not new authored motion or admission evidence.
    tail.position.x += 12; f.mesh.updateMatrixWorld(true);
    const t = triangle(f.mesh, face), origin = t.center.clone().addScaledVector(t.normal, .1), direction = t.normal.clone().negate();
    expect(f.hit.cast(origin, direction, .05)).toBeNull();
    expect(f.hit.cast(origin, direction, .2)?.point.distanceTo(t.center)).toBeLessThan(1e-8);
    expect(f.mesh.boundingSphere).toEqual(bindBounds);
    expect(f.hit.cast(new Vector3(100, 100, 100), new Vector3(1, 0, 0), 10)).toBeNull();
    const geometryDisposal = vi.spyOn(f.mesh.geometry, 'dispose'), materialDisposal = vi.spyOn(f.mesh.material, 'dispose');
    f.hit.dispose(); f.hit.dispose(); expect(f.hit.cast(origin, direction, .2)).toBeNull();
    expect(geometryDisposal).not.toHaveBeenCalled(); expect(materialDisposal).not.toHaveBeenCalled();
  } finally { f.close(); }
});

test('source mode refuses weighted or mixed-owner triangles instead of misclassifying them', async () => {
  const f = await fixture();
  try {
    const weights = f.mesh.geometry.getAttribute('skinWeight'), skin = f.mesh.geometry.getAttribute('skinIndex');
    weights.setX(0, .5); expect(() => new PracticeNativeMeshHit(f.mesh)).toThrow('single-owner'); weights.setX(0, 1);
    const first = f.mesh.geometry.index?.getX(0) ?? 0; skin.setX(first, (skin.getX(first) + 1) % 8);
    expect(() => new PracticeNativeMeshHit(f.mesh)).toThrow('coherent owner');
  } finally { f.close(); }
});


test('trusted target reach port retains real tail hits excluded by the old root-radius cull', async () => {
  const f = await fixture();
  try {
    const count = (f.mesh.geometry.index?.count ?? f.mesh.geometry.getAttribute('position').count) / 3;
    let furthest = triangle(f.mesh, 0);
    for (let face = 1; face < count; face++) {
      const t = triangle(f.mesh, face);
      if (t.center.lengthSq() > furthest.center.lengthSq()) furthest = t;
    }
    const range = 2, outward = furthest.center.clone().normalize(), origin = furthest.center.clone().addScaledVector(outward, range - .1);
    const oldRadius = Math.max(.3, f.dims.bodyRadius, f.dims.bodyHalfLen * .6);
    expect(origin.length()).toBeGreaterThan(range + .6 + oldRadius + 1);
    expect(f.hit.inReach(origin, range)).toBe(true);
    expect(f.hit.cast(origin, outward.negate(), range)).not.toBeNull();
    let room: Targets | null = { raycast: () => null, inReach: (point, distance) => f.hit.inReach(point, distance) };
    const targets = authoredTargets(new Events(), { raycast: () => null }, () => room);
    expect(targets.inReach?.(origin, range)).toBe(true);
    expect(targets.inReach?.(new Vector3(100, 100, 100), range)).toBe(false);
    room = { raycast: () => null }; expect(targets.inReach?.(origin, range)).toBeUndefined();
    room = null; expect(targets.inReach?.(origin, range)).toBeUndefined();
  } finally { f.close(); }
});


test('proof fixture is byte-exact and optionally matches the retained original files', () => {
  const origin = v.parse(v.object({ source: v.string(), files: v.record(v.string(), v.object({ sha256: v.string(), bytes: v.number() })) }),
    JSON.parse(readFileSync(`${folder}/origin.json`, 'utf8')));
  for (const [name, pin] of Object.entries(origin.files)) {
    const bytes = readFileSync(`${folder}/${name}`);
    expect(bytes.length).toBe(pin.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);
    const original = `${origin.source}/${name}`;
    if (existsSync(original)) expect(bytes).toEqual(readFileSync(original));
  }
});


test('ray ownership classification does not silently change existing melee head-sphere semantics', async () => {
  const f = await fixture();
  try {
    const actor = new AnimalSim({ kind: 'bloomthroat-iguana', label: 'Iguana', variant: 'bloomthroat-iguana', rarity: 'common', hp: 100, aggressive: true,
      dims: f.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
    1, 1, 'iguana.hit-proof', { heightAt: () => 0, random: () => .5 });
    const recipe: NativeCreaturePoseRecipe = { custom: true, deathSplay: false, rootFlinch: 'authored-pose',
      joints: f.mesh.skeleton.bones.map(bone => ({ name: bone.name, parent: f.mesh.skeleton.bones.findIndex(parent => parent.uuid === bone.parent?.uuid),
        position: [bone.position.x, bone.position.y, bone.position.z], order: bone.rotation.order, scale: [1, 1, 1] })) };
    const pose = new NativeCreaturePose(actor, recipe, numericCreaturePose(iguanaOwnedClips()));
    actor.bindVolumes(pose); pose.publish(); // Real authored idle equals the unadvanced bind publication.
    const combatActor = actor.combatActor(), skin = f.mesh.geometry.getAttribute('skinIndex');
    const count = (f.mesh.geometry.index?.count ?? f.mesh.geometry.getAttribute('position').count) / 3;
    let distinct = false;
    for (let face = 0; face < count; face++) {
      const t = triangle(f.mesh, face), first = t.indices[0];
      if (first === undefined || f.mesh.skeleton.bones[skin.getX(first)]?.name === 'head') continue;
      const legacyHead = combatActor.isHeadshot?.({ source: 'env', sourceTags: ['dmg.melee'], target: combatActor,
        amount: 1, point: t.center, dir: t.normal });
      if (legacyHead !== true) continue;
      const rayHit = f.hit.cast(t.center.clone().addScaledVector(t.normal, .00001), t.normal.clone().negate(), .00002);
      if (rayHit === null) continue;
      expect(rayHit.headshot).toBe(false); distinct = true; break;
    }
    expect(distinct).toBe(true); // Exact ray owner is NOT substituted into Melee.contact's existing damage request.
  } finally { f.close(); }
});


test('actual arena provider methods forward source reach/rays only for the active opponent', async () => {
  const f = await fixture();
  try {
    // Exercise real provider methods, not room construction/WebGL/physics lifecycle.
    const arena: unknown = Object.create(TrainingArena.prototype);
    if (!(arena instanceof TrainingArena)) throw new Error('Missing actual arena prototype');
    Reflect.set(arena, 'active', false); Reflect.set(arena, 'opponent', null);
    const actor = new AnimalSim({ kind: 'bloomthroat-iguana', label: 'Iguana', variant: 'bloomthroat-iguana', rarity: 'common', hp: 100, aggressive: true,
      dims: f.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
    1, 1, 'iguana.provider-proof', { heightAt: () => 0, random: () => .5 });
    const opponent: PracticeOpponent = { targets: [actor], enter: () => undefined, exit: () => undefined, update: () => undefined,
      inReach: (origin, range) => f.hit.inReach(origin, range), raycast: (origin, direction, range) => {
        const hit = f.hit.cast(origin, direction, range); return hit === null ? null : { animal: actor, ...hit };
      } };
    arena.setOpponent(opponent);
    const t = triangle(f.mesh, 0), origin = t.center.clone().addScaledVector(t.normal, .01), direction = t.normal.clone().negate();
    expect(arena.inReach(origin, .02)).toBeUndefined();
    const targets = authoredTargets(new Events(), { raycast: () => null }, () => arena.entered ? arena : null);
    expect(targets.inReach?.(origin, .02)).toBeUndefined();
    Reflect.set(arena, 'active', true);
    expect(targets.inReach?.(origin, .02)).toBe(true);
    expect(targets.raycast(origin, direction, .02)?.animal).toBe(actor);
    Reflect.set(arena, 'active', false); arena.setOpponent({ targets: opponent.targets, enter: opponent.enter, exit: opponent.exit, update: opponent.update, raycast: opponent.raycast });
    Reflect.set(arena, 'active', true); expect(targets.inReach?.(origin, .02)).toBeUndefined();
    Reflect.set(arena, 'active', false); arena.setOpponent(null); Reflect.set(arena, 'active', true);
    expect(targets.inReach?.(origin, .02)).toBeUndefined();
  } finally { f.close(); }
});

test('150 repeated sword queries skin 11610 source vertices once, not per ray', async () => {
  const f = await fixture();
  try {
    const t = triangle(f.mesh, 0), origin = t.center.clone().addScaledVector(t.normal, .01), direction = t.normal.clone().negate();
    const reads = vi.spyOn(f.mesh, 'getVertexPosition');
    expect(f.hit.inReach(origin, .02)).toBe(true); expect(reads).toHaveBeenCalledTimes(11610);
    for (let i = 0; i < 150; i++) expect(f.hit.cast(origin, direction, .02)).not.toBeNull();
    expect(reads).toHaveBeenCalledTimes(11610);
  } finally { f.close(); }
});

test('actual node-material position outputs and unverified shader displacement refuse', async () => {
  const f = await fixture(), node = new MeshStandardNodeMaterial();
  const mesh = new SkinnedMesh(f.mesh.geometry, node); mesh.bind(f.mesh.skeleton, f.mesh.bindMatrix);
  try {
    node.colorNode = vec3(.5); node.roughnessNode = float(.8);
    const allowed = new PracticeNativeMeshHit(mesh); allowed.dispose();
    node.positionNode = vec3(1); expect(() => new PracticeNativeMeshHit(mesh)).toThrow('GPU displacement');
    node.positionNode = null; node.geometryNode = float(1); expect(() => new PracticeNativeMeshHit(mesh)).toThrow('GPU displacement');
    f.mesh.material.onBeforeCompile = () => undefined;
    expect(() => new PracticeNativeMeshHit(f.mesh)).toThrow('unverified shader');
  } finally { node.dispose(); f.close(); }
});
