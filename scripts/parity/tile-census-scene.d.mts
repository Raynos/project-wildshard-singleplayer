import type { Object3D } from 'three';

export interface SceneCpuBuffer { id: string; bytes: number }
export interface SceneBufferUse { id: string; role: string }
export interface SceneBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}
export interface CensusSceneNode {
  path: string; type: string; buffers: string[]; cpuBuffers: SceneBufferUse[];
  missingCpuRoles: string[]; worldBounds: SceneBounds | null;
}
export interface CensusSceneSnapshot { nodes: CensusSceneNode[]; cpuBuffers: SceneCpuBuffer[] }
/** Serialisable, synchronous scene read. Buffer ids belong to this read only;
 * backing capacities are not resident RAM or a promise that caches can retire. */
export function captureTileScene(scene: Object3D, sourceIds: (source: object) => string[]): CensusSceneSnapshot;
