import { LIMB_POSE_KEYS as platformLimbPoseKeys, addLimbPose as platformAddLimbPose, applyLimbPose as platformApplyLimbPose, gaitFoot as platformGaitFoot, limbRest as platformLimbRest, newLimbPose as platformNewLimbPose, playPoseClip as platformPlayPoseClip, scaleLimbPose as platformScaleLimbPose, zeroLimbPose as platformZeroLimbPose, type LimbPose as PlatformLimbPose, type LimbPoseKey as PlatformLimbPoseKey, type LimbPoseRest as PlatformLimbPoseRest, type LimbRest as PlatformLimbRest, type LimbRigSpec as PlatformLimbRigSpec, type PoseClip as PlatformPoseClip, type PoseExpr as PlatformPoseExpr, type PoseSet as PlatformPoseSet } from '@wildshard/game/systems/species/limbRig';

/** A limb rig pose's scalar channel names. */
export type LimbPoseKey = PlatformLimbPoseKey;
/** One limb rig pose: the spine's scalars and each foot's offset and toe. */
export type LimbPose = PlatformLimbPose;
/** A shard's limb rig: its spine and limb bone names and proportions. */
export type LimbRigSpec = PlatformLimbRigSpec;
/** A limb rig's rest, readable without bones. */
export type LimbPoseRest = PlatformLimbPoseRest;
/** A limb rig's rest measured off its bones (bend planes included). */
export type LimbRest = PlatformLimbRest;
/** A clip expression: a number, a name or a call. */
export type PoseExpr = PlatformPoseExpr;
/** One channel a clip sets. */
export type PoseSet = PlatformPoseSet;
/** One limb rig clip as rows (SHARD-PLATFORM M3). */
export type PoseClip = PlatformPoseClip;
/** The pose's scalar channel names, in order. */
export const LIMB_POSE_KEYS: typeof platformLimbPoseKeys = platformLimbPoseKeys;
/** A pose at the rest. */
export const newLimbPose: typeof platformNewLimbPose = platformNewLimbPose;
/** Every channel back to the rest. */
export const zeroLimbPose: typeof platformZeroLimbPose = platformZeroLimbPose;
/** `into += p × w`. */
export const addLimbPose: typeof platformAddLimbPose = platformAddLimbPose;
/** `p × keep`. */
export const scaleLimbPose: typeof platformScaleLimbPose = platformScaleLimbPose;
/** The rig's rest, read once off its bones. */
export const limbRest: typeof platformLimbRest = platformLimbRest;
/** Solves a pose onto the bones: the spine by FK, the limbs by two-bone IK. */
export const applyLimbPose: typeof platformApplyLimbPose = platformApplyLimbPose;
/** A foot's stance / swing curve along one gait cycle. */
export const gaitFoot: typeof platformGaitFoot = platformGaitFoot;
/** Plays one clip's rows onto a pose. */
export const playPoseClip: typeof platformPlayPoseClip = platformPlayPoseClip;
