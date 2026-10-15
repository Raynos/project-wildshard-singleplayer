import { Euler, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { ColliderDesc } from '../world/registry';
import type { ModelDef, Placement } from './model';
import { place, placeSliced, type Placed, type PlaceOptions } from './place';

/** Authored YXZ pose; a front correction is applied before composing its matrix. */
export interface ModelPose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly pitch?: number; readonly roll?: number }
/** Compose an authored pose without changing its float operation order. */
export function modelPoseMatrix(pose: ModelPose): Matrix4 {
  return new Matrix4().compose(new Vector3(pose.x, pose.y, pose.z),
    new Quaternion().setFromEuler(new Euler(pose.pitch ?? 0, pose.yaw, pose.roll ?? 0, 'YXZ')),
    new Vector3(pose.scale, pose.scale, pose.scale));
}

/** Ordered heterogeneous model placement using the ordinary model registry and optional existing slicer.
 * The fallback parent is used only for registry:null; regular registration retains its normal scene ownership.
 * Floor policy, materials, lights and gameplay remain caller-owned. No clock or service is installed. */
export class ModelPlacementBatch {
  private readonly options: Pick<PlaceOptions, 'ctx' | 'registry' | 'parent' | 'culler'> & {
    readonly fallbackParent?: Object3D; readonly colliders?: ColliderDesc[]; readonly due?: () => Promise<void> | null;
  };
  constructor(options: ModelPlacementBatch['options']) { this.options = options; }

  async place<P extends object>(model: ModelDef<P>, placements: readonly Placement<P>[], options: Omit<PlaceOptions, 'ctx' | 'registry'>): Promise<Placed> {
    const { fallbackParent, colliders, due, ...base } = this.options;
    const placed = due === undefined ? place(model, placements, { ...base, ...options }) : await placeSliced(model, placements, { ...base, ...options }, due);
    colliders?.push(...placed.colliders);
    if (base.registry === null) fallbackParent?.add(placed.object);
    return placed;
  }

  /** Full matrices keep their exact translation and any per-copy parameters. */
  frames<P extends object>(model: ModelDef<P>, frames: readonly Matrix4[], params: P | undefined, options: Omit<PlaceOptions, 'ctx' | 'registry'>): Promise<Placed> {
    return this.place(model, frames.map(matrix => ({ x: matrix.elements[12], y: matrix.elements[13], z: matrix.elements[14], matrix, ...(params === undefined ? {} : { params }) })), options);
  }

  /** Pose rows retain input order; the returned corrected rows can drive lights or borrowed handles. */
  async poses<P extends object>(model: ModelDef<P>, poses: readonly ModelPose[], front: number, extra: Pick<Placement<P>, 'variant' | 'params'>, options: Omit<PlaceOptions, 'ctx' | 'registry'>): Promise<{ places: ModelPose[]; placed: Placed } | null> {
    if (poses.length === 0) return null;
    const places = poses.map(pose => ({ ...pose, yaw: pose.yaw + front }));
    const placed = await this.place(model, places.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, matrix: modelPoseMatrix(pose), ...extra })), options);
    return { places, placed };
  }
}
