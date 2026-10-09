import { MathUtils, type Vector3 } from 'three';

/** Mutable pose lent by a reward's player owner; this law creates no player, motor, camera or view. */
export interface QuestRewardPosePlayer { position: Vector3; velocity: Vector3; yaw: number; pitch: number }
/** The pose and clock phase captured once when the reward starts. Its owner persists these values with elapsed time. */
export interface QuestRewardOrigin { position: Vector3; yaw: number; pitch: number; phase: number }
/** An authored destination; absent components retain the captured pose or the running clock. */
export interface QuestRewardPoseTarget { at?: Vector3; yaw?: number; pitch?: number; phase?: number }

/** The shipping reward pose: 2.5 s camera ease, shortest yaw and 3.5 s forward clock ease, without presentation. */
export function applyQuestRewardPose(elapsed: number, from: Readonly<QuestRewardOrigin>, target: Readonly<QuestRewardPoseTarget>,
  player: QuestRewardPosePlayer, dayNight: { phase: number } | null | undefined): void {
  const k = MathUtils.smoothstep(elapsed, 0, 2.5);
  if (target.at !== undefined) player.position.lerpVectors(from.position, target.at, k);
  player.velocity.set(0, 0, 0);
  const turn = (target.yaw ?? from.yaw) - from.yaw;
  player.yaw = from.yaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * k;
  player.pitch = from.pitch + ((target.pitch ?? from.pitch) - from.pitch) * k;
  if (dayNight && target.phase !== undefined) {
    const ahead = ((target.phase - from.phase) % 1 + 1) % 1;
    dayNight.phase = (from.phase + ahead * MathUtils.smoothstep(elapsed, 0, 3.5)) % 1;
  }
}
