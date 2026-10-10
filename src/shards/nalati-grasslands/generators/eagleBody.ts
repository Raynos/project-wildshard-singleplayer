import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, paintNoise, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import * as THREE from 'three';

/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's species bodies bake): the golden eagle (Qyran)'s lofts, which `species/eagle.ts` used to run
 * on the page. The body reads its variant's `traits` / `tint` only (no rng), so `generators/bodies.ts` bakes each variant
 * once (`scripts/bake-nalati-bodies.mjs`) and the page reads it back bit-exact (`species/bodies.ts` `nalatiBody`).
 */

const PAL = {
  body: [0.24, 0.16, 0.1], covert: [0.36, 0.25, 0.15], edge: [0.55, 0.42, 0.28], primary: [0.1, 0.085, 0.075],
  nape: [0.92, 0.66, 0.28], tail: [0.2, 0.15, 0.11], band: [0.62, 0.57, 0.5], beak: [0.9, 0.75, 0.3], hook: [0.2, 0.2, 0.22],
  eye: [0.95, 0.6, 0.12], feet: [0.95, 0.78, 0.3], talon: [0.08, 0.08, 0.08],
} satisfies Record<string, RGB>;

function eaglePaint(v: VariantDef): Paint {
  const P = paletteColors(PAL, v.tint);
  const napeHdr = P.nape.clone().multiplyScalar(1.5);
  return (out, x, y, z, _nx, ny, _nz, part, t) => {
    switch (part) {
      case 'body': mix(out, P.body, P.covert, 0.3 + 0.3 * paintNoise.fbm(x * 9, z * 9, 2)); mix(out, out, P.body, sstep(0, -0.8, ny) * 0.4); break;
      case 'head': mix(out, P.body, napeHdr, sstep(0.08, 0.2, y + (0.3 - z) * 0.4) * (ny > -0.3 ? 1 : 0.4)); break;
      case 'wing': {
        // coverts: rows of feathers (lighter edges), fading to the dark flight feathers at the trailing edge
        const row = Math.abs(Math.sin(x * 40)) > 0.85 ? 0.35 : 0;
        mix(out, P.covert, P.edge, row);
        mix(out, out, P.primary, sstep(0.35, 0.8, t));
        break;
      }
      case 'primary': mix(out, P.primary, P.covert, sstep(0.4, 0.0, t) * 0.4); break;
      case 'tail': mix(out, P.tail, P.band, sstep(0.25, 0.35, t) * sstep(0.62, 0.5, t) * 0.8); mix(out, out, P.primary, sstep(0.85, 1, t)); break;
      case 'beak': mix(out, P.beak, P.hook, sstep(0.45, 0.75, t)); break;
      case 'eye': out.copy(P.eye).multiplyScalar(1.6); break;
      case 'leg': mix(out, P.covert, P.edge, 0.3); break;
      case 'feet': out.copy(P.feet); break;
      case 'talon': out.copy(P.talon); break;
      default: out.copy(P.body);
    }
  };
}

export function buildEagle(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0, 0] },
    { name: 'neck', parent: 'body', pos: [0, 0.05, 0.17] },
    { name: 'head', parent: 'neck', pos: [0, 0.09, 0.27] },
    { name: 'tail', parent: 'body', pos: [0, -0.01, -0.24] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `wing${side}1`, parent: 'body', pos: [sx * 0.09, 0.04, 0.06] },
      { name: `wing${side}2`, parent: `wing${side}1`, pos: [sx * 0.56, 0.05, 0.02] },
      { name: `leg${side}`, parent: 'body', pos: [sx * 0.05, -0.07, 0.0] },
    );
  }
  const B = boneIndex(bones);
  const paint = eaglePaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), neck = B('neck'), head = B('head'), tail = B('tail');
  // the body: a spindle from the tail's root to the neck
  fur.push(loft([
    S(0, 0.0, -0.26, 0.03, 0.03, body), S(0, 0.0, -0.2, 0.08, 0.075, body), S(0, 0.0, -0.06, 0.115, 0.11, body),
    S(0, 0.01, 0.08, 0.12, 0.12, body), S(0, 0.035, 0.18, 0.085, 0.09, body, neck, 0.5), S(0, 0.06, 0.24, 0.06, 0.065, neck),
  ], 16, 'body', paint));
  // the head with the golden hackles, a heavy hooked beak
  fur.push(loft([S(0, 0.06, 0.22, 0.065, 0.068, neck, head, 0.5), S(0, 0.09, 0.27, 0.06, 0.062, head), S(0, 0.1, 0.32, 0.05, 0.05, head), S(0, 0.095, 0.355, 0.03, 0.032, head)], 14, 'head', paint));
  hard.push(loft([S(0, 0.095, 0.35, 0.022, 0.026, head), S(0, 0.09, 0.385, 0.016, 0.022, head), S(0, 0.075, 0.41, 0.008, 0.012, head), S(0, 0.058, 0.415, 0.003, 0.004, head)], 8, 'beak', paint));
  for (const sx of [1, -1]) eyes.push(skinPlain(new THREE.SphereGeometry(0.011, 8, 6).translate(sx * 0.036, 0.105, 0.335), head, 'eye', paint));
  // wings: the arm (shoulder → wrist, a broad chord) and the hand (wrist → tip), then five spread primaries
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const w1 = B(`wing${side}1`), w2 = B(`wing${side}2`);
    fur.push(loft([
      S(sx * 0.08, 0.04, 0.02, 0.03, 0.17, body, w1, 0.6), S(sx * 0.25, 0.045, 0.0, 0.025, 0.21, w1), S(sx * 0.42, 0.05, -0.02, 0.02, 0.2, w1),
      S(sx * 0.56, 0.05, -0.02, 0.018, 0.18, w1, w2, 0.5), S(sx * 0.72, 0.05, -0.04, 0.014, 0.15, w2), S(sx * 0.86, 0.05, -0.06, 0.01, 0.1, w2),
    ], 8, 'wing', paint, true, true, 'z'));
    for (let k = 0; k < 5; k++) {
      const ang = (-0.25 + k * 0.14) * sx, z0 = -0.02 - k * 0.035, x0 = sx * 0.82;
      const len = 0.3 - Math.abs(k - 1.5) * 0.03;
      const x1 = x0 + Math.cos(ang) * len * sx, z1 = z0 + Math.sin(-ang * sx) * len - 0.02 * k;
      fur.push(loft([S(x0, 0.05, z0, 0.006, 0.028, w2), S((x0 + x1) / 2, 0.048, (z0 + z1) / 2, 0.005, 0.03, w2), S(x1, 0.045, z1, 0.003, 0.012, w2)], 6, 'primary', paint, true, true, 'z'));
    }
    // legs: feathered trousers, bare yellow feet, black talons
    const lg = B(`leg${side}`);
    fur.push(loft([S(sx * 0.05, -0.04, 0.0, 0.04, 0.045, body, lg, 0.6), S(sx * 0.055, -0.12, 0.01, 0.035, 0.035, lg), S(sx * 0.055, -0.19, 0.02, 0.02, 0.02, lg)], 8, 'leg', paint, false, true));
    for (let k = -1; k <= 1; k++) {
      hard.push(loft([S(sx * 0.055, -0.2, 0.02, 0.01, 0.01, lg), S(sx * 0.055 + k * 0.02, -0.22, 0.07, 0.008, 0.008, lg)], 5, 'feet', paint, true, true, 'z'));
      hard.push(skinPlain(new THREE.ConeGeometry(0.006, 0.03, 5).rotateX(Math.PI / 2 + 0.6).translate(sx * 0.055 + k * 0.02, -0.225, 0.085), lg, 'talon', paint));
    }
  }
  // the tail fan
  fur.push(loft([S(0, -0.01, -0.22, 0.05, 0.012, tail), S(0, -0.015, -0.34, 0.1, 0.01, tail), S(0, -0.02, -0.46, 0.14, 0.008, tail), S(0, -0.02, -0.5, 0.13, 0.006, tail)], 10, 'tail', paint));
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0, bodyHalfLen: 0.24, bodyRadius: 0.16, headRadius: 0.08, legLen: 0.2, feet: [[0.05, 0.02], [-0.05, 0.02], [0.05, -0.02], [-0.05, -0.02]], halfWidth: 0.12 },
  };
}
