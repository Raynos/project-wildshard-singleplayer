import { Group, Vector3 } from 'three';
import { expect, test } from 'vitest';
import { applyAnimalRoot } from '../src/engine/entities/animalRig';

test('omitted and explicit engine root recoil preserve the legacy matrices exactly', () => {
  for (const custom of [false, true]) for (const alive of [false, true]) {
    for (const flinch of [0, .001, .4, 1]) for (const yaw of [-2.1, 0, 1.3]) {
      const position = new Vector3(4.2, 900, -7.1), before = position.toArray();
      const expected = new Group(), omitted = new Group(), explicit = new Group();
      const f = custom && alive ? flinch * 1.8 : 0;
      expected.position.copy(position); expected.rotation.set(.13 + -.12 * f, yaw, -.09 + .25 * f, 'YXZ');
      applyAnimalRoot(omitted, position, yaw, .13, -.09, custom, alive, flinch, -.12, .25);
      applyAnimalRoot(explicit, position, yaw, .13, -.09, custom, alive, flinch, -.12, .25, 'engine');
      for (const root of [expected, omitted, explicit]) root.updateMatrixWorld(true);
      expect(omitted.matrixWorld.elements).toEqual(expected.matrixWorld.elements);
      expect(explicit.matrixWorld.elements).toEqual(expected.matrixWorld.elements);
      expect(position.toArray()).toEqual(before);
    }
  }
});

test('authored recoil preserves terrain tilt, yaw, position and scale while omitting duplicate root recoil', () => {
  for (const custom of [false, true]) for (const alive of [false, true]) for (const flinch of [0, .5, 1]) {
    const root = new Group(), expected = new Group(), position = new Vector3(-3, 900, 8);
    root.scale.set(1.2, 1.2, 1.2); expected.scale.copy(root.scale);
    expected.position.copy(position); expected.rotation.set(.17, -.8, -.11, 'YXZ');
    applyAnimalRoot(root, position, -.8, .17, -.11, custom, alive, flinch, -.12, .25, 'authored-pose');
    root.updateMatrixWorld(true); expected.updateMatrixWorld(true);
    expect(root.matrixWorld.elements).toEqual(expected.matrixWorld.elements);
    expect(root.scale.toArray()).toEqual([1.2, 1.2, 1.2]);
  }
});
