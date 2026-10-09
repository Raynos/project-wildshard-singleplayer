import { expect, it } from 'vitest';
import { parsePineSolid } from '../../../src/shards/pine-hollow/runtime/baked';

const solid = { shape: 1, groups: 65537, friction: 0.5, body: null, at: [1, 2, 3], rot: [0, 0, 0, 1], half: [1, 1, 1] };

it('preserves actual piece and declared-owner namespaces without changing any native descriptor', () => {
  const plain = parsePineSolid(solid);
  expect(plain).toEqual({ shape: 1, groups: 65537, friction: 0.5, at: [1, 2, 3], rot: [0, 0, 0, 1], half: [1, 1, 1] });
  expect(Object.hasOwn(plain, 'ownerId')).toBe(false);
  for (const ownerId of ['piece:pine.resin.1', 'declared:pine.resin.1']) {
    expect(parsePineSolid({ ...solid, ownerId })).toEqual({ ...plain, ownerId });
  }
});

it('refuses unbounded, ambiguous or invented owner provenance and unknown fields', () => {
  for (const ownerId of ['', 'pine.resin.1', 'piece:', 'declared:', 'piece:line\nbreak', `piece:${'a'.repeat(257)}`, {}, undefined]) {
    expect(() => parsePineSolid({ ...solid, ownerId })).toThrow();
  }
  expect(() => parsePineSolid({ ...solid, ownerId: 'piece:pine.resin.1', invented: true })).toThrow();
});

it('preserves every actual finite material and keeps untagged legacy solids explicit', () => {
  const plain = parsePineSolid(solid);
  expect(Object.hasOwn(plain, 'material')).toBe(false);
  for (const material of ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']) {
    expect(parsePineSolid({ ...solid, material })).toEqual({ ...plain, material });
  }
  for (const material of ['', 'plastic', '__proto__', null, {}, undefined]) expect(() => parsePineSolid({ ...solid, material })).toThrow();
});
