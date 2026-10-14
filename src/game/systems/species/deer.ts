// The red deer's rows (moved from the engine's species folder, E405 LAYER-PURITY; out of the kit, SF54). Only Pine Hollow
// spawns it, on its rigged hulls (src/shards/pine-hollow/species/looks.ts registers the row and look); its procedural lofts
// are Pine's offline rig input (src/shards/pine-hollow/generators/creatureLofts.ts, sp-o194).
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import type { RGB } from '@wildshard/engine/level/data';

/**
 * Deer — red-deer proportions: 0.92 m at the spine, long neck, stags carry a 6-point rack.
 *
 * Variants (traits read by the lofts and the coats): antlers (0/1), antlerScale, piebald (0/1 white patches).
 * Tint keys (VariantDef.tint): body bodyDark grey greyDark belly cream rump legDark nose muzzle eyeRing
 * earIn antler antlerTip hoof eye.
 */

/** pale cream coat, pink nose / ear linings, pale hooves and antlers (leucistic) */
const WHITE_TINT: Record<string, RGB> = {
  body: [0.86, 0.83, 0.76], bodyDark: [0.74, 0.71, 0.64], grey: [0.84, 0.82, 0.77], greyDark: [0.76, 0.74, 0.69],
  belly: [0.94, 0.92, 0.87], cream: [0.95, 0.93, 0.88], rump: [0.93, 0.91, 0.86],
  legDark: [0.74, 0.71, 0.65], nose: [0.62, 0.40, 0.42], muzzle: [0.82, 0.74, 0.72], eyeRing: [0.74, 0.66, 0.64], earIn: [0.88, 0.72, 0.72],
  antler: [0.70, 0.64, 0.56], antlerTip: [0.90, 0.88, 0.82], hoof: [0.42, 0.38, 0.34],
};

/** the Ghost stag: white with a cold blue cast; the glow is in the fur override */
const GHOST_TINT: Record<string, RGB> = {
  ...WHITE_TINT,
  body: [0.84, 0.88, 0.92], bodyDark: [0.70, 0.76, 0.82], grey: [0.82, 0.87, 0.92], greyDark: [0.72, 0.78, 0.84],
  belly: [0.94, 0.96, 0.98], cream: [0.95, 0.97, 0.99], rump: [0.93, 0.95, 0.98],
  legDark: [0.70, 0.76, 0.82], nose: [0.50, 0.44, 0.52], antler: [0.78, 0.82, 0.86], antlerTip: [0.96, 0.98, 1.0],
};


/** The deer's rows and look fields; the body (`build`) is the look's (Pine: the baked hull body, species/bodies.ts). */
export const DEER: Omit<SpeciesDef, 'build'> = {
  rigContract: { skeleton: 'quadruped.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'deer',
  trampleRadius: 0.5,
  label: 'Deer',
  fur: {
    texSeed: 101, tex: { contrast: 0.8, grizzle: 0.15, normalStrength: 1.6, bristle: 0, strandLen: 24, root: 0.14 },
    roughness: 0.82, sheen: 0.3, sheenColor: [0.45, 0.36, 0.26], envMapIntensity: 0.6, rim: [1.0, 0.72, 0.42], shellLen: 0.05, shag: 0.005,
  },
  aggressive: false,
  walkSpeed: 1.3,
  sounds: { call: 'deer_call', hurt: 'deer_call' },
  pose: { grazeNeck: 1, gallopTail: 1 },
  // weights sum to 96: hind 48 % · stag 31 % · white 8.3 % · big stag 8.3 % · piebald 3.1 % · ghost 1.0 %
  variants: [
    { id: 'hind', label: 'Hind', weight: 46, rarity: 'common', scale: [0.9, 1.05] },
    { id: 'stag', label: 'Stag', weight: 30, rarity: 'common', scale: [1.0, 1.1], traits: { antlers: 1 } },
    { id: 'white-hind', label: 'White hind', weight: 4, rarity: 'uncommon', scale: [0.9, 1.05], tint: WHITE_TINT },
    { id: 'white-stag', label: 'White stag', weight: 4, rarity: 'uncommon', scale: [1.0, 1.1], tint: WHITE_TINT, traits: { antlers: 1 } },
    { id: 'big-stag', label: 'Great stag', weight: 8, rarity: 'uncommon', scale: [1.2, 1.3], hp: 90, traits: { antlers: 1, antlerScale: 1.25 } },
    { id: 'piebald', label: 'Piebald hind', weight: 3, rarity: 'rare', scale: [0.95, 1.1], traits: { piebald: 1 } },
    {
      id: 'ghost', label: 'Ghost stag', weight: 1, rarity: 'legendary', scale: [1.35, 1.35], hp: 130,
      tint: GHOST_TINT, traits: { antlers: 1, antlerScale: 1.35 },
      // pale-cyan backlit rim + a faint self-glow so it reads at dusk; flees faster than anything you can sprint after
      fur: { rim: [0.55, 0.92, 1.0], emissive: [0.30, 0.62, 0.75], emissiveIntensity: 0.16, sheenColor: [0.6, 0.8, 0.9] },
      mods: { speed: 1.25 },
    },
  ],
};
