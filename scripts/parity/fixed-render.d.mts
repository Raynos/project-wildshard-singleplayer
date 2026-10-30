import type { GameClock } from '../../src/engine/core/clock';
import type { ParityFrame } from './frame-bytes.mjs';

export interface FixedWorldFrame extends ParityFrame {
  calls:number;triangles:number;pinned:string[];at:number[];frame:number;
  clock:ReturnType<GameClock['snapshot']>;
}
/** Native M3 world render; compositor and camera children are excluded. */
export function fixedWorldFrame(pose:{yaw:number;pitch:number}):FixedWorldFrame;
