import { zlibSync } from 'fflate';
import { expect, test, vi } from 'vitest';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

const file = `/assets/test/live-dimensions-${'b'.repeat(64)}.bin`;
const bytes = zlibSync(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
const live = () => ({ bodyAt: [0, .2, .3], bodyPitch: .32, headAt: [.1, 0, .2],
  fore: { bone: 'shoulder', at: [0, .1, .2], halfLen: .3, radius: .2 } });
const row = (extra: Record<string, unknown> = live(), axis = 'z') => ({ file, bytes: 36, bodies: [{ kind: 'animal', variant: 'small',
  bones: [{ name: 'body', parent: null, pos: [0, .5, 0] }, { name: 'head', parent: 'body', pos: [0, .7, .5] }, { name: 'shoulder', parent: 'body', pos: [0, .6, .3] }],
  dims: { bodyY: .5, bodyHalfLen: .5, bodyRadius: .2, headRadius: .1, legLen: .3, halfWidth: .2, feet: [[0, 0]], capsuleAxis: axis, ...extra },
  fur: null, eye: null, hard: { offsets: [0], row: { attrs: [['position', 'f32', 3, false]], count: 3, index: null, indexCount: 0, box: false } } }] });

test('round-trips existing live dimensions and keeps nested spawn copies detached', async () => {
  const fields = live(), input = row(fields), load = vi.fn(() => Promise.resolve(bytes));
  const bodies = packedCreatureBodies(input, undefined, load); await bodies.preload();
  fields.bodyAt[0] = 99; fields.headAt[0] = 98; fields.fore.at[0] = 97; fields.fore.radius = 96;
  const a = bodies.copy('animal', 'small'), b = bodies.copy('animal', 'small');
  expect(a.dims).toMatchObject(live()); expect(b.dims).toMatchObject(live());
  expect(a.dims.bodyAt).not.toBe(b.dims.bodyAt); expect(a.dims.headAt).not.toBe(b.dims.headAt);
  expect(a.dims.fore).not.toBe(b.dims.fore); expect(a.dims.fore?.at).not.toBe(b.dims.fore?.at);
  const at = a.dims.bodyAt, head = a.dims.headAt, fore = a.dims.fore;
  if (at === undefined || head === undefined || fore === undefined) throw new Error('Missing live dimensions');
  Reflect.set(at, '0', 7); Reflect.set(head, '0', 8); Reflect.set(fore.at, '0', 9); Reflect.set(fore, 'radius', 10);
  expect(b.dims).toMatchObject(live()); const c = bodies.copy('animal', 'small'); expect(c.dims).toMatchObject(live());
  const wire = JSON.stringify(row({ bodyAt: c.dims.bodyAt, bodyPitch: c.dims.bodyPitch, headAt: c.dims.headAt, fore: c.dims.fore }));
  const serialized: unknown = JSON.parse(wire);
  const again = packedCreatureBodies(serialized, undefined, () => Promise.resolve(bytes));
  await again.preload(); const roundtrip = again.copy('animal', 'small'); expect(roundtrip.dims).toEqual(c.dims);
  expect(roundtrip.hardParts[0]?.getAttribute('position').array).toEqual(c.hardParts[0]?.getAttribute('position').array);
  for (const body of [a, b, c, roundtrip]) for (const geometry of body.hardParts) geometry.dispose();
  expect(load).toHaveBeenCalledOnce();
});

test('legacy absence stays absent and zero-valued valid pitch/half-length survive', async () => {
  for (const axis of ['y', 'z']) {
    const bodies = packedCreatureBodies(row({}, axis), undefined, () => Promise.resolve(bytes)); await bodies.preload();
    const body = bodies.copy('animal', 'small'); for (const key of ['bodyAt', 'bodyPitch', 'headAt', 'fore']) expect(Object.hasOwn(body.dims, key)).toBe(false);
    for (const geometry of body.hardParts) geometry.dispose();
  }
  const bodies = packedCreatureBodies(row({ bodyPitch: 0, fore: { ...live().fore, halfLen: 0 } }), undefined, () => Promise.resolve(bytes));
  await bodies.preload(); const body = bodies.copy('animal', 'small'); expect(body.dims.bodyPitch).toBe(0); expect(body.dims.fore?.halfLen).toBe(0);
  for (const geometry of body.hardParts) geometry.dispose();
});

test('rejects malformed tuples, scalars, fore fields and extra keys before loading', () => {
  const invalid: Record<string, unknown>[] = [
    ...['bodyAt', 'headAt'].flatMap(key => [undefined, null, [], [0, 1], [0, 1, 2, 3], [0, Number.NaN, 0], [0, Infinity, 0], [0, '1', 0]].map(value => ({ [key]: value }))),
    ...[undefined, null, Number.NaN, Infinity, -Infinity, '0'].map(value => ({ bodyPitch: value })),
    { fore: undefined }, { fore: null }, { fore: [] }, { fore: {} },
    ...[{ bone: '' }, { bone: 'missing' }, { bone: undefined }, { at: undefined }, { radius: undefined }, { halfLen: undefined }, { at: null }, { at: [0, 1] }, { at: [0, 1, 2, 3] }, { at: [0, Infinity, 0] },
      { radius: 0 }, { radius: -1 }, { radius: Number.NaN }, { radius: Infinity }, { radius: '1' },
      { halfLen: -1 }, { halfLen: Infinity }, { halfLen: '1' }, { extra: 1 }].map(change => ({ fore: { ...live().fore, ...change } })),
    { unrelatedShape: { radius: 1 } },
  ];
  const load = vi.fn(() => Promise.resolve(bytes));
  for (const extra of invalid) expect(() => packedCreatureBodies(row(extra), undefined, load)).toThrow();
  expect(load).not.toHaveBeenCalled();
});

test('requires unambiguous existing owner bones and refuses ignored upright body offsets', () => {
  for (const extra of [{ bodyAt: [0, 0, 0] }, { bodyPitch: 0 }]) expect(() => packedCreatureBodies(row(extra, 'y'))).toThrow('Incompatible packed live dimensions');
  for (const [extra, name] of [[{ bodyAt: [0, 0, 0] }, 'body'], [{ bodyPitch: 0 }, 'body'], [{ headAt: [0, 0, 0] }, 'head'], [{ fore: live().fore }, 'shoulder']] as const) {
    const missing = row(extra), body = missing.bodies[0]; if (body === undefined) throw new Error('Missing body');
    body.bones = body.bones.filter(bone => bone.name !== name); expect(() => packedCreatureBodies(missing)).toThrow('Incompatible packed live dimensions');
    const duplicate = row(extra), duplicateBody = duplicate.bodies[0]; if (duplicateBody === undefined) throw new Error('Missing body');
    const bone = duplicateBody.bones.find(b => b.name === name); if (bone === undefined) throw new Error('Missing bone');
    duplicateBody.bones.push({ ...bone }); expect(() => packedCreatureBodies(duplicate)).toThrow('Incompatible packed live dimensions');
  }
});
