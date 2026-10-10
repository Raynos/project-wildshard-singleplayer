import {
  addInkedPair as platformAddInkedPair, dressInkedMesh as platformDressInkedMesh, loadInkedRigMaps as platformLoadInkedRigMaps,
  type InkedRigLook as PlatformInkedRigLook, type InkedRigMaps as PlatformInkedRigMaps,
} from '@wildshard/game/systems/viewmodel/inkedRig';

/** A rig's two programs: the toon body and the ink hull at a width factor. */
export type InkedRigLook = PlatformInkedRigLook;
/** A rig's part maps by name. */
export type InkedRigMaps = PlatformInkedRigMaps;
/** Dress one GLB mesh of a first-person rig as an ink hull or a toon body with its part's maps (SHARD-PLATFORM M3). */
export const dressInkedMesh: typeof platformDressInkedMesh = platformDressInkedMesh;
/** A body mesh and its ink hull over one geometry (SHARD-PLATFORM M3). */
export const addInkedPair: typeof platformAddInkedPair = platformAddInkedPair;
/** Load a rig's part map pairs by name (SHARD-PLATFORM M3). */
export const loadInkedRigMaps: typeof platformLoadInkedRigMaps = platformLoadInkedRigMaps;
