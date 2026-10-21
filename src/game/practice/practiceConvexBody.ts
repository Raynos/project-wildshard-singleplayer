import { Vector3 } from 'three';
import { validateConvexPoints, type ConvexBodyRecipe } from '@wildshard/engine/physics/convexHull';
import { numericCorpseTransforms, validateRigidCorpse, type NumericCorpseJoint } from '@wildshard/engine/physics/rigidCorpse';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import type { NativeCreaturePoseRecipe } from '../plugin/animation';
import { numericPoseKeepsJoints } from '../plugin/channelPrograms';

/** Bounded practice-only selection of one existing, invariant source hull. No copied or enlarged geometry. */
export function practiceConvexBody(actor: AnimalSim, recipe: NativeCreaturePoseRecipe,
  animate: (ctx: AnimalRigContext) => void, joints: readonly NumericCorpseJoint[], bone: string): ConvexBodyRecipe {
  if (!actor.flatGroundRoot
    || !recipe.custom || recipe.practice !== true || recipe.rootFlinch !== 'authored-pose'
    || recipe.deathSplay !== false) throw new Error('Convex practice body requires a flat yaw-only actor root');
  validateRigidCorpse(actor.dims.rigidCorpse);
  const part = actor.dims.rigidCorpse.parts.find(row => row.bone === bone);
  if (part === undefined) throw new Error('Missing convex practice source bone');
  const transforms = numericCorpseTransforms(joints, actor.scale);
  const index = joints.findIndex(row => row.name === bone), ancestry: string[] = [];
  for (let i = index; i >= 0;) {
    const row = joints[i]; if (row === undefined) throw new Error('Missing convex ancestry');
    const bind = recipe.joints[i];
    if (!numericPoseKeepsJoints(animate, [row.name])) throw new Error('Convex practice ancestry has moving channels');
    if (bind === undefined || bind.name !== row.name || bind.parent !== row.parent
      || [row.position.x, row.position.y, row.position.z].some((value, axis) => value !== bind.position[axis])
      || row.rotation.x !== 0 || row.rotation.y !== 0 || row.rotation.z !== 0 || row.rotation.w !== 1)
      throw new Error('Convex practice ancestry differs from immutable bind pose');
    ancestry.push(row.name); i = row.parent;
  }
  if (!numericPoseKeepsJoints(animate, ancestry)) throw new Error('Convex practice ancestry has moving channels');
  const pose = transforms[index]; if (pose === undefined) throw new Error('Missing convex transform');
  const points = part.points.map(point => {
    const p = new Vector3(...point).multiplyScalar(actor.scale).applyQuaternion(pose.rotation).add(pose.position);
    return Object.freeze([p.x, p.y, p.z] as [number, number, number]);
  });
  validateConvexPoints(points);
  return Object.freeze({ points: Object.freeze(points) });
}
