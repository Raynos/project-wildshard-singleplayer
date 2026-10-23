import { expect, test } from 'vitest';
import { Bone, Group, Matrix4 } from 'three';
import { AnimalGroup, type MatrixOwner } from '../src/engine/entities/animalMatrices';

/** A near animal (pose not frozen) with a two-bone chain; `poseVersion` as AnimalView counts its pose updates. */
function animal() {
  const mesh = new Group(), hip = new Bone(), knee = new Bone();
  mesh.add(hip); hip.add(knee); knee.position.set(0, -1, 0);
  const owner: { mesh: Group; poseFrozen: boolean; lastHitT: number; poseVersion: number } = { mesh, poseFrozen: false, lastHitT: 0, poseVersion: 0 };
  return { owner, hip, knee };
}

test('a pose version the group has proved skips without comparing; a new version is compared (G639)', () => {
  const group = new AnimalGroup(), { owner, hip, knee } = animal(), typed: MatrixOwner = owner;
  group.add(owner.mesh); group.own(typed);
  group.updateMatrixWorld(true);
  expect(group.last).toEqual({ skipped: 0, updated: 1 });
  // no pose update since: skipped on its version alone
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 1, updated: 0 });
  // a pose update that moved nothing: compared, still skipped, and that version is now proved
  owner.poseVersion++;
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 1, updated: 0 });
  // a pose update that moved a bone: compared, the subtree updated, its world matrix the moved one
  owner.poseVersion++; hip.rotation.z = 0.5;
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 0, updated: 1 });
  const expected = new Matrix4().makeRotationZ(0.5).multiply(new Matrix4().makeTranslation(0, -1, 0));
  for (const [i, value] of knee.matrixWorld.elements.entries()) expect(value).toBeCloseTo(expected.elements[i] ?? 0, 12);
  // the next frame without a pose update skips again
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 1, updated: 0 });
});

test('an owner without a version keeps comparing every pass, as before', () => {
  const group = new AnimalGroup(), { owner, hip } = animal();
  const legacy: MatrixOwner = { mesh: owner.mesh, poseFrozen: false, lastHitT: 0 };
  group.add(owner.mesh); group.own(legacy);
  group.updateMatrixWorld(true);
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 1, updated: 0 });
  hip.rotation.z = 0.25;
  group.updateMatrixWorld();
  expect(group.last).toEqual({ skipped: 0, updated: 1 });
});
