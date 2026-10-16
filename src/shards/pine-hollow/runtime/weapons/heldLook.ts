// Pine Hollow's held weapons' materials as data (SHARD-PLATFORM C2): every lit part on the viewmodels' shared program
// (@wildshard/engine/combat/view/ranged viewmodelRowMaterial: MeshPhysical + vertex colours + the five map slots), a row
// per material naming the texture set its caller hands over. The names ('lever-steel' …) are the finishes' keys
// (data/weaponFinishes.ts); the crossbow's rows are generators/crossbowRows.ts (custom/crossbowPool). Each row is a ViewmodelMaterialRow (checked where it is built).

/** The lever-action (runtime/weapons/LeverRifle.ts, `lever-<id>`): the baked model's wood and steel atlases, the brass
 *  bead and cartridges on the gunmetal set tiled twice (its normals flipped in v where the atlases are). */
export const LEVER_MATERIALS = {
  brass: { set: 'gunmetal', normalScale: [0.25, 0.25], color: [0.95, 0.7, 0.34], roughness: 0.75, metalness: 1, envMapIntensity: 1.1 },
  wood: { set: 'wood', normalScale: [0.9, -0.9], roughness: 1, metalness: 1, envMapIntensity: 0.55, specularIntensity: 0.55 },
  steel: { set: 'steel', normalScale: [0.8, -0.8], roughness: 1, metalness: 1, envMapIntensity: 0.95 },
} as const;
