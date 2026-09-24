/** Shared shapes for the Nalati POI modules (B5). */
import type * as THREE from 'three';
import type { Material } from '../../physics/surface';
import type { ColliderDesc } from '../registry';
import type { Sky } from '../Sky';
import type { Box } from './solid';
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

/** what every POI builder returns — `NalatiPOIs` registers it with the world registry (NALATI-MERGE P1, src/world/nalati/solid.ts) */
export interface PoiPiece {
  name: string;
  /** add to the scene */
  object: THREE.Object3D;
  /** its boxes (with their material; a `ghost` box is data only) — solid via the registry, and read as data by the
   *  weather (the yurts) and the camp clutter (its keep-out) */
  colliders: Box[];
  /** what the boxes are made of, unless a box says otherwise */
  surface: Material;
  /** the rest of its collision as real geometry: decks and floors as slabs, stairs as treads, rocks as hulls */
  descs?: ColliderDesc[];
  /** its walkable tops as a function (decks / steps / ledges) — placement only: the player walks on the colliders */
  floor?: Platform;
  /** triangles in `object` (for the perf report) */
  tris: number;
  /** per-frame animation (NalatiPOIs.update calls it with the viewer's position when it has one) */
  update?: (dt: number, viewer: THREE.Vector3 | null) => void;
}
