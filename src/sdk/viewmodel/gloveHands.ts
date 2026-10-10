import {
  COAT_FROM as platformCoatFrom, WeaponHands as PlatformWeaponHands, blendGrip as platformBlendGrip, coatMaterialParams as platformCoatMaterialParams,
  coatSleeve as platformCoatSleeve, coatTextures as platformCoatTextures, gloveGauntlet as platformGloveGauntlet, gloveSleeve as platformGloveSleeve,
  gripPose as platformGripPose, gripQuat as platformGripQuat, handGeometry as platformHandGeometry, holdDef as platformHoldDef, withArmPalette as platformWithArmPalette,
  type ArmPaletteKey as PlatformArmPaletteKey, type ArmPaletteRow as PlatformArmPaletteRow, type CoatTex as PlatformCoatTex, type GloveHandsLook as PlatformGloveHandsLook,
  type GripPose as PlatformGripPose, type HandDef as PlatformHandDef, type HandGeometry as PlatformHandGeometry, type HandHold as PlatformHandHold,
  type HandSpec as PlatformHandSpec, type V3 as PlatformV3,
} from '@wildshard/game/systems/viewmodel/gloveHands';

/** A palette key of the engine's arm builder (SHARD-PLATFORM M3, the viewmodel system). */
export type ArmPaletteKey = PlatformArmPaletteKey;
/** A palette row over the arm builder's: each key's colour as sRGB hex. */
export type ArmPaletteRow = PlatformArmPaletteRow;
/** A shard's gloved hands as data: the arm palette, the coat cuff's lip and stitches. */
export type GloveHandsLook = PlatformGloveHandsLook;
/** The coat's waxed-canvas maps. */
export type CoatTex = PlatformCoatTex;
/** A per-channel triple. */
export type V3 = PlatformV3;
/** One hand as data: the fist's grip, curl and wrist, its forearm and its tints. */
export type HandSpec = PlatformHandSpec;
/** A hand's geometry: the fist (and its merged forearm) or the fist and a separate sleeve. */
export type HandGeometry = PlatformHandGeometry;
/** Where a fist closes on a weapon, in its model space. */
export type GripPose = PlatformGripPose;
/** A hand's spec and where it grips. */
export type HandDef = PlatformHandDef;
/** A hold as a weapon declares it. */
export type HandHold = PlatformHandHold;
/** A weapon's two gloved hands under its model (the instance type). */
export type WeaponHandsView = PlatformWeaponHands;
/** Build with a palette row over the arm builder's palette, then restore it. */
export const withArmPalette: typeof platformWithArmPalette = platformWithArmPalette;
/** The forearm: a gauntlet, a knit cuff and a canvas sleeve, in the current arm palette. */
export const gloveSleeve: typeof platformGloveSleeve = platformGloveSleeve;
/** The glove's gauntlet alone, in the current arm palette. */
export const gloveGauntlet: typeof platformGloveGauntlet = platformGloveGauntlet;
/** Where the coat's cuff starts past the glove's wrist (m). */
export const COAT_FROM: typeof platformCoatFrom = platformCoatFrom;
/** The coat sleeve with its turned-back cuff, uv'd for the canvas maps. */
export const coatSleeve: typeof platformCoatSleeve = platformCoatSleeve;
/** The coat's waxed-canvas maps, drawn once and cached until disposed. */
export const coatTextures: typeof platformCoatTextures = platformCoatTextures;
/** The coat sleeve's material parameters. */
export const coatMaterialParams: typeof platformCoatMaterialParams = platformCoatMaterialParams;
/** One hand's geometry in a look's colours. */
export const handGeometry: typeof platformHandGeometry = platformHandGeometry;
/** A grip pose from three triples. */
export const gripPose: typeof platformGripPose = platformGripPose;
/** Grip space → the weapon's model space. */
export const gripQuat: typeof platformGripQuat = platformGripQuat;
/** Blend two grip poses. */
export const blendGrip: typeof platformBlendGrip = platformBlendGrip;
/** A declared hold → a hand definition. */
export const holdDef: typeof platformHoldDef = platformHoldDef;
/** A weapon's two gloved hands under its model: two draws, the right posed every frame (SHARD-PLATFORM M3). */
export const WeaponHands: typeof PlatformWeaponHands = PlatformWeaponHands;
