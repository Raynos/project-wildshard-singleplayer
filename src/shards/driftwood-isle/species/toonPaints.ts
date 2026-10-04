import type { Color } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { mix, registerToonPaint, srgb, type Paint } from '@wildshard/engine/entities/species/loft';
import type { VariantDef } from '@wildshard/engine/entities/species/registry';

/**
 * The island's toon palettes for the shared procedural species (B50, moved verbatim from the engine's
 * entities/lowpoly.ts): flat pastel-saturated vertex colours, no noise, no baked AO. The engine's low-poly mode
 * (`isLowPoly()`) asks `toonPaint(kind)` before a species' PBR paint; the facet jitter, the crest spikes and the
 * materials stay the engine's.
 */

type RGB3 = [number, number, number];
const scaled = (c: RGB3, k: number, warm = 1): Color => srgb(Math.min(1, c[0] * k * warm), Math.min(1, c[1] * k), Math.min(1, c[2] * k / warm));

/**
 * Driftwood Isle boar: dark chocolate body, lighter warm back and crest, near-black legs, pink snout, ivory
 * tusks. Variant tints (black boar, Ironhide…) override `base`; the back / belly / leg shades derive from it.
 */
function boarPaintLow(v?: VariantDef): Paint {
  const t = v?.tint ?? {};
  const baseC: RGB3 = t['base'] ?? [0.40, 0.255, 0.18];
  const base = srgb(...baseC), back = scaled(baseC, 1.45, 1.04), belly = scaled(baseC, 0.66);
  const cheek = scaled(baseC, 1.32, 1.03), muzzle = scaled(baseC, 0.8);
  const leg = scaled(baseC, 0.72), legDark = scaled(baseC, 0.42), hoof = srgb(...(t['hoof'] ?? [0.14, 0.10, 0.09]));
  const crest = scaled(baseC, 1.2, 1.04), crestTip = scaled(baseC, 1.75, 1.08), earIn = srgb(0.52, 0.32, 0.30);
  const snout = srgb(...(t['snout'] ?? [0.66, 0.40, 0.38]));
  const tuskC: RGB3 = t['tusk'] ?? [0.95, 0.91, 0.80];
  const tusk = srgb(...tuskC), tuskRoot = scaled(tuskC, 0.72), eye = srgb(...(t['eye'] ?? [0.02, 0.015, 0.01])), tail = scaled(baseC, 0.6);
  return (out, x, y, _z, nx, ny, _nz, part, tt) => {
    switch (part) {
      case 'body':
        out.copy(base);
        mix(out, out, back, sstep(0.1, 0.85, ny) * 0.9);
        mix(out, out, belly, sstep(-0.25, -0.8, ny));
        break;
      case 'neck': case 'head':
        out.copy(base);
        mix(out, out, back, sstep(0.3, 0.9, ny) * 0.6 * (1 - sstep(0.5, 0.8, tt)));
        mix(out, out, cheek, sstep(0.45, 0.8, tt) * sstep(0.35, 0.9, Math.abs(nx)) * 0.8);   // pale cheek bristles
        mix(out, out, muzzle, sstep(0.78, 0.95, tt));
        mix(out, out, belly, sstep(-0.35, -0.85, ny) * 0.7);
        break;
      case 'snout': out.copy(snout); break;
      case 'crest': mix(out, crest, crestTip, sstep(0.2, 1, tt)); break;
      case 'ear': out.copy(legDark); mix(out, out, earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.8); break;
      case 'leg': mix(out, leg, legDark, sstep(0.45, 0.15, y)); break;
      case 'tail': out.copy(tail); break;
      case 'tusk': mix(out, tuskRoot, tusk, sstep(0.0, 0.4, tt)); break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(base);
    }
  };
}

/** Driftwood Isle deer: tan pastel body, cream belly / throat / rump, dark hooves and nose, bone antlers. */
function deerPaintLow(v?: VariantDef): Paint {
  const t = v?.tint ?? {};
  const bodyC: RGB3 = t['body'] ?? [0.62, 0.46, 0.30];
  const body = srgb(...bodyC), back = scaled(bodyC, 0.82), neck = scaled(bodyC, 0.94), muzzle = scaled(bodyC, 0.74);
  const belly = srgb(...(t['belly'] ?? [0.86, 0.78, 0.62])), rump = scaled(t['belly'] ?? [0.86, 0.78, 0.62], 0.97);
  const nose = srgb(...(t['nose'] ?? [0.10, 0.08, 0.07])), earIn = srgb(0.80, 0.70, 0.58);
  const leg = scaled(bodyC, 0.84), legDark = scaled(bodyC, 0.55), hoof = srgb(...(t['hoof'] ?? [0.12, 0.09, 0.08]));
  const antlerC: RGB3 = t['antler'] ?? [0.55, 0.44, 0.32];
  const antler = srgb(...antlerC), antlerTip = scaled(antlerC, 1.55), eye = srgb(...(t['eye'] ?? [0.02, 0.015, 0.01]));
  return (out, x, y, z, nx, ny, _nz, part, tt) => {
    switch (part) {
      case 'body': {
        out.copy(body);
        mix(out, out, back, sstep(0.5, 0.95, ny) * 0.8);
        mix(out, out, belly, sstep(-0.2, -0.75, ny));
        const rd = Math.hypot(x * 1.2, (y - 0.98) * 1.3, (z + 0.9) * 0.9);
        mix(out, out, rump, sstep(0.30, 0.16, rd) * 0.9);
        break;
      }
      case 'neck': out.copy(neck); mix(out, out, belly, sstep(-0.3, -0.85, ny) * 0.85); break;
      case 'head':
        out.copy(neck);
        mix(out, out, muzzle, sstep(0.6, 0.9, tt) * 0.8);
        mix(out, out, belly, sstep(-0.3, -0.8, ny) * sstep(0.3, 0.7, tt) * 0.7);
        mix(out, out, nose, sstep(0.9, 0.97, tt));
        break;
      case 'ear': out.copy(back); mix(out, out, earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.9); break;
      case 'leg': mix(out, leg, legDark, sstep(0.62, 0.3, y)); break;
      case 'tail': out.copy(back); mix(out, out, rump, sstep(-0.1, -0.7, ny) * 0.9); break;
      case 'antler': mix(out, antler, antlerTip, sstep(0.5, 1, tt) * 0.85); break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(body);
    }
  };
}

/**
 * Driftwood Isle bear: a flat two-tone coat — the base colour over the body, a paler saddle of guard-hair tips down the
 * back / hump / shoulders (no noise: the facet jitter does the "fur"), a darker belly and lower legs, a tan muzzle,
 * black nose and claws. Variant tints (brown, Old Blackpaw, Grizzled Sow…) come through the same palette keys as the
 * PBR paint (`base tip dark muzzle blaze nose claw eye pad`, the kit's bear view); the pastel lift keeps a black bear from
 * reading as a silhouette in the island's hard light.
 */
function bearPaintLow(v?: VariantDef): Paint {
  const t = v?.tint ?? {};
  const baseC: RGB3 = t['base'] ?? [0.075, 0.062, 0.055];
  const black = baseC[0] < 0.15;
  // a black bear's low-poly base is lifted to a warm charcoal so its facets still show
  const bC: RGB3 = black ? [baseC[0] * 2.2 + 0.05, baseC[1] * 2.0 + 0.045, baseC[2] * 1.9 + 0.045] : baseC;
  const base = srgb(...bC), tip = srgb(...(t['tip'] ?? (black ? [0.30, 0.25, 0.21] : [0.68, 0.56, 0.40])));
  const dark = scaled(bC, 0.55), belly = scaled(bC, 0.62), muzzle = srgb(...(t['muzzle'] ?? [0.46, 0.34, 0.23]));
  const blaze = srgb(...(t['blaze'] ?? [0.85, 0.78, 0.62])), nose = srgb(...(t['nose'] ?? [0.05, 0.04, 0.04]));
  const claw = srgb(...(t['claw'] ?? (black ? [0.16, 0.14, 0.12] : [0.6, 0.53, 0.42]))), pad = srgb(...(t['pad'] ?? [0.12, 0.09, 0.08]));
  const eye = srgb(...(t['eye'] ?? [0.02, 0.015, 0.01])), earIn = scaled(bC, 0.8);
  const hasBlaze = Boolean(v?.traits?.['blaze']);
  const grizzle = Number(v?.traits?.['grizzle'] ?? 0.35);
  return (out, x, y, z, nx, ny, nz, part, tt) => {
    switch (part) {
      case 'body':
        out.copy(base);
        mix(out, out, tip, sstep(0.05, 0.8, ny) * (0.35 + 0.65 * grizzle) * (0.55 + 0.45 * sstep(-0.2, 0.5, z)));   // the saddle, strongest over the hump
        mix(out, out, belly, sstep(-0.3, -0.85, ny) * 0.85);
        if (hasBlaze && z > 0.3 && ny < -0.15) mix(out, out, blaze, sstep(0.15, 0.06, Math.abs(x)) * sstep(0.28, 0.42, z) * sstep(-0.15, -0.6, ny));
        break;
      case 'neck': out.copy(base); mix(out, out, tip, sstep(0.0, 0.9, ny) * grizzle * 0.5); mix(out, out, belly, sstep(-0.3, -0.85, ny) * 0.7); break;
      case 'head':
        out.copy(base);
        mix(out, out, tip, sstep(0.3, 0.95, ny) * grizzle * 0.3 * sstep(0.55, 0.2, tt));
        mix(out, out, muzzle, sstep(0.5, 0.75, tt));
        mix(out, out, dark, sstep(0.94, 1.0, tt) * 0.6);
        break;
      case 'ear': out.copy(dark); mix(out, out, earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.8); void nz; break;
      case 'leg': mix(out, base, dark, sstep(0.5, 0.12, y) * 0.85); mix(out, out, pad, sstep(0.09, 0.03, y) * sstep(0.2, -0.8, ny) * 0.8); break;
      case 'tail': mix(out, base, dark, sstep(0.3, 1, tt) * 0.6); break;
      case 'nose': out.copy(nose); break;
      case 'claw': mix(out, claw, dark, sstep(0.4, 1.0, tt) * 0.5); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(base);
    }
  };
}

/** the island's toon paint rows: the boar, the bear, and the deer palette for the deer and the elk */
export const DRIFTWOOD_TOON_PAINTS: readonly (readonly [string, (v?: VariantDef) => Paint])[] = [
  ['boar', boarPaintLow], ['deer', deerPaintLow], ['elk', deerPaintLow], ['bear', bearPaintLow],
];
export function registerDriftwoodToonPaints(scope?: Scope): void {
  for (const [kind, paint] of DRIFTWOOD_TOON_PAINTS) registerToonPaint(kind, paint, scope);
}
