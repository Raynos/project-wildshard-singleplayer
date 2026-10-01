// The shared shard kit's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; the shard rows fill it.
export const KIT_API = 1;

export { SWAP_GLYPHS } from './weapons/ui';
export { SWORD, WOODEN_SWORD, IRON_SWORD } from './weapons/equipment';

export { Melee, meleeActor, type MeleeProfile, type ViewmodelFeel } from './weapons/melee/Melee';
export { Sword, swordEvents, buildSword, swordMaterial } from './weapons/melee/SweptMelee';
export { SWORD_WOOD, SWORD_IRON } from './weapons/melee/profiles';
export { key, COMBO, HEAVY, REST, CHARGE, SPRINT } from './weapons/melee/moves';
export type { SwordWorld, SwordRig, SwordArms, SwordFraming, SwordMoveSet } from '#engine';

export { Thrown, type ThrownProfile } from './weapons/thrown/Thrown';

export { Bow, type BowWorld, type BowOptions } from './weapons/bow/family';
export { BOW } from './weapons/bow/profiles';
export type { BowProfile, BowStyle, BowView, GripPose } from './weapons/bow/profile';
export { ARROW_LEN, POSE, VM_SHADE, buildArrowGeometry, arrowKind, arrowMaterial, bowSpecimen } from './weapons/bow/recurve';
export { QUIVER_MAX, AIM_ZOOM, AIM_VM_ZOOM, AIM_SWAY, AIM_SPREAD, AIM_IN } from './weapons/bow/index';
export { Crossbow, PLAIN_BOLT, MAX_BOLTS, buildCrossbow, buildBolt, boltFlightStep, type BoltMod } from './weapons/crossbow/Crossbow';
export { CROSSBOW_PROFILE, type CrossbowProfile } from './weapons/crossbow/profiles';
export { Firearm } from './weapons/firearm/Firearm';
export { AR15, type FirearmProfile } from './weapons/firearm/profiles';
export { Rifle, buildRifleParts, type RifleParts, type RifleOptions } from './weapons/firearm/Rifle';
export { rainCurtain, type RainProgram, type RainCurtainSpec } from './weather/rainCurtain';
export { fogGLSL } from './looks/fogProgram';

export { BUCKSKIN, HANDS_MATERIAL, WeaponHands, coatMaterialParams, holdDef, withHunterPalette, blendGrip, gripPose, type HandHold } from './viewmodel/hunterHands';

export { loadParticles } from './lookApi';
export type { Particles } from './looks/particles';

export { STARTER_EFFECTS, STARTER_CHOICES, starterId, type StarterChoice } from './effects/starter';
export { installStarterEffects } from './effects/install';

export { crossbowDisplayModel } from './weapons/crossbow/display';

export { rigLegs, legRigOf, legBones, legPose, footPlan, LEG_BONE_NAMES, WALK, type LegBuilt, type NpcRigProfile } from './npc/npcRig';

export { BOAR, BOAR_TUNING } from './species/boar';
export { BEAR, BEAR_TUNING } from './species/bear';
export { BOAR_LOOK, BOAR_PALETTE } from './species/view/boar';
export { BEAR_LOOK, BEAR_PALETTE } from './species/view/bear';
export { installKitSpecies } from './species/install';

export { fitNpcFigure, mergeNpcFigures, type NpcFigureFrame, type NpcFigureBones, type NpcFigureRig } from './npc/figureRig';
export { stepNpcFigure, npcFigurePose, type NpcFigureState, type NpcFigureMotionProfile } from './npc/figureMotion';
