import type { Object3D, Vector3 } from 'three';

export interface KokparMount {
  readonly mounted: boolean;
  readonly gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';
  readonly horse: { position: Vector3; yaw: number } | null;
}
export interface KokparRound {
  readonly object: Object3D;
  readonly carrying: boolean;
  update: (dt: number, player: Vector3, mount: KokparMount | null) => void;
  win: () => void;
}
