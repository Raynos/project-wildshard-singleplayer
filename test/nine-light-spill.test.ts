import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { bakeSpill, type Emitter } from '../src/shards/nine-dragon-stack/generators/lightSpill';
import { originalSpill } from './fixtures/nine-spill/vertexSpill';

function geometry(): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute('position', new BufferAttribute(new Float32Array([
    -0, 0, 0, 0, 0, 0, -3.7, 0, 0, 3.7, 0, 0, 0, -3.7, 0,
    0, 3.7, 0, 3, 2, -1, -4, -2, 1, 20, 20, 20,
  ]), 3));
  result.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0,
    0, -1, 0, .25, .5, -.25, -0, 0, 1, 1, 0, 0,
  ]), 3));
  return result;
}

for (const reverse of [false, true]) test(`spill retains every original vertex word and emitter order (${reverse})`, async () => {
  const emitters: Emitter[] = [
    { at: new Vector3(0, 0, 0), color: new Color(.3, .5, .7), w: 1, h: 1, power: 1, spill: .4 },
    { at: new Vector3(-2, 3, -1), color: new Color(.7, .2, .1), w: .5, h: 1.5, power: 2, spill: .8 },
    { at: new Vector3(3, -2, 2), color: new Color(.1, .8, .4), w: 2, h: 1, power: 1, spill: 0 },
  ];
  if (reverse) emitters.reverse();
  const before = geometry(), after = before.clone();
  try {
    await originalSpill([before], emitters);
    bakeSpill([after], emitters);
    const expected = before.getAttribute('aSpill').array, actual = after.getAttribute('aSpill').array;
    expect(new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength))
      .toEqual(new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength));
    expect(after.getAttribute('position').array).toEqual(before.getAttribute('position').array);
    expect(after.getAttribute('normal').array).toEqual(before.getAttribute('normal').array);
  } finally { before.dispose(); after.dispose(); }
});

test('an unlit spill retains the original all-positive-zero channel', async () => {
  const before = geometry(), after = before.clone();
  try {
    await originalSpill([before], []); bakeSpill([after], []);
    expect(after.getAttribute('aSpill').array).toEqual(before.getAttribute('aSpill').array);
    expect(Array.from(after.getAttribute('aSpill').array).every(value => Object.is(value, 0))).toBe(true);
  } finally { before.dispose(); after.dispose(); }
});
