import { expect, test } from 'vitest';
import * as v from 'valibot';
import { rigidCorpseSchema, copyRigidCorpse } from '../src/format/rigidCorpse';
import { validateRigidCorpse } from '../src/engine/physics/rigidCorpse';
import { nativeBodySchema } from '../src/format/nativePhysics';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

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
