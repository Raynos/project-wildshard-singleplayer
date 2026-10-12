import type { PlaceholderSource } from '@wildshard/format/placeholderSource';

/**
 * Pine Hollow's steer for its generated near placeholder (G348: declared here, read by the generic bake): its forest is
 * drawn by its own tree model, so the bake stands each kept placement in with one of these unit-high shapes by species.
 * sRGB colours; the fir and sapling crowns are lifted (G342 polish: the round-2 firs read near-black from the road).
 */
export const PINE_PLACEHOLDER = {
  trees: [
    { species: 'fir', stem: null, rings: [[0.06, 0.24], [0.45, 0.15]], crown: [74, 114, 68] },
    { species: 'pine', stem: [0.62, 0.022, [124, 96, 76]], rings: [[0.5, 0.1], [0.74, 0.19], [0.93, 0.13]], crown: [82, 116, 62] },
    { species: 'giant', stem: [0.3, 0.035, [110, 72, 50]], rings: [[0.22, 0.2], [0.55, 0.15]], crown: [64, 100, 60] },
    { species: 'birch', stem: [0.5, 0.018, [214, 206, 192]], rings: [[0.38, 0.13], [0.7, 0.18]], crown: [132, 162, 74] },
    { species: 'sapling', stem: null, rings: [[0.05, 0.26], [0.45, 0.16]], crown: [84, 122, 66] },
    { species: 'snag', stem: [1, 0.025, [120, 110, 98]], rings: [], crown: [0, 0, 0] },
  ],
} as const satisfies PlaceholderSource;
