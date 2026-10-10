import { PosedInstances as PlatformPosedInstances, PosedPacker as PlatformPosedPacker, type PosedBlock as PlatformPosedBlock, type PosedInstancesLook as PlatformPosedInstancesLook } from '@wildshard/game/systems/looks/posedInstances';

/** One posable model's packed blocks (SHARD-PLATFORM M3, posed instances): its vertex arrays and local triangles. */
export type PosedBlock = PlatformPosedBlock;
/** A posed-instances look as data: the mesh's name, its patch id and key, the material and the shard's shader edits. */
export type PosedInstancesLook = PlatformPosedInstancesLook;
/** A packer instance: the shared geometry's arrays. */
export type PosedPackerView = PlatformPosedPacker;
/** A posed-instances mesh instance. */
export type PosedInstancesView = PlatformPosedInstances;
/** Packs several posable models into one geometry (position, normal, colour, pivot, two info vec4s, the index). */
export const PosedPacker: typeof PlatformPosedPacker = PlatformPosedPacker;
/** One instanced mesh of posable packed models: one draw, one program, each instance its own model and pose. */
export const PosedInstances: typeof PlatformPosedInstances = PlatformPosedInstances;
