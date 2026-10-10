import {
  StaveBowMesh as PlatformStaveBowMesh, arrowGeometry as platformArrowGeometry, bowPoses as platformBowPoses, planarUv as platformPlanarUv,
  staveBowSpecimen as platformStaveBowSpecimen, staveBowView as platformStaveBowView,
  type ArrowLook as PlatformArrowLook, type GripPoseRow as PlatformGripPoseRow, type StaveBowLook as PlatformStaveBowLook,
  type StaveBowPalette as PlatformStaveBowPalette, type StaveFist as PlatformStaveFist,
} from '@wildshard/game/systems/viewmodel/staveBow';

/** A stave bow's colours (SHARD-PLATFORM M3, the viewmodel system). */
export type StaveBowPalette = PlatformStaveBowPalette;
/** An arrow as data: its length and colours. */
export type ArrowLook = PlatformArrowLook;
/** A fist on the bow. */
export type StaveFist = PlatformStaveFist;
/** A stave bow as data: proportions, bend, string, colours, arrow, fists and sleeves. */
export type StaveBowLook = PlatformStaveBowLook;
/** A grip pose as data. */
export type GripPoseRow = PlatformGripPoseRow;
/** A stave bow mesh (the instance type). */
export type StaveBowMeshView = PlatformStaveBowMesh;
/** The stave and its string (rewritten by `shape`) merged with static parts. */
export const StaveBowMesh: typeof PlatformStaveBowMesh = PlatformStaveBowMesh;
/** An arrow's geometry from its look. */
export const arrowGeometry: typeof platformArrowGeometry = platformArrowGeometry;
/** A planar uv from the vertex positions. */
export const planarUv: typeof platformPlanarUv = platformPlanarUv;
/** The braced stave with the left glove on it: a display card's geometry. */
export const staveBowSpecimen: typeof platformStaveBowSpecimen = platformStaveBowSpecimen;
/** The platform bow's view strategy for a stave bow. */
export const staveBowView: typeof platformStaveBowView = platformStaveBowView;
/** A look's grip poses as the platform's GripPose. */
export const bowPoses: typeof platformBowPoses = platformBowPoses;
