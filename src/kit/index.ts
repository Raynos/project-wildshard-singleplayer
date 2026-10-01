// The shared shard kit's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; the shard rows fill it.
export const KIT_API = 1;

export { SWAP_GLYPHS } from './weapons/ui';
export { SWORD, WOODEN_SWORD, IRON_SWORD } from './weapons/equipment';

export { Melee, meleeActor, type MeleeProfile, type ViewmodelFeel } from './weapons/melee/Melee';
export { Sword, swordEvents, buildSword, swordMaterial } from './weapons/melee/SweptMelee';
export { SWORD_WOOD, SWORD_IRON } from './weapons/melee/profiles';
export { key, COMBO, HEAVY, REST, CHARGE, SPRINT } from './weapons/melee/moves';
export type { SwordWorld, SwordRig, SwordArms, SwordFraming, SwordMoveSet } from '#engine';
