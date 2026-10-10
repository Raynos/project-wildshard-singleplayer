import type { RiggedHullsRow } from '@wildshard/sdk/species/riggedHullRows';

/**
 * Pine Hollow's generated creature hulls as a rigged-hull row (`@wildshard/sdk/species/riggedHulls`; PINE-HOLLOW-REMASTER
 * PH-M1 / PH-M2, Jake's PH-U11): each photoreal TRELLIS.2 / Hunyuan3D-2 hull (art/pine-hollow/round-9-creature-refs/)
 * fitted to its species' skeleton by `scripts/creature-rig-bake.mjs --chunk pine-hollow`, worn by every variant listed
 * here in its own coat. The Antler King (PH-M3, board B2 pick A "the Bark Warden") wears his own hull on his own upright
 * rig (E322 F-M1, combat/kingRig.ts), its source his one variant, so his coat is never recoloured.
 *
 * E322 F-M2 (Jake picked B), the bears fixed: both bear hulls came back with a ~25 cm lobe of fur hanging off the top of the
 * rump like a dog's tail (the generator's, not a bear's); `flaps` presses it onto the rump's back plane, read off a slice
 * profile of each rig's mesh (art/pine-hollow/round-19-e322-bears-birds/; the same numbers serve both tiers). The brown
 * hull's three tones are measured off its atlas and mapped onto real brown-bear tones (`measured`: a grizzly's deep brown
 * legs, mid-brown body, blond guard-hair tips; the Grizzled Sow darker with silver tips over her hump), and the sheen and
 * rim take the coat's own hue (`fur`) instead of a pale pink-white.
 */
export const PINE_HULLS: RiggedHullsRow = {
  label: 'pine-hollow',
  rigs: ['deer-hind', 'deer-stag', 'boar', 'elk-cow', 'elk-bull', 'bear-black', 'bear-brown', 'antler-king-rig'],
  hulls: {
    'deer:hind': 'deer-hind', 'deer:white-hind': 'deer-hind', 'deer:piebald': 'deer-hind',
    'deer:stag': 'deer-stag', 'deer:white-stag': 'deer-stag', 'deer:big-stag': 'deer-stag', 'deer:ghost': 'deer-stag',
    'boar:boar': 'boar', 'boar:sow': 'boar', 'boar:black': 'boar', 'boar:big': 'boar', 'boar:scarback': 'boar', 'boar:ironhide': 'boar', 'boar:thrall': 'boar',
    'elk:cow': 'elk-cow', 'elk:pale': 'elk-cow',
    'elk:bull': 'elk-bull', 'elk:big-bull': 'elk-bull', 'elk:imperial': 'elk-bull', 'elk:thrall': 'elk-bull',
    'bear:black': 'bear-black', 'bear:black-blaze': 'bear-black', 'bear:black-old': 'bear-black',
    'bear:brown': 'bear-brown', 'bear:brown-old': 'bear-brown',
    'antler-king:warden': 'antler-king-rig',
  },
  coats: {
    'deer-hind': { palette: 'deer', source: ['deer', 'hind'], keys: ['bodyDark', 'body', 'belly'] },
    'deer-stag': { palette: 'deer', source: ['deer', 'stag'], keys: ['bodyDark', 'body', 'belly'] },
    boar: { palette: 'boar', source: ['boar', 'boar'], keys: ['dark', 'base', 'grizzle'] },
    'elk-cow': { palette: 'elk', source: ['elk', 'cow'], keys: ['neck', 'body', 'rump'] },
    'elk-bull': { palette: 'elk', source: ['elk', 'bull'], keys: ['neck', 'body', 'rump'] },
    'bear-black': { palette: 'bear', source: ['bear', 'black'], keys: ['dark', 'base', 'tip'] },
    'bear-brown': {
      palette: 'bear', source: ['bear', 'brown'], keys: ['dark', 'base', 'tip'],
      measured: {
        brown: { dark: [0.17, 0.115, 0.08], base: [0.40, 0.28, 0.185], tip: [0.64, 0.51, 0.37] },
        'brown-old': { dark: [0.14, 0.10, 0.07], base: [0.34, 0.25, 0.17], tip: [0.58, 0.50, 0.40], grizzle: [0.70, 0.67, 0.61] },
      },
    },
    'antler-king-rig': { palette: 'elk', source: ['antler-king', 'warden'], keys: ['neck', 'body', 'rump'] },
  },
  flaps: {
    'bear-brown': { yMin: 0.46, y0: 0.47, z0: -0.5, slope: -0.08, keep: 0.08, bulge: 0.05 },
    'bear-black': { yMin: 0.46, y0: 0.47, z0: -0.025, slope: 0.08, keep: 0.08, bulge: 0.035 },
  },
  fur: {
    'bear-brown': {
      brown: { rim: [0.8, 0.6, 0.36], sheenColor: [0.3, 0.22, 0.13] },
      'brown-old': { rim: [0.78, 0.7, 0.58], sheenColor: [0.34, 0.3, 0.25] },
    },
  },
};
