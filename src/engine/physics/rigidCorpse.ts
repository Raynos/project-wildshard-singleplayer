import { Matrix4, Quaternion, Vector3, type Object3D, type Bone } from 'three';
import type { ColliderDesc } from '@dimforge/rapier3d-simd';
import type { Rapier } from './rapier';

/** One convex point hull in the named bone's local bind units. No actor scale is baked here. */
export interface RigidCorpsePart { readonly bone: string; readonly points: readonly (readonly [number, number, number])[] }
/** Client-only optional rigid corpse collision. One existing root body, no extra joints or living shapes. */
export interface RigidCorpseRecipe { readonly parts: readonly RigidCorpsePart[] }
export const RIGID_CORPSE_LIMITS = Object.freeze({ parts: 8, pointsPerPart: 128, points: 512, coordinate: 20 });

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
/** Revalidate typed callers too: no native allocation occurs until the complete recipe has passed. */
export function validateRigidCorpse(value: unknown): asserts value is RigidCorpseRecipe {
  if (!record(value, ['parts']) || !Array.isArray(value['parts']) || value['parts'].length === 0 || value['parts'].length > 8) throw new Error('Invalid rigid corpse parts');
  const names = new Set<string>(); let count = 0;
  for (const part of value['parts']) {
    if (!record(part, ['bone', 'points']) || typeof part['bone'] !== 'string' || part['bone'].length === 0 || part['bone'].length > 64
      || names.has(part['bone']) || !Array.isArray(part['points']) || part['points'].length < 4 || part['points'].length > 128) throw new Error('Invalid rigid corpse part');
    names.add(part['bone']); count += part['points'].length;
    if (count > 512) throw new Error('Rigid corpse point budget exceeded');
    for (const point of part['points']) if (!Array.isArray(point) || point.length !== 3
      || Array.from(point).some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 20)) throw new Error('Invalid rigid corpse point');
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
    const vertices = new Float32Array(part.points.flatMap(point => point.map(n => n * scale)));
    if (vertices.some(n => !Number.isFinite(n))) throw new Error('Unsafe scaled rigid corpse points');
    // Rapier owns the convex construction. Refuse non-volumetric point sets before its native hull builder.
    const origin = part.points[0];
    if (origin === undefined) throw new Error('Empty rigid corpse hull');
    const base = new Vector3(...origin), axis = new Vector3(), normal = new Vector3(), delta = new Vector3(), cross = new Vector3();
    for (const point of part.points) { delta.fromArray(point).sub(base); if (delta.lengthSq() > axis.lengthSq()) axis.copy(delta); }
    for (const point of part.points) { cross.crossVectors(axis, delta.fromArray(point).sub(base)); if (cross.lengthSq() > normal.lengthSq()) normal.copy(cross); }
    const volume = part.points.some(point => Math.abs(normal.dot(delta.fromArray(point).sub(base))) > 1e-9);
    if (!volume) throw new Error('Degenerate rigid corpse hull');
    const desc = R.ColliderDesc.convexHull(vertices);
    if (desc === null) throw new Error('Invalid rigid corpse convex hull');
    return { bone, desc: desc.setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.rotation) };
  });
}

/** @internal Existing numeric pose publication owned by AnimalView, not an authored callback. */
export interface CorpsePosePublication {
  readonly complete: boolean;
  readonly deathT?: number;
  readonly flinch?: number;
  readonly step: (dt: number) => void;
  readonly render: (alpha: number) => void;
}
