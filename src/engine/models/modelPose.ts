import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

/** Authored YXZ pose; a front correction is applied before composing its matrix. */
export interface ModelPose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly pitch?: number; readonly roll?: number }
/** Compose an authored pose without changing its float operation order. */
export function modelPoseMatrix(pose: ModelPose): Matrix4 {
  return new Matrix4().compose(new Vector3(pose.x, pose.y, pose.z),
    new Quaternion().setFromEuler(new Euler(pose.pitch ?? 0, pose.yaw, pose.roll ?? 0, 'YXZ')),
    new Vector3(pose.scale, pose.scale, pose.scale));
}

