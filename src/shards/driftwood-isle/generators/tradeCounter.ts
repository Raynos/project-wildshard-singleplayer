/** Original plank counter and displayed shop goods; offline geometry only. */
import * as THREE from 'three';
import { log, plank, rope, rock } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';
import { COUNTER_TOP as TOP } from '../data/counterLayout';

const C = {
  wood: '#9a7b58', woodB: '#8a6a48', woodDark: '#6a4a2e', crate: '#a47b4b', crateB: '#8b6538',
  cloth: '#e6dcc4', clothB: '#d8ccb0', stripe: '#2f9490', stone: '#8d9096', slate: '#5f6b78', rope: '#b99d6c', twine: '#8a6a3c',
  heart: '#c8323a', heartDark: '#9e2530', paper: '#e8d9b0', paperDark: '#cdb88a', brass: '#b08a3a', coin: '#e0b845', leather: '#7a5234',
};

const M = new THREE.Matrix4();
const at = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s: [number, number, number] = [1, 1, 1]): THREE.Matrix4 =>
  M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s));
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function counterGeometry(): THREE.BufferGeometry {
  const k = new LowPolyKit(0x7ade9);
  const rng = k.rng, top = TOP.y, hw = TOP.w / 2 - 0.1, hd = TOP.d / 2 - 0.07;
  // ── the counter: three sawn planks on two cross-bearers, four crooked driftwood legs, a lower shelf ──
  for (let i = 0; i < 3; i++) k.add(plank(TOP.w, 0.205, 0.05, rng), i % 2 ? C.woodB : C.wood, { matrix: at(0, top - 0.025, (i - 1) * 0.212, (i - 1) * 0.01) });
  for (const sx of [-1, 1]) k.add(plank(0.07, TOP.d - 0.06, 0.06, rng), C.woodDark, { matrix: at(sx * hw, top - 0.08, 0) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.add(log(V(sx * (hw + 0.02), 0, sz * (hd + 0.01)), V(sx * hw, top - 0.06, sz * hd), 0.05, 0.042, 6, rng.range(0, 1)), C.woodDark, { wobble: 0.006 });
  }
  for (const sz of [-1, 1]) k.add(log(V(-hw, 0.26, sz * hd), V(hw, 0.3, sz * hd), 0.03, 0.03, 5), C.woodDark);   // the rails under the shelf
  for (let i = 0; i < 2; i++) k.add(plank(TOP.w - 0.16, 0.24, 0.035, rng), i ? C.woodB : C.wood, { matrix: at(0, 0.31, (i - 0.5) * 0.25) });
  // a crate on the shelf and a coil of rope beside it
  k.add(new THREE.BoxGeometry(0.34, 0.24, 0.3), C.crate, { matrix: at(-0.25, 0.45, -0.02, 0.08), wobble: 0.008 });
  for (const y of [0.37, 0.53]) k.add(new THREE.BoxGeometry(0.35, 0.03, 0.31), C.crateB, { matrix: at(-0.25, y, -0.02, 0.08) });
  k.add(new THREE.TorusGeometry(0.1, 0.028, 4, 10).rotateX(Math.PI / 2), C.rope, { matrix: at(0.3, 0.36, 0.02) });
  k.add(new THREE.TorusGeometry(0.075, 0.026, 4, 9).rotateX(Math.PI / 2), C.rope, { matrix: at(0.3, 0.405, 0.02) });

  // ── the sailcloth runner: over the middle of the top, draped down the front, a teal stripe ──
  const rt = top + 0.006;
  k.add(new THREE.BoxGeometry(0.58, 0.012, TOP.d - 0.04), C.cloth, { matrix: at(0.02, rt, 0), jitter: 0.03 });
  k.add(new THREE.BoxGeometry(0.58, 0.36, 0.012), C.clothB, { matrix: at(0.02, top - 0.17, TOP.d / 2 + 0.008), jitter: 0.03, sway: { w: 0.12, hang: true } });
  for (const sx of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.05, 0.014, TOP.d - 0.03), C.stripe, { matrix: at(0.02 + sx * 0.2, rt + 0.002, 0) });
    k.add(new THREE.BoxGeometry(0.05, 0.36, 0.014), C.stripe, { matrix: at(0.02 + sx * 0.2, top - 0.17, TOP.d / 2 + 0.01), sway: { w: 0.12, hang: true } });
  }
  const on = rt + 0.008;   // the top of the runner / the planks the goods sit on

  // ── the goods ──
  // whetstone I and II: a grey stone and a darker slate one on a little wooden block
  k.add(new THREE.BoxGeometry(0.26, 0.035, 0.12), C.woodB, { matrix: at(-0.45, top + 0.018, 0.04, 0.18), wobble: 0.004 });
  k.add(new THREE.BoxGeometry(0.2, 0.045, 0.055), C.stone, { matrix: at(-0.46, top + 0.058, 0.01, 0.18), wobble: 0.004 });
  k.add(new THREE.BoxGeometry(0.17, 0.04, 0.05), C.slate, { matrix: at(-0.43, top + 0.056, 0.085, 0.14), wobble: 0.004 });
  k.add(new THREE.BoxGeometry(0.02, 0.043, 0.052), C.brass, { matrix: at(-0.43, top + 0.057, 0.085, 0.14) });   // the II stone's band
  // the sturdy heart: a red heart charm on a cord from a T-stand, a smaller one lying beside it
  const stand = V(-0.12, on, -0.12);
  k.add(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 7), C.woodDark, { matrix: at(stand.x, on + 0.012, stand.z) });
  k.add(log(V(stand.x, on, stand.z), V(stand.x, on + 0.32, stand.z), 0.012, 0.011, 5), C.woodDark);
  k.add(log(V(stand.x - 0.01, on + 0.31, stand.z), V(stand.x + 0.13, on + 0.31, stand.z), 0.01, 0.01, 5), C.woodDark);
  k.add(rope([V(stand.x + 0.1, on + 0.305, stand.z), V(stand.x + 0.085, on + 0.22, stand.z + 0.005), V(stand.x + 0.1, on + 0.19, stand.z + 0.008)], 0.004), C.twine);
  const heart = (x: number, y: number, z: number, s: number, ry: number, rx: number): void => {
    const P = at(x, y, z, ry, rx).clone(), flat = new THREE.Matrix4().makeScale(1, 1, 0.55);
    for (const sx of [-1, 1]) k.add(new THREE.IcosahedronGeometry(0.03 * s, 0), C.heart, { matrix: P.clone().multiply(new THREE.Matrix4().makeTranslation(sx * 0.024 * s, 0.018 * s, 0)).multiply(flat) });
    k.add(new THREE.ConeGeometry(0.048 * s, 0.07 * s, 4).rotateX(Math.PI).rotateY(Math.PI / 4), C.heartDark, { matrix: P.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.022 * s, 0)).multiply(flat) });
  };
  heart(stand.x + 0.1, on + 0.16, stand.z + 0.01, 1, 0.2, 0);
  heart(stand.x + 0.03, on + 0.012, stand.z + 0.19, 0.75, 0.5, -Math.PI / 2);
  // the sea chart: a rolled parchment tied with twine, its end rolls darker; one corner curling open
  const ch = { x: 0.2, z: 0.1, ry: 0.35 };
  k.add(new THREE.CylinderGeometry(0.036, 0.036, 0.38, 8).rotateZ(Math.PI / 2), C.paper, { matrix: at(ch.x, on + 0.036, ch.z, ch.ry), jitter: 0.03 });
  for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 8).rotateZ(Math.PI / 2), C.paperDark, { matrix: at(ch.x + sx * 0.18 * Math.cos(ch.ry), on + 0.036, ch.z - sx * 0.18 * Math.sin(ch.ry), ch.ry) });
  for (const sx of [-1, 1]) k.add(new THREE.TorusGeometry(0.039, 0.006, 4, 8).rotateY(Math.PI / 2), C.twine, { matrix: at(ch.x + sx * 0.08 * Math.cos(ch.ry), on + 0.036, ch.z - sx * 0.08 * Math.sin(ch.ry), ch.ry) });
  k.add(new THREE.BoxGeometry(0.22, 0.004, 0.09), C.paper, { matrix: at(ch.x + 0.02, on + 0.003, ch.z + 0.07, ch.ry, 0, 0.02) });
  k.add(new THREE.BoxGeometry(0.06, 0.005, 0.03), C.stripe, { matrix: at(ch.x + 0.03, on + 0.006, ch.z + 0.08, ch.ry + 0.3) });   // the sea on it
  // the sailcloth cape: folded in a stack, a teal edge, a rope clasp coiled on top
  const cp = { x: 0.47, z: -0.06, ry: -0.12 };
  k.add(new THREE.BoxGeometry(0.3, 0.05, 0.25), C.cloth, { matrix: at(cp.x, on + 0.025, cp.z, cp.ry), wobble: 0.006, jitter: 0.03 });
  k.add(new THREE.BoxGeometry(0.28, 0.045, 0.23), C.clothB, { matrix: at(cp.x + 0.01, on + 0.072, cp.z - 0.005, cp.ry + 0.05), wobble: 0.006, jitter: 0.03 });
  k.add(new THREE.BoxGeometry(0.285, 0.02, 0.02), C.stripe, { matrix: at(cp.x + 0.01, on + 0.074, cp.z + 0.11, cp.ry + 0.05) });
  k.add(new THREE.TorusGeometry(0.045, 0.01, 4, 8).rotateX(Math.PI / 2), C.rope, { matrix: at(cp.x - 0.03, on + 0.1, cp.z + 0.02) });
  k.add(new THREE.BoxGeometry(0.025, 0.02, 0.05), C.brass, { matrix: at(cp.x + 0.05, on + 0.1, cp.z + 0.02, 0.3) });
  // a brass dish of doubloons at the front corner (what you pay in)
  const dish = V(0.3, on, 0.2);
  k.add(new THREE.CylinderGeometry(0.075, 0.05, 0.03, 9), C.brass, { matrix: at(dish.x, on + 0.015, dish.z) });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.9, r = i === 0 ? 0 : 0.035;
    k.add(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 7), C.coin, { matrix: at(dish.x + Math.cos(a) * r, on + 0.034 + i * 0.004, dish.z + Math.sin(a) * r, a, 0.1 * (i % 2)), jitter: 0.1 });
  }
  // a pebble paperweight on the chart's corner
  k.add(rock(0.03, 0, rng, 0.6, 0.25), C.stone, { matrix: at(ch.x + 0.1, on + 0.012, ch.z + 0.1) });
  return k.finish({ ao: { floorY: 0, strength: 0.45 } });
}

