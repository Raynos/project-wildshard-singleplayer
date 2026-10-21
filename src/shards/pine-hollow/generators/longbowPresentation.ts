// Pine Hollow's Longbow in first person as data (the held bow draw, @wildshard/game/weapons/heldLauncher): its materials and
// grip poses. The stave's look and arrow are the bake's (generators/longbowLook.ts).

/** The Longbow's material (the viewmodels' shared lit program): waxed yew, leather, linen. */
export const LONGBOW_MATERIAL = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };
/** The arrows' material (the viewmodels' shared lit program, vertex colours × the 1×1 fillers): ash, sinew, feathers. */
export const ARROW_MATERIAL = { roughness: 0.7, metalness: 0 };
/* Poses in rig space (camera space / VM_SCALE), the starter bow's, re-seated for a bow twice as tall: rest = lowered and
 * canted across the body; drawn = the fist right of centre, the stave canted, the arrow converging on the crosshair ~6 m out. */
/** The Longbow's grip poses. */
type Triple = readonly [number, number, number];
export const LONGBOW_POSES: Record<'rest' | 'drawn' | 'restPort' | 'drawnPort' | 'aim' | 'aimPort', { readonly pos: Triple; readonly aim: Triple; readonly cant: number; readonly pitch: number }> = {
  rest: { pos: [0.32, -0.46, -0.9], aim: [-0.1, 0.25, -4], cant: -0.78, pitch: -0.16 },
  drawn: { pos: [0.2, -0.17, -1.12], aim: [0, 0, -5.5], cant: -0.3, pitch: 0 },
  restPort: { pos: [0.16, -0.52, -0.92], aim: [-0.05, 0.12, -4], cant: -0.62, pitch: -0.14 },
  drawnPort: { pos: [0.07, -0.1, -1.08], aim: [0, 0, -5.5], cant: -0.24, pitch: 0 },
  aim: { pos: [0.1, -0.22, -1.15], aim: [0.02, -0.052, -7], cant: -0.22, pitch: 0 },
  aimPort: { pos: [0.04, -0.19, -1.15], aim: [0.02, -0.052, -8], cant: -0.16, pitch: 0 },
};
