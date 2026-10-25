import { expect, test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Vector3, Color } from 'three';
import { spillInputIdentity } from './spillBake';

function input() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 1, 2], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([0, 1, 0], 3));
  return { geometry: new Map([['surface', geometry]]), emitters: [
    { at: new Vector3(1, 2, 3), color: new Color(.2, .3, .4), w: 1, h: 2, power: 3, spill: .4 },
    { at: new Vector3(4, 5, 6), color: new Color(.5, .6, .7), w: 2, h: 3, power: 4, spill: .5 },
  ] };
}

test('spill identity covers independent buffers with the same complete input words', () => {
  expect(spillInputIdentity(input())).toBe(spillInputIdentity(input()));
});

test.each(['position', 'normal'] as const)('spill identity observes every %s word, including signed zero', attribute => {
  const source = input(), before = spillInputIdentity(source), geometry = source.geometry.get('surface');
  if (geometry === undefined) throw new Error('Missing spill fixture');
  geometry.getAttribute(attribute).setX(0, -0);
  expect(spillInputIdentity(source)).not.toBe(before);
  geometry.getAttribute(attribute).setX(0, 4);
  expect(spillInputIdentity(source)).not.toBe(before);
});

test('spill identity preserves emitter order and all consumed scalar inputs', () => {
  const original = spillInputIdentity(input()), reversed = input();
  reversed.emitters.reverse(); expect(spillInputIdentity(reversed)).not.toBe(original);
  for (const field of ['w', 'h', 'power', 'spill'] as const) {
    const source = input(), emitter = source.emitters[0];
    if (emitter === undefined) throw new Error('Missing spill emitter');
    emitter[field] += .125; expect(spillInputIdentity(source)).not.toBe(original);
  }
  for (const component of ['x', 'y', 'z'] as const) {
    const source = input(), emitter = source.emitters[0];
    if (emitter === undefined) throw new Error('Missing spill emitter');
    emitter.at[component] += .125; expect(spillInputIdentity(source)).not.toBe(original);
  }
  for (const component of ['r', 'g', 'b'] as const) {
    const source = input(), emitter = source.emitters[0];
    if (emitter === undefined) throw new Error('Missing spill emitter');
    emitter.color[component] += .125; expect(spillInputIdentity(source)).not.toBe(original);
  }
});
