import type { ClientChannelProgram } from '../src/format/clientChannels';
import type { MoverPose } from '../src/engine/physics/mover';

export function mapRest(scene: { nodes: readonly { id: string; instances?: number }[] }, programs: readonly ClientChannelProgram[], poses: readonly (MoverPose & { id: string })[]): {
  version: number;
  nodes: Record<string, { position: number[]; quaternion: number[]; scale: number[]; visible: boolean; matrices?: number[] }>;
};
