/** Explicit alternative to the rejected thrown/drooping corpse.
 * One fixed compound retains the exact lethal pose and remains a real obstacle
 * until the bout is disposed. No folding animation or physics-quality claim.
 */
export const BRINE_PITCHER_ROOTED_NATIVE_SELECTION = {
  poseFile: 'poses/brine-pitcher-native-owner.json', corpse: 'anchored-held',
} as const;
export const BRINE_PITCHER_ROOTED_NATIVE_LABEL = 'Brine Pitcher WIP: rooted, held death (no fold)';

/** Separate unadmitted body-only candidate. The six head/lid hulls still need genuine lethal-contact tests. */
export const BRINE_PITCHER_CONVEX_NATIVE_SELECTION = {
  ...BRINE_PITCHER_ROOTED_NATIVE_SELECTION, livingBodyBone: 'body',
} as const;
