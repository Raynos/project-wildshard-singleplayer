import type { Scene } from 'three';
import type { SkyRig } from '../../src/engine/world/skyRig';
import type { Terrain } from '../../src/engine/world/Terrain';
import type { Forest } from '../../src/engine/world/forest/Forest';
import type { Physics } from '../../src/engine/physics/Physics';
import type { WorldRegistry, ColliderDesc } from '../../src/engine/world/registry';
import type { ModelPlacementVisitor } from '../../src/engine/models/model';
import type { ShardManifest } from '../../src/game/shard/manifest';
import type { BakedGrid } from '../../src/engine/world/BakedTerrain';

/** Resources are borrowed only during capture; snapshot real geometry/placements before the host unloads. */
export interface AuthoredWorldCapture {
  scene: Scene; sky: SkyRig; forest: Forest;
  terrain: Pick<Terrain, 'mesh' | 'punch'>; physics: Physics; registry: WorldRegistry;
}
/** The CLI owns the inert DOM/fetch environment and a fresh sky. Geometry capture requires production terrain. */
export interface AuthoredWorldOptions {
  root: string; sky: SkyRig; element: () => HTMLElement;
  /** Original WSTR payload; selected and installed before any terrain/forest/model reads. */
  nativeTerrain?: Uint8Array;
  createTerrain?: (input: { ground: Float32Array; forest: Forest; native: BakedGrid | null }) => Pick<Terrain, 'mesh' | 'punch'> | Promise<Pick<Terrain, 'mesh' | 'punch'>>;
  visitPlacement?: ModelPlacementVisitor;
  visit?: (world: AuthoredWorldCapture) => void | Promise<void>;
}
/** Execute the same owned authored world seam as the navmesh bake, then unload after capture or rejection. */
export function visitAuthoredWorld(def: ShardManifest, options: AuthoredWorldOptions): Promise<{
  colliders: ColliderDesc[]; ground: Float32Array | null; counts: Record<string, number>;
}>;
