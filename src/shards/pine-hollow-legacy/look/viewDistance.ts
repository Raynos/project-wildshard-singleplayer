/**
 * G187 (Jake, 2026-10-07, `art/pine-hollow/round-36-content-cut/` board-view-distance B): on the phone, with the Pine
 * selected memory trim, every reach the content-cut board scaled is 75 % of the phone row's: the trees' hi /
 * lo / twig bands, the cabins' detail meshes, the animals' draw, eye and shadow bands, the sun's shadow reach and the
 * pickup orbs. −6.5 MB of GL on the board (the cabin detail meshes that never build); the fog already hides the reach it cuts.
 * The numbers are 0.75 × the phone tier's own (Pine's row where it sets one, else the engine's phone row, render/tiers.ts).
 */
const VIEW_B = {
  treeHiDist: 45, treeLoDist: 97.5, treeTwigDist: 18, cabinDetailDist: 52.5,
  animalHideDist: 112.5, animalShadowDist: 45, animalEyeDist: 33.75, animalOneDrawDist: 75,
  shadowFar: 45, pickupOrbDist: 90,
} as const;

/** Pine's tier rows with view distance B laid over the phone's on every phone entry */
export function pineTiers<P extends object, D extends object>(rows: { phone: P; desktop: D }): { readonly phone: P; desktop: D } {
  return {
    phone: { ...rows.phone, ...VIEW_B },
    desktop: rows.desktop,
  };
}
