// pathMovers — a world's ambient movers on closed paths, posed from the clock (SHARD-PLATFORM M3, ex Nine Dragon's
// world/build.ts): a loop runs along x and wraps (a train), a cable swings between its ends short of a margin, its height
// rising along the span (a gondola), an orbit circles a centre at its rate, bobbing, facing along the circle (a drone).
// `moverStart` is the placement at t = 0; `moveAlong` poses the placed copy at t (no allocation per frame).
//
//   const train: MoverPath = { kind: 'loop', x: -100, y: 150, z: -27, speed: 16, length: 300 };
//   place(model, [moverStart(train)], …);   every frame: moveAlong(copy, train, t);
import type { Object3D } from 'three';

/** A mover along x from `x`, wrapping every `length` m at `speed` m/s. */
export interface LoopPath { readonly kind: 'loop'; readonly x: number; readonly y: number; readonly z: number; readonly speed: number; readonly length: number }
/** A mover swinging along a cable from x0 to x1 (`margin` m short of each end) at height y rising `rise` m along it, at z; its swing sin(t · rate + phase). */
export interface CablePath { readonly kind: 'cable'; readonly x0: number; readonly x1: number; readonly y: number; readonly z: number; readonly margin: number; readonly rise: number; readonly rate: number; readonly phase: number }
/** A mover circling (x, z) at radius r and height y, angle t · rate + phase, bobbing `bob` m at sin(t · bobRate + phase), facing along the circle. */
export interface OrbitPath { readonly kind: 'orbit'; readonly x: number; readonly y: number; readonly z: number; readonly r: number; readonly rate: number; readonly phase: number; readonly bob: number; readonly bobRate: number }
/** One of the movers' paths. */
export type MoverPath = LoopPath | CablePath | OrbitPath;

/** A mover's placement: where it stands, and its yaw where its path turns it. */
export interface MoverPlacement { readonly x: number; readonly y: number; readonly z: number; readonly yaw?: number }

const pose = { x: 0, y: 0, z: 0, yaw: 0 };

function poseAt(p: MoverPath, t: number): boolean {
  if (p.kind === 'loop') {
    pose.x = p.x + ((t * p.speed) % p.length); pose.y = p.y; pose.z = p.z;
    return false;
  }
  if (p.kind === 'cable') {
    const x = p.x0 + p.margin + (p.x1 - p.x0 - p.margin * 2) * (0.5 + 0.5 * Math.sin(t * p.rate + p.phase));
    pose.x = x; pose.y = p.y + ((x - p.x0) / (p.x1 - p.x0)) * p.rise; pose.z = p.z;
    return false;
  }
  const a = t * p.rate + p.phase;
  pose.x = p.x + Math.cos(a) * p.r; pose.y = p.y + Math.sin(t * p.bobRate + p.phase) * p.bob; pose.z = p.z + Math.sin(a) * p.r; pose.yaw = -a;
  return true;
}

/** The mover's placement at t = 0 (a yaw only for a path that turns it). */
export function moverStart(p: MoverPath): MoverPlacement {
  return poseAt(p, 0) ? { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw } : { x: pose.x, y: pose.y, z: pose.z };
}

/** Pose the placed copy on its path at t (s): its position, and its yaw where the path turns it. */
export function moveAlong(o: Object3D, p: MoverPath, t: number): void {
  const turns = poseAt(p, t);
  o.position.set(pose.x, pose.y, pose.z);
  if (turns) o.rotation.y = pose.yaw;
}
