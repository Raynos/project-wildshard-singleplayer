import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import { loft, tube, skinPlain, S, boneIndex, mix, paletteColors, paintNoise, setShapeFn, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import * as THREE from 'three';

/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's species bodies bake): the balbal statues (warrior, capped)'s lofts, which `species/balbal.ts` used to run
 * on the page. The body reads its variant's `traits` / `tint` only (no rng), so `generators/bodies.ts` bakes each variant
 * once (`scripts/bake-nalati-bodies.mjs`) and the page reads it back bit-exact (`species/bodies.ts` `nalatiBody`).
 */

const PALETTE = {
  stone: [0.6, 0.58, 0.53], stoneWarm: [0.65, 0.6, 0.53], stoneDark: [0.36, 0.35, 0.33], carve: [0.3, 0.29, 0.27],
  lichenGold: [0.72, 0.64, 0.4], lichenGreen: [0.6, 0.63, 0.49], soil: [0.3, 0.22, 0.15], crack: [0.2, 0.12, 0.06],
} satisfies Record<string, RGB>;

function balbalPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  const base = v.traits?.['cap'] === true ? P.stoneWarm : P.stone;
  return (out, x, y, z, _nx, ny, _nz, part) => {
    if (part === 'crack') { out.copy(P.crack); return; }
    // weathered granite: a brush of light and dark, carved grooves darker, lichen gold on the tops / green in the shade
    const n = paintNoise.fbm(x * 6 + y * 2, z * 6 - y * 3, 3);
    mix(out, base, P.stoneDark, 0.18 + 0.3 * n);
    if (part === 'carve') mix(out, out, P.carve, 0.65);
    if (part === 'blade') mix(out, out, P.stoneDark, 0.25);
    const l = paintNoise.get(x * 4.1 + y * 1.7, z * 4.3 - y * 2.3) * 0.6 + paintNoise.get(x * 11 + y * 5, z * 11) * 0.4;
    if (l > 0.3) mix(out, out, ny > 0.2 || y > 1.5 ? P.lichenGold : P.lichenGreen, Math.min(0.55, (l - 0.3) * 2.2));
    if (ny < -0.4) out.multiplyScalar(0.8);
    // soil still clinging to the feet and shins (it came out of the ground)
    if (y < 0.5) mix(out, out, P.soil, sstep(0.5, 0.12, y) * (0.55 + 0.35 * paintNoise.get(x * 13, z * 13 + y * 9)));
  };
}

export function buildBalbal(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.9, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.08, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.32, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.6, 0.01] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.34, 1.46, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.37, 1.17, 0.04] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.36, 0.94, 0.1] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.15, 0.84, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.16, 0.46, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.16, 0.08, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = balbalPaint(v);
  const cap = v.traits?.['cap'] === true;
  const parts: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // chipped, weathered stone: the silhouette pushed in and out a centimetre or two
  setShapeFn((x, y, z, part) => (part === 'blade' ? 0 : (paintNoise.get(x * 9 + y * 4, z * 9 - y * 3) * 0.6 + paintNoise.get(x * 23, y * 23 + z * 7) * 0.4) * 0.012));
  // the stele: broad, flattened, a little tapered — the statue's body
  parts.push(loft([
    S(0, 0.74, 0, 0.33, 0.24, body), S(0, 0.92, 0, 0.35, 0.25, body, spine, 0.3), S(0, 1.12, 0, 0.36, 0.26, spine),
    S(0, 1.32, 0, 0.37, 0.26, spine, chest, 0.8), S(0, 1.46, 0, 0.36, 0.25, chest), S(0, 1.56, 0, 0.26, 0.19, chest), S(0, 1.62, 0, 0.19, 0.16, chest, head, 0.3),
  ], 18, 'stone', paint, true, true));
  // the belt (carved band) and three pendants on the front
  parts.push(loft([S(0, 0.86, 0, 0.36, 0.265, body), S(0, 0.93, 0, 0.365, 0.27, body)], 18, 'carve', paint, false, false));
  for (const bx of [-0.2, 0, 0.18]) parts.push(skinPlain(new THREE.BoxGeometry(0.055, 0.13, 0.03).translate(bx, 0.76, 0.26), body, 'stone', paint));
  // the goblet held to the chest (left hand carries it)
  parts.push(skinPlain(new THREE.CylinderGeometry(0.08, 0.045, 0.14, 12).translate(0.04, 1.3, 0.3), chest, 'stone', paint));
  parts.push(skinPlain(new THREE.TorusGeometry(0.078, 0.012, 5, 14).rotateX(Math.PI / 2).translate(0.04, 1.37, 0.3), chest, 'carve', paint));
  // the head: big and heavy, a flattened face, the brow ridge, deep eyes, a long wedge nose, the moustache curling down
  const hy = 1.84;
  parts.push(loft([S(0, 1.6, 0.0, 0.14, 0.13, chest, head, 0.6), S(0, 1.66, 0.0, 0.24, 0.22, head), S(0, 1.8, 0.0, 0.27, 0.25, head), S(0, 1.96, -0.01, 0.23, 0.22, head), S(0, 2.06, -0.02, 0.12, 0.12, head)], 18, 'stone', paint, true, true));
  parts.push(skinPlain(new THREE.CapsuleGeometry(0.036, 0.3, 3, 8).rotateZ(Math.PI / 2).translate(0, hy + 0.07, 0.235), head, 'stone', paint));   // brow
  for (const sx of [1, -1]) {
    parts.push(skinPlain(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.7, 0.5).translate(sx * 0.09, hy + 0.01, 0.23), head, 'carve', paint)); // sockets
    eyes.push(skinPlain(new THREE.SphereGeometry(0.03, 10, 6).scale(1.5, 0.55, 0.5).translate(sx * 0.09, hy + 0.01, 0.245), head, 'stone', paint)); // almond eyes (the factory merges an eye group)
    // the moustache: thick, drooping past the mouth, the ends curling out
    parts.push(tube([[sx * 0.015, hy - 0.09, 0.27], [sx * 0.08, hy - 0.11, 0.26], [sx * 0.125, hy - 0.17, 0.24], [sx * 0.145, hy - 0.22, 0.22]], 0.027, 0.012, head, 'stone', paint, 8));
    parts.push(skinPlain(new THREE.SphereGeometry(0.055, 8, 6).scale(0.45, 1.1, 0.8).translate(sx * 0.27, hy, -0.02), head, 'stone', paint)); // ears
  }
  { const g = new THREE.CylinderGeometry(0.024, 0.055, 0.18, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9); parts.push(skinPlain(g.translate(0, hy - 0.02, 0.26), head, 'stone', paint)); } // nose
  parts.push(skinPlain(new THREE.BoxGeometry(0.1, 0.016, 0.02).translate(0, hy - 0.14, 0.25), head, 'carve', paint)); // mouth
  if (cap) {
    parts.push(skinPlain(new THREE.ConeGeometry(0.3, 0.34, 18, 2).scale(1, 1, 0.92).translate(0, hy + 0.38, 0.0), head, 'stone', paint));
    parts.push(skinPlain(new THREE.TorusGeometry(0.275, 0.03, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.92).translate(0, hy + 0.21, 0), head, 'carve', paint));
    parts.push(skinPlain(new THREE.ConeGeometry(0.065, 0.16, 6).rotateX(Math.PI).translate(0, hy - 0.28, 0.21), head, 'stone', paint)); // short beard
  } else {
    parts.push(skinPlain(new THREE.TorusGeometry(0.265, 0.028, 5, 22).rotateX(Math.PI / 2 - 0.12).scale(1, 1, 0.92).translate(0, hy + 0.15, 0.0), head, 'carve', paint)); // headband
  }
  // the arms, carved free of the stele: heavy, short, the forearms thick
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    parts.push(loft([S(sx * 0.33, 1.5, 0, 0.12, 0.12, chest, sh, 0.6), S(sx * 0.36, 1.32, 0.01, 0.1, 0.095, sh), S(sx * 0.37, 1.17, 0.04, 0.095, 0.09, sh, el, 0.5), S(sx * 0.37, 1.04, 0.07, 0.09, 0.085, el), S(sx * 0.36, 0.94, 0.1, 0.085, 0.08, el, hand, 0.6)], 12, 'stone', paint, true, false));
    parts.push(skinPlain(new THREE.SphereGeometry(0.095, 10, 8).scale(1, 1.1, 1.05).translate(sx * 0.36, 0.89, 0.11), hand, 'stone', paint));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    parts.push(loft([S(sx * 0.15, 0.84, 0, 0.15, 0.14, body, hip, 0.5), S(sx * 0.16, 0.62, 0.005, 0.135, 0.13, hip), S(sx * 0.16, 0.46, 0.01, 0.125, 0.12, hip, knee, 0.5), S(sx * 0.16, 0.26, 0.015, 0.115, 0.115, knee), S(sx * 0.16, 0.1, 0.02, 0.12, 0.12, knee, foot, 0.6)], 12, 'stone', paint, true, false));
    parts.push(loft([S(sx * 0.16, 0.1, -0.05, 0.13, 0.1, foot), S(sx * 0.16, 0.06, 0.1, 0.12, 0.07, foot), S(sx * 0.16, 0.05, 0.22, 0.075, 0.05, foot)], 10, 'stone', paint, true, true));
  }
  // the stone sabre in the right hand: a thick, slightly curved carved blade, the guard a heavy bar
  {
    const hand = B('armR_hand'), x = -0.36;
    hard.push(loft([S(x, 0.89, 0.02, 0.04, 0.04, hand), S(x, 0.89, 0.12, 0.045, 0.045, hand), S(x, 0.89, 0.2, 0.04, 0.04, hand)], 8, 'carve', paint, true, true, 'z'));
    hard.push(skinPlain(new THREE.BoxGeometry(0.2, 0.06, 0.05).translate(x, 0.89, 0.23), hand, 'carve', paint));
    hard.push(loft([S(x, 0.9, 0.25, 0.075, 0.026, hand), S(x, 0.92, 0.55, 0.085, 0.026, hand), S(x, 0.97, 0.85, 0.075, 0.022, hand), S(x, 1.05, 1.12, 0.05, 0.018, hand), S(x, 1.12, 1.28, 0.012, 0.01, hand)], 8, 'blade', paint, true, true, 'z'));
  }
  setShapeFn(null);
  void spine;
  return {
    bones, furParts: parts, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.9, bodyHalfLen: 0.6, bodyRadius: 0.4, headRadius: 0.26, legLen: 0.82, feet: [[0.16, 0.05], [-0.16, 0.05], [0.16, -0.05], [-0.16, -0.05]], halfWidth: 0.38, capsuleAxis: 'y' },
  };
}
