import packedMetadata from './proof/conch-grounded-source/metadata.json' with { type: 'json' };
import packedUrl from './proof/conch-grounded-source/payload.bin?inline';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { packedPayloadIdentity } from '../src/game/plugin/packedPayloadIdentity';
import sourceFreeze from './proof/conch-grounded-source/freeze.json' with { type: 'json' };
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { Events } from '../src/engine/events/events';
import { Scope } from '../src/engine/app/scope';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { AnimalRigJoint } from '../src/engine/entities/animalRig';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { PracticeFootContactSchema, solvePracticeContacts, validatePracticeContact, initialPracticeContacts,
  practiceContactClearance, samplePracticeContactFrames, CONTACT_ARITHMETIC_BOUND,
  type PracticeContactSurface } from '../src/game/plugin/practiceFootContact';
import source from './proof/conch-grounded-source/model.json' with { type: 'json' };
import hullInput from './proof/conch-grounded-source/recipe.json' with { type: 'json' };
import declaration from './proof/conch-grounded-source/motion.json' with { type: 'json' };

const hulls = v.parse(rigidCorpseSchema, hullInput), contact = v.parse(PracticeFootContactSchema, declaration.footContact);
const recipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false,
  joints: source.bones.map(bone => {
    const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
    return { name: bone.name, parent, position: [0, 1, 2].map(i => (bone.pos[i] ?? 0) - (p?.[i] ?? 0)) as [number, number, number],
      order: 'XYZ', scale: [1, 1, 1] };
  }) };
const payload = Uint8Array.from(atob(packedUrl.slice(packedUrl.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
const loader = packedCreatureBodies(packedMetadata, undefined, () => Promise.resolve(payload));
await loader.preload();
function loadedDims() {
  const body = loader.copy('conch-duelist', 'conch-duelist');
  for (const part of [...body.hardParts, ...body.furParts, ...body.eyeParts]) part.dispose();
  return body.dims;
}
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
function fixture(yaw = 0, scale = 1, input = declaration, dims = loadedDims()) {
  const surface: PracticeContactSurface = { id: 'practice-arena', revision: 1, active: true, y: 900,
    minX: -49.78, maxX: 49.78, minZ: -49.78, maxZ: 49.78 };
  const actor = new AnimalSim({ kind: 'conch-duelist', label: 'Conch', variant: 'conch-duelist', rarity: 'common', hp: 100,
    aggressive: true, dims,
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
  1, scale, 'practice.conch', { heightAt: () => 900, random: () => .5 });
  actor.place(0, 0, yaw, 900); actor.levelGround = true; actor.groundHeight = () => 900;
  const pose = new NativeCreaturePose(actor, recipe, numericCreaturePose(input), surface);
  actor.bindVolumes(pose); pose.initializePractice();
  let time = 0;
  const tick = (body = false) => { time += 1 / 60; if (body) actor.step(1 / 60); pose.advance(1 / 60, time, true); pose.publish(); };
  const render = (alpha: number) => {
    const root = joint(), bones = Object.fromEntries(recipe.joints.map(row => [row.name, joint()]));
    pose.copyPublished(root, bones, alpha); return { root, bones };
  };
  return { actor, pose, surface, tick, render };
}
function worldMatrices(root: AnimalRigJoint, bones: Readonly<Record<string, AnimalRigJoint>>): Matrix4[] {
  const rootMatrix = new Matrix4().compose(root.position, new Quaternion().setFromEuler(root.rotation), root.scale);
  const matrices: Matrix4[] = [];
  for (const def of recipe.joints) {
    const bone = bones[def.name], parent = def.parent < 0 ? rootMatrix : matrices[def.parent];
    if (bone === undefined || parent === undefined) throw new Error('Missing actual source joint');
    matrices.push(parent.clone().multiply(new Matrix4().compose(bone.position, new Quaternion().setFromEuler(bone.rotation), bone.scale)));
  }
  return matrices;
}
function assertSupport(f: ReturnType<typeof fixture>, alpha: number): void {
  const before = f.pose.snapshot(), data = f.pose.contactDiagnostic(); if (data === undefined) throw new Error('Missing contact state');
  expect(data.current.failures).toEqual([]);
  const { root, bones } = f.render(alpha), matrices = worldMatrices(root, bones);
  const frames = samplePracticeContactFrames(contact, data.previous, data.current, alpha);
  for (const [index, foot] of contact.feet.entries()) {
    const transform = matrices[recipe.joints.findIndex(row => row.name === foot.joints[2])], frame = frames[index];
    if (transform === undefined || frame === undefined) throw new Error('Missing actual foot');
    const ankle = new Vector3().setFromMatrixPosition(transform);
    expect(ankle.distanceTo(new Vector3(...frame.position))).toBeLessThan(CONTACT_ARITHMETIC_BOUND);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), frame.yaw);
    for (const p of foot.sole) {
      const actual = new Vector3(...p).applyMatrix4(transform);
      const expected = new Vector3(...p).multiplyScalar(f.actor.scale).applyQuaternion(q).add(ankle);
      expect(actual.distanceTo(expected)).toBeLessThan(CONTACT_ARITHMETIC_BOUND);
      expect(actual.y).toBeGreaterThanOrEqual(900 - CONTACT_ARITHMETIC_BOUND);
    }
  }
  // Actual packed source corners, independently of the 333-point clearance recipe.
  for (const [index, part] of source.parts.entries()) {
    const owner = hulls.parts[index]?.bone, boneIndex = recipe.joints.findIndex(row => row.name === owner);
    const transform = matrices[boneIndex], bind = source.bones[boneIndex];
    if (transform === undefined || bind === undefined) throw new Error('Missing rigid source owner');
    let minimumY = Infinity;
    for (let i = 0; i < part.positions.length; i += 3) {
      const p = new Vector3((part.positions[i] ?? 0) - (bind.pos[0] ?? 0),
        (part.positions[i + 1] ?? 0) - (bind.pos[1] ?? 0), (part.positions[i + 2] ?? 0) - (bind.pos[2] ?? 0)).applyMatrix4(transform);
      minimumY = Math.min(minimumY, p.y);
    }
    expect(minimumY).toBeGreaterThanOrEqual(900 - CONTACT_ARITHMETIC_BOUND);
  }
  expect(practiceContactClearance(contact, recipe.joints, root, bones, f.surface)).toEqual([]);
  expect(f.pose.snapshot()).toBe(before);
}
test('actual frozen source identity, 333 hull points, closed-chain declarations and strict compiler rejection', () => {
  expect(sourceFreeze.outputs['payload.bin'].sha256).toBe(contact.source);
  expect(contact.geometry.reduce((n, row) => n + row.points.length, 0)).toBe(333);
  expect(() => validatePracticeContact(contact, recipe.joints)).not.toThrow();
  const wrong = structuredClone(contact); wrong.feet[0].joints[1] = 'head';
  expect(() => validatePracticeContact(wrong, recipe.joints)).toThrow('chain');
  expect(() => v.parse(PracticeFootContactSchema, { ...contact, callback: 'forbidden' })).toThrow();
  expect(() => v.parse(PracticeFootContactSchema, { ...contact, feet: [{ ...contact.feet[0], limits: null }, contact.feet[1]] })).toThrow();
  const mixed = structuredClone(declaration); const first = mixed.programs[0]; if (first === undefined) throw new Error('Missing program');
  mixed.programs.push({ ...first, id: 'duplicate.writer' });
  expect(() => numericCreaturePose(mixed)).toThrow('exclusive');
});
test('actual native world-space soles at yaw, wrapped yaw and admitted uniform scale without any root lift', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI + .01]) for (const scale of [1, .8, 1.3]) {
    const f = fixture(yaw, scale); assertSupport(f, 1); expect(f.render(1).root.position.y).toBe(900);
  }
});
test('stance anchors remain fixed over actual translation, quiet constraint sampling and a completed stopped swing', () => {
  const f = fixture(), initial = f.pose.contactDiagnostic();
  for (let tick = 0; tick < 50; tick++) {
    if (tick < 20) f.actor.position.z += .006;
    f.tick();
    for (const alpha of [0, .25, .5, .75, 1]) assertSupport(f, alpha);
  }
  expect(f.pose.contactDiagnostic()?.current.feet.every(foot => foot.mode === 'stance')).toBe(true);
  expect(f.pose.contactDiagnostic()?.current.feet.some((foot, i) => foot.step > (initial?.current.feet[i]?.step ?? 0))).toBe(true);
  const settled = f.pose.contactDiagnostic()?.current.feet;
  f.tick(); expect(f.pose.contactDiagnostic()?.current.feet).toEqual(settled);
});
test('reverse, lateral and yaw-only actual motion, not intended speed, can release a stance', () => {
  for (const direction of [-1, 1]) for (const axis of ['x', 'z', 'yaw'] as const) {
    const f = fixture();
    for (let n = 0; n < 18; n++) {
      if (axis === 'yaw') f.actor.yaw += direction * .008;
      else f.actor.position[axis] += direction * .006;
      f.tick(); assertSupport(f, 1);
    }
    expect(f.pose.contactDiagnostic()?.current.feet.some(foot => foot.step > 0)).toBe(true);
  }
  const blocked = fixture(); blocked.actor.speed = 4; blocked.actor.desiredSpeed = 4;
  for (let n = 0; n < 25; n++) blocked.tick();
  expect(blocked.pose.contactDiagnostic()?.current.feet.every(foot => foot.step === 0)).toBe(true);
});
test('real accumulated impulses and stagger retain actual displacement and honestly fail outside the declaration', () => {
  const f = fixture(); f.actor.impulse(new Vector3(8, 0, 0)); f.actor.impulse(new Vector3(8, 0, 0));
  f.actor.stagger(new Vector3(1, 0, 0), 1); f.tick(true);
  expect(f.actor.position.x).toBeGreaterThan(contact.maxRootStep);
  expect(f.render(1).root.position.x).toBe(f.actor.position.x);
  expect(f.pose.contactDiagnostic()?.current.failures).toContain('actual root movement outside declared contact domain');
  expect(f.pose.contactDiagnostic()?.current.feet.every(foot => foot.mode === 'released')).toBe(true);
  const scope = new Scope('released-contact-damage'), events = new Events(), combat = new CombatPipeline(events, scope);
  combat.hit({ source: 'env', sourceTags: [], target: f.actor.combatActor(), amount: 2,
    point: new Vector3(0, 901, 0), dir: new Vector3(1, 0, 0) });
  expect(f.actor.hp).toBe(98); scope.dispose();
});
test('strict reach, finite footprint and lifetime failures do not become a solver clamp', () => {
  const f = fixture(), { root } = f.render(1), state = initialPracticeContacts(contact, root, f.surface);
  const frames = state.feet.map(foot => structuredClone(foot.plant));
  const frame = frames[0]; if (frame === undefined) throw new Error('Missing frame');
  frame.position[0] += 3;
  expect(solvePracticeContacts(contact, recipe.joints, root, f.surface, frames).failures).toContain('foot 0: unreachable or singular');
  expect(() => f.pose.prepareContactPlacement({ x: 49.5, y: 900, z: 0 }, 0)).toThrow('placement');
  expect(() => f.pose.advance(0, 0, true)).toThrow('fixed tick');
  Object.assign(f.surface, { active: false }); f.tick();
  expect(f.pose.contactDiagnostic()?.current.failures).toContain('surface identity or lifetime lost');
});
test('exact mid-swing continuation and zero-time placement reset are quiet and transactional', () => {
  const f = fixture();
  for (let n = 0; n < 16; n++) { f.actor.position.z += .006; f.tick(); }
  const wire = f.pose.snapshot(), data = f.pose.contactDiagnostic();
  expect(data?.current.feet.some(foot => foot.mode === 'swing')).toBe(true);
  f.pose.restore(wire); expect(f.pose.snapshot()).toBe(wire);
  const malformed = JSON.parse(wire) as { contact: { current: { source: string } } };
  malformed.contact.current.source = 'wrong';
  expect(() => f.pose.restore(JSON.stringify(malformed))).toThrow('contact continuation');
  expect(f.pose.snapshot()).toBe(wire);
  const placement = f.pose.prepareContactPlacement({ x: 4, y: 900, z: 2 }, .7);
  f.actor.place(4, 2, .7, 900); f.pose.resetMotionAnchor(placement);
  expect(f.pose.contactDiagnostic()?.current.tick).toBe(0); assertSupport(f, 1);
});

test('two zero-time real hits retain contact time and entry; lethal releases once without resampling', () => {
  const f = fixture(), scope = new Scope('contact-hits'), events = new Events(), combat = new CombatPipeline(events, scope);
  for (let n = 0; n < 16; n++) { f.actor.position.z += .006; f.tick(); }
  const before = f.pose.contactDiagnostic()?.current;
  const hit = (amount: number) => combat.hit({ source: 'env', sourceTags: [], target: f.actor.combatActor(),
    amount, point: new Vector3(0, 901, 0), dir: new Vector3(1, 0, 0) });
  hit(1); hit(1);
  expect(f.actor.hp).toBe(98); expect(f.pose.contactDiagnostic()?.current).toEqual(before);
  expect(f.pose.contactDiagnostic()?.previous).toEqual(before);
  assertSupport(f, 0); assertSupport(f, 1);
  const published = f.render(1); hit(200);
  const lethal = f.pose.contactDiagnostic();
  expect(lethal?.current.tick).toBe(before?.tick);
  expect(lethal?.current.feet.every(foot => foot.mode === 'released')).toBe(true);
  expect(f.render(1).root.position).toEqual(published.root.position);
  const wire = f.pose.snapshot(); hit(1); expect(f.pose.snapshot()).toBe(wire);
  scope.dispose();
});
test('render cadence does not alter future owner bytes; malformed restore and unsupported scale remain atomic', () => {
  const a = fixture(), b = fixture();
  for (let n = 0; n < 25; n++) {
    a.actor.position.x += .003; b.actor.position.x += .003; a.tick(); b.tick();
    a.render(.75); a.render(.25); a.render(1); a.render(0);
    expect(a.pose.snapshot()).toBe(b.pose.snapshot());
  }
  const wire = a.pose.snapshot(), saved = JSON.parse(wire) as { contact?: unknown };
  delete saved.contact; expect(() => a.pose.restore(JSON.stringify(saved))).toThrow('contact continuation');
  expect(a.pose.snapshot()).toBe(wire);
  const { root } = a.render(1); root.scale.set(1, 2, 1);
  expect(() => initialPracticeContacts(contact, root, a.surface)).toThrow('uniform scale');
});

test('actual packed loader binds payload identity, rejects mismatches and retains owned bytes', async () => {
  expect(packedPayloadIdentity(loadedDims())).toBe(contact.source);
  const wrong = structuredClone(declaration); wrong.footContact.source = '0'.repeat(64);
  expect(() => fixture(0, 1, wrong)).toThrow('source identity');
  expect(() => fixture(0, 1, declaration, { ...loadedDims() })).toThrow('source identity');
  const alteredMetadata = { ...packedMetadata, file: packedMetadata.file.replace(contact.source, '0'.repeat(64)) };
  const invalid = packedCreatureBodies(alteredMetadata, undefined, () => Promise.resolve(payload));
  await invalid.preload();
  const invalidBody = invalid.copy('conch-duelist', 'conch-duelist');
  expect(() => packedPayloadIdentity(invalidBody.dims)).toThrow('payload identity');
  for (const part of [...invalidBody.hardParts, ...invalidBody.furParts, ...invalidBody.eyeParts]) part.dispose();
  const callerBytes = payload.slice();
  const owned = packedCreatureBodies(packedMetadata, undefined, () => Promise.resolve(callerBytes));
  await owned.preload(); callerBytes.fill(0);
  const body = owned.copy('conch-duelist', 'conch-duelist');
  expect(packedPayloadIdentity(body.dims)).toBe(contact.source);
  for (const part of [...body.hardParts, ...body.furParts, ...body.eyeParts]) part.dispose();
});
test('restore rejects off-slab footprints and simultaneous swing atomically', () => {
  const f = fixture(), wire = f.pose.snapshot();
  const saved = JSON.parse(wire) as { contact: { current: { feet: { mode: string; elapsed: number; step: number;
    plant: { position: number[] }; start: { position: number[] }; target: { position: number[] } }[] } } };
  for (const foot of saved.contact.current.feet) for (const frame of [foot.plant, foot.start, foot.target]) {
    frame.position[0] = (frame.position[0] ?? 0) + 100;
  }
  expect(() => f.pose.restore(JSON.stringify(saved))).toThrow('contact restore frame');
  expect(f.pose.snapshot()).toBe(wire);
  const edge = JSON.parse(wire) as typeof saved;
  const first = edge.contact.current.feet[0];
  if (first === undefined) throw new Error('Missing contact foot');
  // The ankle remains inside the slab, but a real sole vertex crosses its edge.
  for (const frame of [first.plant, first.start, first.target]) frame.position[0] = 49.77;
  expect(() => f.pose.restore(JSON.stringify(edge))).toThrow('contact restore frame');
  expect(f.pose.snapshot()).toBe(wire);
  const swinging = JSON.parse(wire) as typeof saved;
  for (const foot of swinging.contact.current.feet) { foot.mode = 'swing'; foot.elapsed = 1; foot.step = 1; }
  expect(() => f.pose.restore(JSON.stringify(swinging))).toThrow('contact continuation');
  expect(f.pose.snapshot()).toBe(wire);
});
