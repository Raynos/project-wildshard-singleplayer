/** Original near/far cover builders, run offline with their shared RNG sequence and exact vertex colours. */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { rock, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, fern, hibiscus, grassTuft, broadClump, PLANT, type Part } from '@wildshard/engine/world/lowpolyKit';
import { rockGeometry } from '../world/rockKit';
import { triAreas } from '../world/coverTint';

interface CoverLook { r: number; g: number; b: number; top: number; side: number }

/** a thin stem's end caps are never seen (in the ground, under the leaves or petals): keep the tube, drop the caps (E117) */
const openEnded = (parts: Part[]): Part[] => parts.map(([g, c]) => {
  const idx = g.getIndex(), side = g.groups[0];
  if (idx !== null && g.groups.length >= 2 && side !== undefined) { g.setIndex(Array.from(idx.array.slice(side.start, side.start + side.count))); g.clearGroups(); }
  return [g, c];
});
// ── the far models' pieces (E117 follow-up): one or two triangles each ──
/** a grass blade leaning out along yaw `a`: base width 2w, height h, lean (0 up … 1 flat) */
function bladeTri(a: number, w: number, h: number, lean: number): THREE.BufferGeometry {
  const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
  return tris([ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + Math.cos(a) * h * lean, h, oz + Math.sin(a) * h * lean]);
}
/** a flat flower chip of radius r, tipped by `tilt` rad: one triangle */
function chip(r: number, tilt: number): THREE.BufferGeometry {
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; v.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  return tris(v).rotateX(-tilt);
}
/** parts copied (the kit disposes what it is given) */
const cloneParts = (parts: Part[]): Part[] => parts.map(([g, c]) => [g.clone(), c]);
/**
 * E156: a plant's leaves as far-model kites. lowpolyKit's `leaf` is four triangles — base B, crease M, sides L / R, tip T,
 * in the order [B M L] [B R M] [M T L] [M R T] — and becomes the two of its outline, [B L R] [L T R]. Anything that is
 * not a leaf (stems) is dropped. The parts are the near model's own, so the far one keeps its leaves where they are.
 */
const KITE_SHADE = 0.82;
function kites(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const [g, c] of parts) {
    const p = g.getAttribute('position');
    if (g.getIndex() !== null || p.count !== 12) continue;
    const at = (i: number): [number, number, number] => [p.getX(i), p.getY(i), p.getZ(i)];
    const B = at(0), L = at(2), R = at(4), T = at(7);
    // ×KITE_SHADE: a kite is one flat face, where the leaf's crease put half of it in its own shade (measured: the kites
    // read 8 % brighter than the leaves they stand for, at the dune fringe, phone tier)
    out.push([tris([...B, ...L, ...R, ...L, ...T, ...R]), new THREE.Color(c).multiplyScalar(KITE_SHADE)]);
  }
  return out;
}

/**
 * E156: a plant model's mean colour (its vertex colours weighted by triangle area) and its ground / upright areas (the
 * sum of its triangles' projections, ×OVERLAP for the fronds that hide each other), for the cover grid.
 */
const OVERLAP = 0.6;
export function coverLook(g: THREE.BufferGeometry): CoverLook {
  const pos = g.getAttribute('position'), col = g.getAttribute('color'), idx = g.getIndex();
  let r = 0, gg = 0, bb = 0, w = 0, top = 0, side = 0;
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    const ar = triAreas(pos.getX(i0), pos.getY(i0), pos.getZ(i0), pos.getX(i1), pos.getY(i1), pos.getZ(i1), pos.getX(i2), pos.getY(i2), pos.getZ(i2));
    const area = ar.top + ar.side;
    r += col.getX(i2) * area; gg += col.getY(i2) * area; bb += col.getZ(i2) * area; w += area;
    top += ar.top; side += ar.side;
  }
  return w > 0 ? { r: r / w, g: gg / w, b: bb / w, top: top * OVERLAP, side: side * OVERLAP } : { r: 0, g: 0, b: 0, top: 0, side: 0 };
}

/** All templates are generated together: changing their order changes the authored RNG draws. */
export function coverGeometry(): {
  geometry: Record<'tuft' | 'fern' | 'hibiscus' | 'daisy' | 'pebble' | 'shells' | 'starfish' | 'bush' | 'tuftFar' | 'fernFar' | 'hibiscusFar' | 'daisyFar' | 'bushFar', THREE.BufferGeometry>;
  look: Record<'tuft' | 'fern' | 'hibiscus' | 'daisy' | 'pebble' | 'shells' | 'starfish' | 'bush', CoverLook>;
} {
  const geo = (parts: Part[] | ((k: LowPolyKit) => void), seed: number): THREE.BufferGeometry => {
    const kit = new LowPolyKit(SEED ^ seed);
    if (typeof parts === 'function') parts(kit); else kit.addParts(parts, { jitter: 0.08 });
    return kit.finish({ ao: false });
  };
  const rng = new Rng(SEED ^ 0x6c0e);
  // a tuft: two bunches of blades so one instance reads as a clump
  const tuftGeo = geo((k) => { k.addParts(grassTuft(rng, 0.42), { jitter: 0.08 }); k.addParts(grassTuft(rng, 0.32), { matrix: new THREE.Matrix4().makeTranslation(0.12, 0, 0.08), jitter: 0.08 }); }, 0x6c01);
  const fernParts = fern(rng, 0.75);
  const fernGeo = geo(cloneParts(fernParts), 0x6c02);
  /** the hibiscus's leaves (drawn inside its kit callback, in the same order as before: the rng sequence holds) */
  let hibParts: Part[] = [];
  const hibGeo = geo((k) => {
    hibParts = fern(rng, 0.42);
    k.addParts(cloneParts(hibParts), { jitter: 0.08 });
    for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.addParts(openEnded(hibiscus(0.09)), { matrix: new THREE.Matrix4().makeRotationX(-0.5).setPosition(x, y, z), jitter: 0.05 });
  }, 0x6c03);
  const daisyGeo = geo((k) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng.range(0, 0.6), d = rng.range(0.05, 0.2), h = rng.range(0.14, 0.26), x = Math.cos(a) * d, z = Math.sin(a) * d;
      k.add(new THREE.CylinderGeometry(0.008, 0.01, h, 3, 1, true).translate(x, h / 2, z), PLANT.stem);
      const petals: number[] = [];
      for (let p = 0; p < 6; p++) { const b = (p / 6) * Math.PI * 2; petals.push(x, h, z, x + Math.cos(b) * 0.05, h + 0.005, z + Math.sin(b) * 0.05, x + Math.cos(b + 0.5) * 0.05, h + 0.005, z + Math.sin(b + 0.5) * 0.05); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(petals, 3));
      k.add(g, i % 2 ? '#f6f2e6' : '#fbe9a0', { jitter: 0.03 });
      k.add(new THREE.OctahedronGeometry(0.018, 0).translate(x, h + 0.01, z), PLANT.stamen);
    }
    k.addParts(grassTuft(rng, 0.2), { jitter: 0.08 });
  }, 0x6c04);
  const rockRng = new Rng(SEED ^ 0x70c6);
  const pebbleGeo = geo((k) => {
    for (let i = 0; i < 3; i++) {
      const r = rng.range(0.1, 0.22), a = rng.range(0, 6.28), d = i === 0 ? 0 : rng.range(0.2, 0.35);
      const m = new THREE.Matrix4().makeTranslation(Math.cos(a) * d, r * 0.2, Math.sin(a) * d);
      // E114: the pebbles are rockKit rocks too (flat-shaded here: the ground cover is one faceted material). The old
      // pebble is still built for the draws it takes, so everything after is placed as it always was
      rock(r, 0, rng, 0.6, 0.25).dispose();
      k.addPainted(rockGeometry(r, rockRng, { squash: 0.6, moss: 0.5, ground: -0.2 * r }), m);
    }
  }, 0x6c05);

  const farRng = new Rng(SEED ^ 0x6cf0);
  // E156: the fern, hibiscus and bush far models are their near models' own leaves as 2-triangle kites (the same outline,
  // no crease), so the plant keeps its silhouette through the handover. The old hand-made ones showed 15–28 % of the
  // near plant's side-on area and grew 4–7× in view as you crossed the near edge: the pop Jake filmed at the dune fringe.
  const farTuftGeo = geo((k) => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + farRng.range(-0.4, 0.4); k.add(bladeTri(a, 0.09, farRng.range(0.32, 0.46), farRng.range(0.2, 0.45)), [PLANT.grassTip, PLANT.grass, PLANT.grassB][i] ?? PLANT.grass); } }, 0x6cf1);
  const farFernGeo = geo(kites(fernParts), 0x6cf2);
  const farHibGeo = geo((k) => {
    k.addParts(kites(hibParts), { jitter: 0.08 });
    for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.add(chip(0.1, 0.5).translate(x, y, z), PLANT.hibiscus);
  }, 0x6cf3);
  const farDaisyGeo = geo((k) => {
    for (let i = 0; i < 2; i++) k.add(bladeTri(i * Math.PI, 0.03, 0.18, 0.3), PLANT.grass);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, d = farRng.range(0.08, 0.2); k.add(chip(0.065, 0).translate(Math.cos(a) * d, farRng.range(0.14, 0.26), Math.sin(a) * d), i % 2 ? '#f6f2e6' : '#fbe9a0'); }
  }, 0x6cf4);
  const shellGeo = geo((k) => {
    const shell = (x: number, z: number, r: number, col: string) => {
      const v: number[] = [];
      for (let i = 0; i < 5; i++) { const a0 = -0.9 + i * 0.36, a1 = a0 + 0.36; v.push(x, 0.02, z - r * 0.5, x + Math.sin(a0) * r, 0.02 + r * 0.25 * Math.cos(a0 * 1.2), z + Math.cos(a0) * r * 0.6, x + Math.sin(a1) * r, 0.02 + r * 0.25 * Math.cos(a1 * 1.2), z + Math.cos(a1) * r * 0.6); }
      k.add(tris(v), col, { jitter: 0.08 });
    };
    shell(0, 0, 0.09, '#f3e6d4'); shell(0.35, 0.25, 0.07, '#f0c9b8'); shell(-0.28, 0.18, 0.06, '#e9dcc8');
    k.addTopped(rock(0.07, 0, rng, 0.6, 0.25), '#8d8a84', '#9a968e', { matrix: new THREE.Matrix4().makeTranslation(0.2, 0.01, -0.3), jitter: 0.08 });
    k.addTopped(rock(0.05, 0, rng, 0.6, 0.25), '#a7a39b', '#b0aca4', { matrix: new THREE.Matrix4().makeTranslation(-0.1, 0.01, -0.35), jitter: 0.08 });
  }, 0x6c06);
  const starGeo = geo((k) => {
    const v: number[] = [];
    for (let a = 0; a < 5; a++) { const t = (a / 5) * Math.PI * 2, l = t + 0.63, rr = t - 0.63; v.push(0, 0.05, 0, Math.cos(rr) * 0.042, 0.01, Math.sin(rr) * 0.042, Math.cos(t) * 0.12, 0.01, Math.sin(t) * 0.12, 0, 0.05, 0, Math.cos(t) * 0.12, 0.01, Math.sin(t) * 0.12, Math.cos(l) * 0.042, 0.01, Math.sin(l) * 0.042); }
    k.add(tris(v), '#f07a3a', { jitter: 0.06 });
  }, 0x6c09);
  const bushParts = openEnded(broadClump(rng, 1.0));
  const bushGeo = geo(cloneParts(bushParts), 0x6c07), farBushGeo = geo(kites(bushParts), 0x6cf5);
  const geometry = { tuft: tuftGeo, fern: fernGeo, hibiscus: hibGeo, daisy: daisyGeo, pebble: pebbleGeo, shells: shellGeo, starfish: starGeo, bush: bushGeo, tuftFar: farTuftGeo, fernFar: farFernGeo, hibiscusFar: farHibGeo, daisyFar: farDaisyGeo, bushFar: farBushGeo };
  const look = { tuft: coverLook(tuftGeo), fern: coverLook(fernGeo), hibiscus: coverLook(hibGeo), daisy: coverLook(daisyGeo), pebble: coverLook(pebbleGeo), shells: coverLook(shellGeo), starfish: coverLook(starGeo), bush: coverLook(bushGeo) };
  return { geometry, look };
}
