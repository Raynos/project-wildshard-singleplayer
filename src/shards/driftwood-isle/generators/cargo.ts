/**
 * The wreck's cargo builders (sp-o250, moved from models/cargo.ts): the BARREL (a bulged stave cask with two iron bands,
 * standing or lying on its side), the CRATE (a plank box with corner posts, or a broken one: three slats, a bottom and
 * one side left) and the ROPE COIL (three stacked turns). Flat-shaded LowPolyKit parts, painted per face; a barrel picks
 * its stain from the stream it is given. Offline only: the wreck bakes add them into its one kit (its baked AO and
 * lantern light), and `cargoSpecimens` bakes the Explorer's lone copies (fixed models `cargo-*`), so none of it runs
 * in the game.
 *
 *   addBarrel(kit, matrix, lying);  addCrate(kit, matrix, size, broken);  addCoil(kit, matrix, r);
 */
import * as THREE from 'three';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';

const C = { barrel: '#8a5a34', barrelB: '#76492a', band: '#3b3b3f', crate: '#a47b4b', crateB: '#8b6538', rope: '#b99d6c' };

/** a barrel at `m` (its centre; `lying`: on its side, the axis along local x) */
export function addBarrel(kit: LowPolyKit, m: THREE.Matrix4, lying = false): void {
  const rng = kit.rng;
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 9);
  const bulge = g.getAttribute('position');
  for (let i = 0; i < bulge.count; i++) { const y = bulge.getY(i); const k = 1 + 0.12 * (1 - (y / 0.45) ** 2); bulge.setX(i, bulge.getX(i) * k); bulge.setZ(i, bulge.getZ(i) * k); }
  const r = lying ? new THREE.Matrix4().makeRotationZ(Math.PI / 2) : new THREE.Matrix4();
  kit.add(g.applyMatrix4(r), rng.next() < 0.5 ? C.barrel : C.barrelB, { matrix: m, jitter: 0.08 });
  for (const y of [-0.3, 0.3]) kit.add(new THREE.CylinderGeometry(0.37, 0.37, 0.06, 9).translate(0, y, 0).applyMatrix4(r), C.band, { matrix: m, jitter: 0.03 });
}

/** a crate of side `s` standing at `m` (its foot); `broken`: three slats of one face, the bottom and one side */
export function addCrate(kit: LowPolyKit, m: THREE.Matrix4, s: number, broken = false): void {
  const rng = kit.rng;
  const faces: [number, number, number, number, number, number][] = [[0, s / 2, 0, s, s, s]];
  for (const f of faces) {
    if (!broken) kit.add(new THREE.BoxGeometry(f[3], f[4], f[5]).translate(f[0], f[1], f[2]), rng.next() < 0.5 ? C.crate : C.crateB, { matrix: m, jitter: 0.07 });
    else for (let k = 0; k < 4; k++) if (k !== 2) kit.add(new THREE.BoxGeometry(s, s / 4 - 0.02, 0.05).translate(0, s / 8 + (k * s) / 4, s / 2 - 0.025), C.crate, { matrix: m, jitter: 0.07 });
  }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) kit.add(new THREE.BoxGeometry(0.07, s + 0.02, 0.07).translate((x * (s - 0.05)) / 2, s / 2, (z * (s - 0.05)) / 2), C.crateB, { matrix: m });
  if (broken) { kit.add(new THREE.BoxGeometry(s, 0.05, s).translate(0, 0.025, 0), C.crateB, { matrix: m }); kit.add(new THREE.BoxGeometry(0.05, s, s).translate(-s / 2 + 0.025, s / 2, 0), C.crate, { matrix: m }); }
}

/** a rope coil of outer radius `r` lying at `m` */
export function addCoil(kit: LowPolyKit, m: THREE.Matrix4, r = 0.3): void {
  for (let k = 0; k < 3; k++) kit.add(new THREE.TorusGeometry(r - k * 0.06, 0.035, 4, 10).rotateX(Math.PI / 2).translate(0, 0.035 + k * 0.05, 0), C.rope, { matrix: m, jitter: 0.05 });
}

/** a specimen: one copy on its own at the origin, AO'd on flat ground at `floorY` */
function specimen(seed: number, floorY: number, add: (kit: LowPolyKit, m: THREE.Matrix4) => void): THREE.BufferGeometry {
  const kit = new LowPolyKit(seed);
  add(kit, new THREE.Matrix4());
  return kit.finish({ ao: { floorY } });
}

/** the baked specimens' sizes (the models' defaults and the Broken variant); other sizes scale these */
export const CRATE_SIZE = 0.8, BROKEN_SIZE = 0.7, COIL_R = 0.3;

/** The Explorer's lone cargo copies, each built exactly as the runtime specimen was (seed, foot, AO on flat ground). */
export function cargoSpecimens(): Record<'barrel' | 'barrel-lying' | 'crate' | 'crate-broken' | 'coil', THREE.BufferGeometry> {
  return {
    // a standing barrel's foot on the origin (its centre 0.45 up), a lying one's side on it
    barrel: specimen(0xba77e1, 0, (kit) => { addBarrel(kit, new THREE.Matrix4().makeTranslation(0, 0.45, 0), false); }),
    'barrel-lying': specimen(0xba77e1, 0, (kit) => { addBarrel(kit, new THREE.Matrix4().makeTranslation(0, 0.36, 0), true); }),
    crate: specimen(0xc4a7e1, 0, (kit, m) => { addCrate(kit, m, CRATE_SIZE, false); }),
    'crate-broken': specimen(0xc4a7e1, 0, (kit, m) => { addCrate(kit, m, BROKEN_SIZE, true); }),
    coil: specimen(0xc011e1, 0, (kit, m) => { addCoil(kit, m, COIL_R); }),
  };
}
/** own-space boxes of each kind (for a drawn-into copy's world box: this, carried by its matrix) */
const boxes = new Map<string, THREE.Box3>();
export function cargoBox(kind: 'barrel' | 'lying' | 'crate' | 'broken' | 'coil', size = 0.8): THREE.Box3 {
  const key = `${kind}:${size}`;
  let b = boxes.get(key);
  if (!b) {
    b = kind === 'barrel' ? new THREE.Box3(new THREE.Vector3(-0.39, -0.45, -0.39), new THREE.Vector3(0.39, 0.45, 0.39))
      : kind === 'lying' ? new THREE.Box3(new THREE.Vector3(-0.45, -0.39, -0.39), new THREE.Vector3(0.45, 0.39, 0.39))
        : kind === 'coil' ? new THREE.Box3(new THREE.Vector3(-size - 0.04, 0, -size - 0.04), new THREE.Vector3(size + 0.04, 0.18, size + 0.04))
          : new THREE.Box3(new THREE.Vector3(-size / 2 - 0.04, 0, -size / 2 - 0.04), new THREE.Vector3(size / 2 + 0.04, size + 0.01, size / 2 + 0.04));
    boxes.set(key, b);
  }
  return b;
}
