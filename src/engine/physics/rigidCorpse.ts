import { prepareConvexHull, validateConvexPoints } from './convexHull';
import { MathUtils, Matrix4, Quaternion, Vector3, type Object3D, type Bone } from 'three';
import type { ColliderDesc } from '@dimforge/rapier3d-simd';
import type { Rapier } from './rapier';
import { groups } from './groups';

/** One convex point hull in the named bone's local bind units. No actor scale is baked here. */
export interface RigidCorpsePart { readonly bone: string; readonly points: readonly (readonly [number, number, number])[] }
/** Client-only optional collision on one existing root body, with no extra joints or living shapes.
 * Captured holds the lethal local pose, sacrificing the death fold; omission retains numeric animation. */
export interface RigidCorpseRecipe { readonly posePolicy?: 'captured'; readonly parts: readonly RigidCorpsePart[] }
export const RIGID_CORPSE_LIMITS = Object.freeze({ parts: 8, pointsPerPart: 128, points: 512, coordinate: 20 });

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
/** Revalidate typed callers too: no native allocation occurs until the complete recipe has passed. */
export function validateRigidCorpse(value: unknown): asserts value is RigidCorpseRecipe {
  if (!(record(value, ['parts']) || record(value, ['parts', 'posePolicy']) && value['posePolicy'] === 'captured') || !Array.isArray(value['parts']) || value['parts'].length === 0 || value['parts'].length > 8) throw new Error('Invalid rigid corpse parts');
  const names = new Set<string>(); let count = 0;
  for (const part of value['parts']) {
    if (!record(part, ['bone', 'points']) || typeof part['bone'] !== 'string' || part['bone'].length === 0 || part['bone'].length > 64
      || names.has(part['bone']) || !Array.isArray(part['points']) || part['points'].length < 4 || part['points'].length > 128) throw new Error('Invalid rigid corpse part');
    names.add(part['bone']); count += part['points'].length;
    if (count > 512) throw new Error('Rigid corpse point budget exceeded');
    validateConvexPoints(part['points']);
  }
}

/** Root-relative rigid transform with uniform actor scale applied exactly once to translation. */
export interface RigidCorpseTransform { readonly position: Vector3; readonly rotation: Quaternion }
export function rigidCorpseTransform(root: Object3D, bone: Bone, scale: number): RigidCorpseTransform {
  if (!Number.isFinite(scale) || scale <= 0 || [root.scale.x, root.scale.y, root.scale.z].some(n => Math.abs(n - scale) > 1e-7)) throw new Error('Invalid rigid corpse actor scale');
  let node: Object3D | null = bone;
  while (node !== root) {
    if (node === null || [node.scale.x, node.scale.y, node.scale.z].some(n => !Number.isFinite(n) || Math.abs(n - 1) > 1e-7)) throw new Error('Invalid rigid corpse bone ancestry or scale');
    node = node.parent;
  }
  root.updateWorldMatrix(true, true);
  if (root.parent?.matrixWorld.elements.some((value, i) => !Number.isFinite(value)
    || Math.abs(value - (i % 5 === 0 ? 1 : 0)) > 1e-7) === true) throw new Error('Rigid corpse requires an identity parent');
  const worldScale = new Vector3(), worldPosition = new Vector3(), worldRotation = new Quaternion();
  root.matrixWorld.decompose(worldPosition, worldRotation, worldScale);
  if (root.matrixWorld.elements.some(n => !Number.isFinite(n)) || [worldScale.x, worldScale.y, worldScale.z].some(n => Math.abs(n - scale) > 1e-6)) throw new Error('Unsafe rigid corpse root transform');
  const matrix = new Matrix4().copy(root.matrixWorld).invert().multiply(bone.matrixWorld);
  const position = new Vector3(), rotation = new Quaternion(), localScale = new Vector3();
  matrix.decompose(position, rotation, localScale);
  if (matrix.elements.some(n => !Number.isFinite(n)) || [localScale.x, localScale.y, localScale.z].some(n => Math.abs(n - 1) > 1e-6)
    || Math.abs(rotation.lengthSq() - 1) > 1e-6) throw new Error('Unsafe rigid corpse transform');
  return { position: position.multiplyScalar(scale), rotation };
}

/** Prepared once, before body allocation; fixed pre updates only these hulls' local transforms. */
export interface PreparedRigidCorpsePart { readonly bone: Bone; readonly desc: ColliderDesc }
export function prepareRigidCorpse(R: Rapier, recipe: unknown, root: Object3D,
  bones: Readonly<Record<string, Bone>>, scale: number, build: 'rigid' | 'upright' | 'quadruped'): PreparedRigidCorpsePart[] {
  validateRigidCorpse(recipe);
  if (build !== 'rigid') throw new Error('Rigid corpse requires a custom rigid rig');
  return recipe.parts.map(part => {
    const bone = Object.hasOwn(bones, part.bone) ? bones[part.bone] : undefined;
    if (bone === undefined) throw new Error('Missing rigid corpse bone');
    const pose = rigidCorpseTransform(root, bone, scale);
    return { bone, desc: prepareHull(R, part, scale, pose) };
  });
}

function prepareHull(R: Rapier, part: RigidCorpsePart, scale: number, pose: RigidCorpseTransform): ColliderDesc {
    const desc = prepareConvexHull(R, part.points, scale);
    return desc.setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.rotation);
}

interface VectorData { readonly x: number; readonly y: number; readonly z: number }
interface QuaternionData extends VectorData { readonly w: number }
/** Renderer-free local transform. Parent indices are ordered, never references into a visual tree. */
export interface NumericCorpseJoint {
  readonly name: string; readonly parent: number; readonly position: VectorData;
  readonly rotation: QuaternionData; readonly scale: VectorData;
}
export interface NumericCorpseTransform extends RigidCorpseTransform { readonly bone: string }
const finiteVector = (v: VectorData): boolean => [v.x, v.y, v.z].every(Number.isFinite);
/** Validate the entire hierarchy and compute root-relative transforms, applying actor scale once. */
export function numericCorpseTransforms(joints: readonly NumericCorpseJoint[], scale: number): NumericCorpseTransform[] {
  if (!Number.isFinite(scale) || scale <= 0 || joints.length === 0 || joints.length > 32) throw new Error('Invalid numeric corpse rig');
  const names = new Set<string>(), matrices: Matrix4[] = [];
  return joints.map((joint, index) => {
    const q = joint.rotation;
    if (joint.name.length === 0 || joint.name.length > 64 || names.has(joint.name)
      || !Number.isInteger(joint.parent) || joint.parent < -1 || joint.parent >= index || !finiteVector(joint.position)
      || !finiteVector(q) || !Number.isFinite(q.w) || Math.abs(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w - 1) > 1e-6
      || !finiteVector(joint.scale) || [joint.scale.x, joint.scale.y, joint.scale.z].some(n => Math.abs(n - 1) > 1e-7)) throw new Error('Unsafe numeric corpse joint');
    names.add(joint.name);
    const matrix = new Matrix4().compose(new Vector3(joint.position.x, joint.position.y, joint.position.z),
      new Quaternion(q.x, q.y, q.z, q.w), new Vector3(joint.scale.x, joint.scale.y, joint.scale.z));
    const parent = matrices[joint.parent]; if (parent !== undefined) matrix.premultiply(parent);
    matrices.push(matrix);
    const position = new Vector3(), rotation = new Quaternion(), localScale = new Vector3();
    matrix.decompose(position, rotation, localScale);
    if (matrix.elements.some(n => !Number.isFinite(n)) || [localScale.x, localScale.y, localScale.z].some(n => Math.abs(n - 1) > 1e-6)
      || Math.abs(rotation.lengthSq() - 1) > 1e-6) throw new Error('Unsafe numeric corpse transform');
    position.multiplyScalar(scale);
    if (![position.x, position.y, position.z].every(n => Number.isFinite(Math.fround(n)))) throw new Error('Unsafe scaled corpse transform');
    return { bone: joint.name, position, rotation };
  });
}
/** Same hull constructor and bounds as the Three adapter, with no scene objects or authored callbacks. */
export function prepareNumericRigidCorpse(R: Rapier, recipe: unknown, joints: readonly NumericCorpseJoint[], scale: number): { bone: string; desc: ColliderDesc; pose: NumericCorpseTransform }[] {
  validateRigidCorpse(recipe);
  const transforms = new Map(numericCorpseTransforms(joints, scale).map(row => [row.bone, row]));
  return recipe.parts.map(part => {
    const pose = transforms.get(part.bone); if (pose === undefined) throw new Error('Missing rigid corpse bone');
    return { bone: part.bone, desc: prepareHull(R, part, scale, pose), pose };
  });
}

/** Existing single-root compound physics, shared with the legacy rigid corpse. No tuning surface. */
export interface RigidCorpseBodyInput {
  readonly position: VectorData; readonly rotation: QuaternionData; readonly velocity: VectorData; readonly dir: VectorData;
  readonly damage: number; readonly scale: number;
  readonly dims: { readonly halfWidth: number; readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number };
}
export function rigidCorpseBodyDescriptor(R: Rapier, input: RigidCorpseBodyInput): ReturnType<Rapier['RigidBodyDesc']['dynamic']> {
  const { position: p, rotation: q, velocity: v, dims: d, scale: s } = input;
  const dh = new Vector3(input.dir.x, 0, input.dir.z);
  if (dh.lengthSq() < 1e-6) dh.set(0, 0, 1); else dh.normalize();
  const throwV = MathUtils.clamp(input.damage * .04, 2, 2.5);
  const spin = new Vector3().crossVectors(new Vector3(0, 1, 0), dh).multiplyScalar(throwV * 2.5);
  const x = d.halfWidth * s, y = d.bodyY * .5 * s, z = Math.max(d.bodyHalfLen, d.bodyRadius) * s;
  return R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q)
    .setLinvel(v.x + dh.x * throwV * .6, v.y + throwV * 1.3, v.z + dh.z * throwV * .6)
    .setLinearDamping(.1).setAngularDamping(.3).setAngvel(spin)
    .setAdditionalMassProperties(5, { x: 0, y: d.bodyY * .6 * s, z: 0 },
      { x: 5 / 3 * (y * y + z * z), y: 5 / 3 * (x * x + z * z), z: 5 / 3 * (x * x + y * y) }, { x: 0, y: 0, z: 0, w: 1 });
}
export function rigidCorpseCollider(desc: ColliderDesc, mass: number): ColliderDesc {
  return desc.setMass(mass).setCollisionGroups(groups('DEBRIS')).setSolverGroups(groups('DEBRIS')).setFriction(.9).setRestitution(.05);
}
/** Existing freeze law, including the unconditional maximum-age bound. */
export const CORPSE_SETTLE = Object.freeze({ speed: .12, quiet: .5, age: 5, spinLever: .05 });

/** @internal Existing numeric pose publication owned by AnimalView, not an authored callback. */
export interface CorpsePosePublication {
  readonly posePolicy?: 'captured' | undefined;
  readonly complete: boolean;
  readonly deathT?: number;
  readonly flinch?: number;
  readonly step: (dt: number) => void;
  readonly render: (alpha: number) => void;
}
