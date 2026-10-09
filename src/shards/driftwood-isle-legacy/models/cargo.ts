/**
 * The wreck's cargo (E306 / E315 M1, second pass: models on the contract, src/engine/models/model.ts; they were helpers inside
 * src/shards/driftwood-isle/world/Wreck.ts): the BARREL (a bulged stave cask with two iron bands, standing or lying on its side), the CRATE
 * (a plank box with corner posts, or a broken one: three slats, a bottom and one side left) and the ROPE COIL (three
 * stacked turns). Flat-shaded LowPolyKit parts, painted per face; a barrel picks its stain from the stream it is given.
 *
 * Each builds in its own space, its foot at the origin (a lying barrel's axis at the origin). The wreck
 * (src/shards/driftwood-isle/world/Wreck.ts) adds them into its one kit — the hold's stacks and the beach's strays, in the order it always
 * did, from its one stream — so they share its baked AO and lantern light, and places each model `drawnInto` its mesh
 * (their collision stays the wreck's boxes, one per stack). The Explorer's specimen is one copy on its own, AO'd on the
 * ground.
 *
 *   addBarrel(kit, matrix, lying);  addCrate(kit, matrix, size, broken);  addCoil(kit, matrix, r);
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';

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
function specimen(ctx: ModelContext, seed: number, floorY: number, add: (kit: LowPolyKit, m: THREE.Matrix4) => void): ModelPart[] {
  const kit = new LowPolyKit(seed);
  add(kit, new THREE.Matrix4());
  return [{ geometry: kit.finish({ ao: { floorY } }), material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true }];
}

export interface BarrelParams { readonly lying: boolean }
export const barrel = defineModel<BarrelParams>({
  id: 'driftwood-isle/barrel', name: 'Barrel', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { lying: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'lying', label: 'Lying', params: { lying: true } }],
  // the specimen: a standing barrel's foot on the origin (its centre 0.45 up), a lying one's side on it
  build: (ctx, p) => specimen(ctx, 0xba77e1, 0, (kit) => { addBarrel(kit, new THREE.Matrix4().makeTranslation(0, p.lying ? 0.36 : 0.45, 0), p.lying); }),
});

export interface CrateParams { readonly size: number; readonly broken: boolean }
export const crate = defineModel<CrateParams>({
  id: 'driftwood-isle/crate', name: 'Crate', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { size: 0.8, broken: false },
  variants: [
    { id: 'big', label: 'Big', params: {} }, { id: 'small', label: 'Small', params: { size: 0.55 } },
    { id: 'broken', label: 'Broken', params: { size: 0.7, broken: true } },
  ],
  build: (ctx, p) => specimen(ctx, 0xc4a7e1, 0, (kit, m) => { addCrate(kit, m, p.size, p.broken); }),
});

export interface CoilParams { readonly r: number }
export const ropeCoil = defineModel<CoilParams>({
  id: 'driftwood-isle/rope-coil', name: 'Rope coil', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { r: 0.3 },
  build: (ctx, p) => specimen(ctx, 0xc011e1, 0, (kit, m) => { addCoil(kit, m, p.r); }),
});

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
