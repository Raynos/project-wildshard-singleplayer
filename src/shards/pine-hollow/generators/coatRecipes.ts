/** Pine's coat author inputs. Numeric palettes and pixel-affecting variant traits retain shipping values;
 * no body, look registry or renderer is imported during authoring. */
import type { RGB, CoatVariant } from './coatPixels';

const deerDEER_PALETTE: Readonly<Record<string, RGB>> = {
    // autumn coat: ~#7a5a3c body, greyer neck/legs, cream belly + throat, pale rump patch with a dark tail stripe
    body: [0.40, 0.335, 0.265], bodyDark: [0.30, 0.25, 0.20], grey: [0.38, 0.34, 0.30], greyDark: [0.29, 0.255, 0.22],
    belly: [0.68, 0.62, 0.52], cream: [0.74, 0.68, 0.56], rump: [0.62, 0.57, 0.47],
    legDark: [0.30, 0.25, 0.20], nose: [0.06, 0.05, 0.05], muzzle: [0.28, 0.24, 0.21], eyeRing: [0.20, 0.16, 0.13], earIn: [0.62, 0.56, 0.48],
    antler: [0.40, 0.31, 0.22], antlerTip: [0.74, 0.68, 0.58], hoof: [0.10, 0.08, 0.07], eye: [0.02, 0.015, 0.01],
};
const deerWHITE_TINT: Readonly<Record<string, RGB>> = {
    body: [0.86, 0.83, 0.76], bodyDark: [0.74, 0.71, 0.64], grey: [0.84, 0.82, 0.77], greyDark: [0.76, 0.74, 0.69],
    belly: [0.94, 0.92, 0.87], cream: [0.95, 0.93, 0.88], rump: [0.93, 0.91, 0.86],
    legDark: [0.74, 0.71, 0.65], nose: [0.62, 0.40, 0.42], muzzle: [0.82, 0.74, 0.72], eyeRing: [0.74, 0.66, 0.64], earIn: [0.88, 0.72, 0.72],
    antler: [0.70, 0.64, 0.56], antlerTip: [0.90, 0.88, 0.82], hoof: [0.42, 0.38, 0.34],
};
const deerGHOST_TINT: Readonly<Record<string, RGB>> = {
    ...deerWHITE_TINT,
    body: [0.84, 0.88, 0.92], bodyDark: [0.70, 0.76, 0.82], grey: [0.82, 0.87, 0.92], greyDark: [0.72, 0.78, 0.84],
    belly: [0.94, 0.96, 0.98], cream: [0.95, 0.97, 0.99], rump: [0.93, 0.95, 0.98],
    legDark: [0.70, 0.76, 0.82], nose: [0.50, 0.44, 0.52], antler: [0.78, 0.82, 0.86], antlerTip: [0.96, 0.98, 1.0],
};

const deerVariants: readonly CoatVariant[] = [
{
    id: 'hind'
},
{
    id: 'stag', traits: { antlers: 1 }
},
{
    id: 'white-hind', tint: deerWHITE_TINT
},
{
    id: 'white-stag', tint: deerWHITE_TINT, traits: { antlers: 1 }
},
{
    id: 'big-stag', traits: { antlers: 1, antlerScale: 1.25 }
},
{
    id: 'piebald', traits: { piebald: 1 }
},
{
    id: 'ghost',
    tint: deerGHOST_TINT, traits: { antlers: 1, antlerScale: 1.35 }
}
];

const elkELK_PALETTE: Readonly<Record<string, RGB>> = {
    // pale tan barrel, dark chocolate neck + legs + belly, straw-cream rump patch, near-black mane
    body: [0.47, 0.37, 0.25], bodyDark: [0.35, 0.27, 0.18],
    neck: [0.19, 0.125, 0.08], mane: [0.11, 0.075, 0.05], belly: [0.26, 0.20, 0.14], rump: [0.82, 0.76, 0.62],
    legDark: [0.26, 0.19, 0.135], nose: [0.05, 0.04, 0.04], muzzle: [0.24, 0.19, 0.16], eyeRing: [0.16, 0.12, 0.10], earIn: [0.60, 0.53, 0.45],
    antler: [0.42, 0.32, 0.22], antlerTip: [0.80, 0.74, 0.62], hoof: [0.09, 0.075, 0.065], eye: [0.02, 0.015, 0.01],
};
const elkPALE_TINT: Readonly<Record<string, RGB>> = {
    body: [0.88, 0.85, 0.78], bodyDark: [0.78, 0.74, 0.66],
    neck: [0.72, 0.66, 0.58], mane: [0.60, 0.54, 0.47], belly: [0.80, 0.76, 0.70], rump: [0.95, 0.93, 0.88],
    legDark: [0.72, 0.67, 0.60], nose: [0.55, 0.40, 0.40], muzzle: [0.80, 0.74, 0.70], eyeRing: [0.72, 0.64, 0.60], earIn: [0.88, 0.76, 0.74],
    antler: [0.70, 0.64, 0.56], antlerTip: [0.92, 0.90, 0.84], hoof: [0.40, 0.36, 0.32],
};
const elkIMPERIAL_TINT: Readonly<Record<string, RGB>> = {
    body: [0.52, 0.40, 0.24], bodyDark: [0.40, 0.30, 0.17],
    neck: [0.22, 0.15, 0.09], mane: [0.14, 0.10, 0.07], belly: [0.28, 0.21, 0.14], rump: [0.92, 0.84, 0.62],
    antler: [0.52, 0.40, 0.24], antlerTip: [0.94, 0.86, 0.64],
};

const elkVariants: readonly CoatVariant[] = [
{
    id: 'cow'
},
{
    id: 'bull', traits: { antlers: 1 }
},
{
    id: 'big-bull', traits: { antlers: 1, antlerScale: 1.2 }
},
{
    id: 'pale', tint: elkPALE_TINT
},
{
    id: 'imperial',
    tint: elkIMPERIAL_TINT, traits: { antlers: 1, antlerScale: 1.4 }
}
];

const boarBOAR_PALETTE: Readonly<Record<string, RGB>> = {
    // dark grey-brown with grizzled pale bristle tips along the spine, pale tusks
    base: [0.36, 0.29, 0.225], grizzle: [0.58, 0.50, 0.40], dark: [0.16, 0.13, 0.10], black: [0.06, 0.05, 0.045],
    snout: [0.16, 0.09, 0.08], tusk: [0.90, 0.86, 0.74], hoof: [0.09, 0.075, 0.065], eye: [0.02, 0.015, 0.01], cheek: [0.40, 0.36, 0.30],
    scar: [0.80, 0.62, 0.56], // bare, healed hide
};
const boarBLACK_TINT: Readonly<Record<string, RGB>> = {
    base: [0.10, 0.09, 0.085], grizzle: [0.24, 0.22, 0.20], dark: [0.05, 0.045, 0.04], black: [0.03, 0.03, 0.03], cheek: [0.17, 0.15, 0.13], snout: [0.10, 0.07, 0.07],
};
const boarSCARBACK_TINT: Readonly<Record<string, RGB>> = {
    base: [0.34, 0.31, 0.27], grizzle: [0.60, 0.56, 0.50], dark: [0.15, 0.135, 0.12], cheek: [0.46, 0.43, 0.38], tusk: [0.86, 0.80, 0.66],
};
const boarIRONHIDE_TINT: Readonly<Record<string, RGB>> = {
    base: [0.28, 0.29, 0.31], grizzle: [0.52, 0.54, 0.56], dark: [0.12, 0.125, 0.14], black: [0.05, 0.05, 0.06], cheek: [0.40, 0.41, 0.42],
    snout: [0.12, 0.10, 0.10], tusk: [0.80, 0.78, 0.70], hoof: [0.08, 0.08, 0.085],
};

const boarVariants: readonly CoatVariant[] = [
{ id: "sow", traits: { tuskScale: 0.6 } },
{ id: "black", tint: boarBLACK_TINT, traits: { tuskScale: 1.6 } },
{ id: "big", traits: { tuskScale: 1.3 } },
{ id: "scarback", tint: boarSCARBACK_TINT, traits: { tuskScale: 1.8, scar: 1 } },
{ id: "ironhide", tint: boarIRONHIDE_TINT, traits: { tuskScale: 2.2 } }
];

const bearBEAR_PALETTE: Readonly<Record<string, RGB>> = {
    // black bear: near-black coat with a warm brown cast in the light, tan muzzle
    base: [0.075, 0.062, 0.055], tip: [0.20, 0.16, 0.13], dark: [0.035, 0.03, 0.028],
    muzzle: [0.40, 0.29, 0.19], blaze: [0.82, 0.74, 0.58], nose: [0.04, 0.035, 0.035],
    claw: [0.12, 0.10, 0.085], eye: [0.02, 0.015, 0.01], pad: [0.10, 0.08, 0.07],
};
const bearBROWN_TINT: Readonly<Record<string, RGB>> = {
    base: [0.36, 0.25, 0.155], tip: [0.68, 0.56, 0.40], dark: [0.16, 0.115, 0.08],
    muzzle: [0.50, 0.40, 0.29], nose: [0.06, 0.045, 0.04], claw: [0.55, 0.48, 0.38], pad: [0.16, 0.12, 0.10],
};
const bearGRIZZLED_TINT: Readonly<Record<string, RGB>> = {
    base: [0.38, 0.30, 0.22], tip: [0.78, 0.72, 0.62], dark: [0.18, 0.14, 0.11],
    muzzle: [0.62, 0.56, 0.48], nose: [0.07, 0.06, 0.055], claw: [0.60, 0.54, 0.44], pad: [0.18, 0.14, 0.12],
};
const bearBLACKPAW_TINT: Readonly<Record<string, RGB>> = {
    base: [0.06, 0.05, 0.045], tip: [0.26, 0.17, 0.11], dark: [0.028, 0.025, 0.024],
    muzzle: [0.50, 0.44, 0.36], nose: [0.035, 0.03, 0.03],
};

const bearVariants: readonly CoatVariant[] = [
{ id: "black", traits: { grizzle: 0.3 } },
{ id: "black-blaze", traits: { grizzle: 0.3, blaze: 1 } },
{ id: "brown", tint: bearBROWN_TINT, traits: { hump: 1, grizzle: 0.6 } },
{ id: "black-old", tint: bearBLACKPAW_TINT, traits: { grizzle: 0.45, hump: 0.3 } },
{ id: "brown-old", tint: bearGRIZZLED_TINT, traits: { hump: 1.3, grizzle: 1.0 } }
];


/** Pixel-affecting palettes, authored independently of the live species registry. */
export const COAT_PALETTES: Readonly<Record<string, Readonly<Record<string, RGB>>>> = {
  deer: deerDEER_PALETTE, elk: elkELK_PALETTE, boar: boarBOAR_PALETTE, bear: bearBEAR_PALETTE,
};
/** Pixel-affecting variants; body geometry, scaling, brains and effects are not part of a coat. */
export const COAT_VARIANTS: Readonly<Record<string, readonly CoatVariant[]>> = {
  deer: deerVariants,
  boar: [{ id: 'boar' }, ...boarVariants, { id: 'thrall', tint: { base: [0.20, 0.19, 0.13], grizzle: [0.34, 0.36, 0.22], dark: [0.09, 0.09, 0.06], black: [0.04, 0.04, 0.03], cheek: [0.26, 0.26, 0.18] }, traits: { tuskScale: 1.4, thrall: 1 } }],
  elk: [...elkVariants, { id: 'thrall', tint: { body: [0.30, 0.28, 0.20], bodyDark: [0.20, 0.19, 0.13], neck: [0.12, 0.11, 0.07], mane: [0.08, 0.09, 0.05], belly: [0.16, 0.14, 0.10], rump: [0.42, 0.42, 0.32], legDark: [0.14, 0.12, 0.09] }, traits: { antlers: 1, thrall: 1 } }],
  bear: bearVariants,
};
/** Refuse an undeclared repaint instead of silently borrowing a species' runtime look. */
export function coatVariant(kind: string, id: string): CoatVariant {
  const variant = COAT_VARIANTS[kind]?.find(row => row.id === id);
  if (variant === undefined) throw new Error(`Missing authored coat variant ${kind}:${id}`);
  return variant;
}
