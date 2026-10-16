// Pine Hollow's held weapons' materials as data (SHARD-PLATFORM C2): every lit part on the viewmodels' shared program
// (@wildshard/engine/combat/view/ranged viewmodelRowMaterial: MeshPhysical + vertex colours + the five map slots), a row
// per material naming the texture set its caller hands over. The names ('xbow-wood' …, 'lever-steel' …) are the finishes'
// keys (./weaponFinishes.ts). Each row is a ViewmodelMaterialRow (checked where it is built).

/**
 * The crossbow (runtime/weapons/crossbow/Crossbow.ts, `xbow-<id>`): the walnut stock (a low specularIntensity kills the
 * grazing sunset sheen on the rail), the brushed-steel iron, prod and brass, the leather wrap, the hemp cord (its 1×1
 * filler ARM: ao 1, roughness 1, metal 0), the dark-iron rear peep with a faint cyan glow, and the bolt (its atlas,
 * alpha-tested fletching; one DoubleSide pass: the viewmodel makes it transparent, and three draws a transparent
 * DoubleSide material as a BackSide + a FrontSide pass, two programs; the bolt writes depth, so one looks the same).
 * Physical at its defaults (ior 1.5, specularIntensity 1) is Standard's F0 0.04, so every part shares the stock's
 * program; the prod keeps its own (anisotropy is a define: the hero-weapon sheen) and the bolt its own (alpha test).
 */
export const CROSSBOW_MATERIALS = {
  wood: { set: 'walnut', normalScale: [0.75, 0.75], roughness: 1, metalness: 0, envMapIntensity: 0.45, specularIntensity: 0.3 },
  iron: { set: 'steel', normalScale: [0.7, 0.7], roughness: 1.5, metalness: 1, color: [0.24, 0.23, 0.23], envMapIntensity: 0.6 },
  prod: { set: 'steel', normalScale: [0.6, 0.6], roughness: 1.25, metalness: 1, color: [0.55, 0.55, 0.57], anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 0.7 },
  leather: { set: 'leather', roughness: 1, metalness: 0, envMapIntensity: 0.5 },
  cord: { set: 'cord', roughness: 0.85, metalness: 0 },
  brass: { set: 'steel', normalScale: [0.3, 0.3], roughness: 1.1, metalness: 1, color: [0.95, 0.66, 0.3], envMapIntensity: 1.0 },
  peep: { color: [0.05, 0.05, 0.055], roughness: 0.9, metalness: 0.75, emissive: 0x8fe3ff, emissiveIntensity: 0.05 },
  bolt: { set: 'bolt', roughness: 1, metalness: 1, alphaTest: 0.5, vertexColors: false, forceSinglePass: true },
} as const;
/** The crossbow's texture tiling: the walnut along the stock, the steel twice each way. */
export const CROSSBOW_TILING = { walnut: [1, 4], steel: [2, 2] } as const;

/** The lever-action (runtime/weapons/LeverRifle.ts, `lever-<id>`): the baked model's wood and steel atlases, the brass
 *  bead and cartridges on the gunmetal set tiled twice (its normals flipped in v where the atlases are). */
export const LEVER_MATERIALS = {
  brass: { set: 'gunmetal', normalScale: [0.25, 0.25], color: [0.95, 0.7, 0.34], roughness: 0.75, metalness: 1, envMapIntensity: 1.1 },
  wood: { set: 'wood', normalScale: [0.9, -0.9], roughness: 1, metalness: 1, envMapIntensity: 0.55, specularIntensity: 0.55 },
  steel: { set: 'steel', normalScale: [0.8, -0.8], roughness: 1, metalness: 1, envMapIntensity: 0.95 },
} as const;
