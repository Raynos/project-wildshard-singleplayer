import {
  FpArmsRig as PlatformFpArmsRig, armRigBake as platformArmRigBake, armRigContract as platformArmRigContract, fitFraming as platformFitFraming, prepRigGeometry as platformPrepRigGeometry, rigRoot as platformRigRoot,
  sharedRigMaps as platformSharedRigMaps, takeRigScene as platformTakeRigScene,
  type FpArmsHooks as PlatformFpArmsHooks, type FpArmsRow as PlatformFpArmsRow, type FpArmsState as PlatformFpArmsState,
  type FpCapsuleEnd as PlatformFpCapsuleEnd, type FpCapsuleRow as PlatformFpCapsuleRow, type FpMeshData as PlatformFpMeshData,
  type FpPendant as PlatformFpPendant, type MoveInfo as PlatformMoveInfo, type Timing as PlatformTiming,
} from '@wildshard/game/systems/viewmodel/fpArmsRig';

/** A first-person arm rig as data: sockets, attach points, renames, cloth colliders, holds, framing, lag, trail. */
export type FpArmsRow = PlatformFpArmsRow;
/** A capsule end: a point in a socket's space, or the socket's origin. */
export type FpCapsuleEnd = PlatformFpCapsuleEnd;
/** A pendant collider as data. */
export type FpCapsuleRow = PlatformFpCapsuleRow;
/** A move's engine timing. */
export type Timing = PlatformTiming;
/** A clip's metadata from the GLB's extras. */
export type MoveInfo = PlatformMoveInfo;
/** What the rig reads each frame: walk, step phase, look velocity, gravity. */
export type FpArmsState = PlatformFpArmsState;
/** A pendant the rig steps (a tassel, a talisman). */
export type FpPendant = PlatformFpPendant;
/** A GLB mesh's extras. */
export type FpMeshData = PlatformFpMeshData;
/** The caller's materials and living parts. */
export type FpArmsHooks = PlatformFpArmsHooks;
/** A baked first-person arm rig on two channels with pendants, a brush trail and a framing fit (SHARD-PLATFORM M3). */
export const FpArmsRig: typeof PlatformFpArmsRig = PlatformFpArmsRig;
/** A first-person arm rig (the instance type). */
export type FpArmsRigView = PlatformFpArmsRig;
/** The root scale and offset that frame weighted rest points on a camera as on the canonical one. */
export const fitFraming: typeof platformFitFraming = platformFitFraming;
/** Renames a GLB's exported custom attributes and fills the ones the rig's programs read. */
export const prepRigGeometry: typeof platformPrepRigGeometry = platformPrepRigGeometry;
/** A part's maps / normals pair, loaded once. */
export const sharedRigMaps: typeof platformSharedRigMaps = platformSharedRigMaps;
/** A rig GLB parsed once: the first taker gets the scene, later ones a skeleton clone. */
export const takeRigScene: typeof platformTakeRigScene = platformTakeRigScene;
/** The GLB's vm_root moved into a fresh group keeping its extras. */
export const rigRoot: typeof platformRigRoot = platformRigRoot;
/** An arm rig's contract over the shared arm clip aliases. */
export const armRigContract: typeof platformArmRigContract = platformArmRigContract;
/** An arm rig's bake over the shared arm clip aliases, its joints per side. */
export const armRigBake: typeof platformArmRigBake = platformArmRigBake;
