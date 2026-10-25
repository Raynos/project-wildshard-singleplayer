/** Author contact tags retain the native surface vocabulary. */
export type ContactSurface = 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' |
  'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
interface Vec3 { x: number; y: number; z: number }
interface Quat { x: number; y: number; z: number; w: number }
interface Placed extends Vec3 { yaw?: number; rot?: Quat; surface?: ContactSurface }
/** Native collision description. Typed geometry remains in memory until its binary writer runs. */
export type ColliderDesc =
  | Placed & { kind: 'box'; hx: number; hy: number; hz: number }
  | Placed & { kind: 'capsule'; halfHeight: number; radius: number }
  | Placed & { kind: 'ball'; radius: number }
  | Placed & { kind: 'hull'; points: Float32Array }
  | Placed & { kind: 'trimesh'; vertices: Float32Array; indices: Uint32Array }
  | { kind: 'treads'; from: Vec3; to: Vec3; width: number; count: number; surface?: ContactSurface };
/** A world-space box rotated by negative rot about +Y. */
export interface BoxSpec { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
/** Authored placement batching grammar; no renderer is installed. */
export type Draw = 'single' | 'merged' | 'instanced' | 'batched';

/** Stable specimen identity preserves parameter insertion order and native JSON spelling. */
export function specimenKey(id: string, params: object): string { return `${id} ${JSON.stringify(params)}`; }
