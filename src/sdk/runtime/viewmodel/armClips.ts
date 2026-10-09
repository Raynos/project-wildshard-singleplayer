import {
  ARM_CLIPS as PLATFORM_ARM_CLIPS, SWIM_CLIPS as PLATFORM_SWIM_CLIPS, armClipNames as platformArmClipNames,
} from '@wildshard/game/systems/viewmodel/armClips';

/** Engine clip names mapped to the authored arm rigs' track names (metadata only; source tracks stay byte-identical). */
export const ARM_CLIPS: typeof PLATFORM_ARM_CLIPS = PLATFORM_ARM_CLIPS;
/** The swim stroke and tread aliases of an arm rig with swim clips. */
export const SWIM_CLIPS: typeof PLATFORM_SWIM_CLIPS = PLATFORM_SWIM_CLIPS;
/** The engine clip names an alias table declares, for a rig contract. */
export const armClipNames: typeof platformArmClipNames = platformArmClipNames;
