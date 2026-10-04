import type { RGB } from '@wildshard/engine/entities/species/loft';

export const DEER_PALETTE = {   // exported: pineCoats.ts recolours the rigged hull per variant from it
  // autumn coat: ~#7a5a3c body, greyer neck/legs, cream belly + throat, pale rump patch with a dark tail stripe
  body: [0.40, 0.335, 0.265], bodyDark: [0.30, 0.25, 0.20], grey: [0.38, 0.34, 0.30], greyDark: [0.29, 0.255, 0.22],
  belly: [0.68, 0.62, 0.52], cream: [0.74, 0.68, 0.56], rump: [0.62, 0.57, 0.47],
  legDark: [0.30, 0.25, 0.20], nose: [0.06, 0.05, 0.05], muzzle: [0.28, 0.24, 0.21], eyeRing: [0.20, 0.16, 0.13], earIn: [0.62, 0.56, 0.48],
  antler: [0.40, 0.31, 0.22], antlerTip: [0.74, 0.68, 0.58], hoof: [0.10, 0.08, 0.07], eye: [0.02, 0.015, 0.01],
} satisfies Record<string, RGB>;
export const ELK_PALETTE = {   // exported: pineCoats.ts recolours the rigged hull per variant from it
  // pale tan barrel, dark chocolate neck + legs + belly, straw-cream rump patch, near-black mane
  body: [0.47, 0.37, 0.25], bodyDark: [0.35, 0.27, 0.18],
  neck: [0.19, 0.125, 0.08], mane: [0.11, 0.075, 0.05], belly: [0.26, 0.20, 0.14], rump: [0.82, 0.76, 0.62],
  legDark: [0.26, 0.19, 0.135], nose: [0.05, 0.04, 0.04], muzzle: [0.24, 0.19, 0.16], eyeRing: [0.16, 0.12, 0.10], earIn: [0.60, 0.53, 0.45],
  antler: [0.42, 0.32, 0.22], antlerTip: [0.80, 0.74, 0.62], hoof: [0.09, 0.075, 0.065], eye: [0.02, 0.015, 0.01],
} satisfies Record<string, RGB>;
