/** Shared shapes for the Nalati POI modules (B5). */
import type * as THREE from 'three';
import type { Collider } from '../../player/Player';
import type { Sky } from '../Sky';
import type { Flutter } from './Flutter';
import type { Smoke } from './Smoke';

export type Ground = (x: number, z: number) => number;
export type Platform = (x: number, z: number) => number | undefined;

/** what every POI builder is handed: the sky (material), the terrain, and the two shared animated meshes */
export interface PoiCtx {
  sky: Sky;
  ground: Ground;
  /** all cloth (ribbons, pennants, strips) goes here — one draw call for the shard */
  flutter: Flutter;
  /** all chimney / fire plumes go here — one draw call for the shard */
  smoke: Smoke;
}

/** what every POI builder returns */
export interface PoiPiece {
  name: string;
  /** add to the scene */
  object: THREE.Object3D;
  /** push into `player.colliders` */
  colliders: Collider[];
  /** push each into `player.platforms` (walkable decks / steps / tops) */
  platforms: Platform[];
  /** triangles in `object` (for the perf report) */
  tris: number;
}
