import { expect, test } from 'vitest';
import * as v from 'valibot';
import { rigidCorpseSchema, copyRigidCorpse } from '../src/format/rigidCorpse';
import { validateRigidCorpse } from '../src/engine/physics/rigidCorpse';
import { nativeBodySchema } from '../src/format/nativePhysics';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { AnimalSim, type AnimalSimSpec } from '../src/engine/entities/AnimalSim';
import { Vector3 } from 'three';
import { parseWorldPhysics } from '../src/format/worldPhysics';

const tetra = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
const recipe = () => ({ parts: [{ bone: 'body', points: tetra.map(p => [...p]) }] });
test('strict corpse recipe owns copies and preserves declared values', () => {
  const input = recipe(), parsed = v.parse(rigidCorpseSchema, input), copy = copyRigidCorpse(parsed);
  validateRigidCorpse(parsed); expect(copy).toEqual(input);
  const first = copy.parts[0]?.points[0]; if (first !== undefined) first[0] = 9;
  expect(parsed.parts[0]?.points[0]?.[0]).toBe(0);
});
test.each([
  undefined, null, {}, { parts: [] }, { ...recipe(), extra: 1 },
  ...[undefined, null, 'animated', 'freeze', 0, () => undefined].map(posePolicy => Object.assign(recipe(), { posePolicy })),
  { parts: [{ ...recipe().parts[0], extra: undefined }] },
  { parts: [{ bone: '', points: tetra }] }, { parts: [{ bone: 'x'.repeat(65), points: tetra }] },
  { parts: [{ bone: 'body', points: tetra.slice(1) }] },
  { parts: [{ bone: 'body', points: [...tetra, [0, 0, 0, 0]] }] },
  { parts: [{ bone: 'body', points: [...tetra, [Number.NaN, 0, 0]] }] },
  { parts: [{ bone: 'body', points: [...tetra, [Infinity, 0, 0]] }] },
  { parts: [{ bone: 'body', points: [...tetra, [20.01, 0, 0]] }] },
  { parts: [{ bone: 'body', points: Array.from({ length: 129 }, () => [0, 0, 0]) }] },
  { parts: Array.from({ length: 9 }, (_, i) => ({ bone: String(i), points: tetra })) },
  { parts: [recipe().parts[0], recipe().parts[0]] },
  { parts: Array.from({ length: 5 }, (_, i) => ({ bone: String(i), points: Array.from({ length: 128 }, () => [0, 0, 0]) })) },
])('rejects malformed/over-budget recipe %#', input => {
  expect(v.safeParse(rigidCorpseSchema, input).success).toBe(false);
  expect(() => validateRigidCorpse(input)).toThrow();
});
test('present undefined is rejected at optional boundary while absence is exact', () => {
  const schema = v.strictObject({ dims: v.strictObject({ rigidCorpse: v.exactOptional(rigidCorpseSchema) }) });
  expect(JSON.stringify(v.parse(schema, { dims: {} }))).toBe('{"dims":{}}');
  expect(v.safeParse(schema, { dims: { rigidCorpse: undefined } }).success).toBe(false);
});

test('native body recipe round-trips inertly and preserves exact absence bytes', () => {
  const body = { kind: 'fixture', label: 'Fixture', variant: 'base', rarity: 'common', hp: 100, aggressive: false,
    dims: { bodyY: 1, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: .5, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false } };
  expect(JSON.stringify(v.parse(nativeBodySchema('axis'), body))).toBe(JSON.stringify(body));
  const posed = { ...body, dims: { ...body.dims, rigidCorpse: recipe() } };
  expect(v.parse(nativeBodySchema('axis'), posed)).toEqual(posed);
  expect(v.safeParse(nativeBodySchema('axis'), { ...body, dims: { ...body.dims, rigidCorpse: undefined } }).success).toBe(false);
});
test('packed metadata deep-copies hulls and rejects unknown bones or upright recipes', async () => {
  const body = { kind: 'fixture', variant: 'base', bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }],
    dims: { bodyY: 1, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: .5, feet: [], halfWidth: .4, rigidCorpse: recipe() }, fur: null, hard: null, eye: null };
  const row = { file: `/assets/fixture-${'a'.repeat(64)}.bin`, bytes: 0, bodies: [body] };
  const bodies = packedCreatureBodies(row, bytes => bytes, () => Promise.resolve(new Uint8Array())); await bodies.preload();
  const a = bodies.copy('fixture', 'base'), b = bodies.copy('fixture', 'base');
  expect(a.dims.rigidCorpse).toEqual(b.dims.rigidCorpse);
  expect(a.dims.rigidCorpse?.parts[0]?.points[0]).not.toBe(b.dims.rigidCorpse?.parts[0]?.points[0]);
  body.dims.rigidCorpse.parts[0]?.points[0]?.splice(0, 1, 19);
  expect(a.dims.rigidCorpse?.parts[0]?.points[0]?.[0]).toBe(0);
  expect(() => packedCreatureBodies({ ...row, bodies: [{ ...body, dims: { ...body.dims, capsuleAxis: 'y' } }] })).toThrow('Incompatible');
  expect(() => packedCreatureBodies({ ...row, bodies: [{ ...body, bones: [] }] })).toThrow('Incompatible');
});

test.each([
  [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
])('pure data admission rejects non-volumetric hull %# before native preparation', points => {
  expect(v.safeParse(rigidCorpseSchema, { parts: [{ bone: 'body', points }] }).success).toBe(false);
});


test.each([undefined, 'captured'] as const)('optional corpse policy %s leaves living simulation, attack clocks, memory and analytic hit volumes byte-identical', posePolicy => {
  const base: AnimalSimSpec = { kind: 'fixture', label: 'Fixture', variant: 'base', rarity: 'common', hp: 180, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: .5, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false } };
  const ports = { heightAt: () => 0, now: () => 5, random: () => .5 };
  const a = new AnimalSim(base, 123, 1.5, 'fixture', ports),
    b = new AnimalSim({ ...base, dims: { ...base.dims, rigidCorpse: v.parse(rigidCorpseSchema, { ...recipe(), ...(posePolicy === undefined ? {} : { posePolicy }) }) } }, 123, 1.5, 'fixture', ports);
  const beforeStorage = localStorage.length;
  for (let tick = 0; tick < 180; tick++) {
    for (const actor of [a, b]) {
      actor.mem['decision'] = tick % 7;
      if (tick === 0) { actor.place(2, 4, .6); actor.setMotion(.4, 2, 1); }
      if (tick === 20) actor.startAttack(.8);
      if (tick === 45) actor.applyFinalDamage(20, new Vector3(2, 1, 4), new Vector3(1, 0, 0));
      if (tick === 60) actor.stagger(new Vector3(0, 0, 1), .8);
      if (tick === 90) actor.setMotion(-.5, 0, 2);
      if (tick === 110) actor.setMotion(.7, 3, 2);
      if (tick === 140) actor.applyFinalDamage(1000, new Vector3(2, 1, 4), new Vector3(1, 0, 0));
      actor.step(1 / 60);
    }
    expect(JSON.stringify(b.snapshot())).toBe(JSON.stringify(a.snapshot()));
    const ar = new Vector3(), af = new Vector3(), br = new Vector3(), bf = new Vector3();
    a.bodyCapsule(ar, af); b.bodyCapsule(br, bf); expect(br).toEqual(ar); expect(bf).toEqual(af);
    expect(b.headWorld(new Vector3())).toEqual(a.headWorld(new Vector3()));
  }
  expect(localStorage.length).toBe(beforeStorage);
});

test('native world retains inert corpse geometry without accepting extra fields', () => {
  const body = { kind: 'fixture', label: 'Fixture', variant: 'base', rarity: 'common', hp: 180, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: .5, feet: [], halfWidth: .4, rigidCorpse: recipe() },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false } };
  const row = { version: 1, rig: 'axis', provenance: 'tagged',
    ground: { rows: 1, cols: 1, heights: '', friction: .9, groups: 1, scale: { x: 1, y: 1, z: 1 }, at: { x: 0, y: 0, z: 0 } },
    solids: [], actors: [{ id: 'fixture', kind: 'fixture', variant: 'base', spec: body, seed: 1, scale: 1, herd: 0 }], herds: [] };
  expect(parseWorldPhysics(row)).toEqual(row);
  expect(() => parseWorldPhysics({ ...row, actors: [{ ...row.actors[0], spec: { ...body, dims: { ...body.dims, extra: 1 } } }] })).toThrow();
});


test('captured policy survives detached schema copies and does not materialize absent policy', () => {
  const input = { ...recipe(), posePolicy: 'captured' }, parsed = v.parse(rigidCorpseSchema, input), copied = copyRigidCorpse(parsed);
  validateRigidCorpse(parsed); expect(copied).toEqual(input);
  expect(copied.parts[0]?.points[0]).not.toBe(parsed.parts[0]?.points[0]);
  expect(Object.hasOwn(copyRigidCorpse(v.parse(rigidCorpseSchema, recipe())), 'posePolicy')).toBe(false);
});
