import { Vector3, BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, type Material } from 'three';

/** Stair geometry rules (ENGINE §14): rise ≤ 0.35 m, tread ≥ 0.36 m. */
export const STAIR = { rise: 0.32, run: 0.4, width: 1.3 };
export interface TowerModel { group: Group; fire: Group; light: PointLight; flames: Mesh[]; stairSteps: number }

const UP = new Vector3(0, 1, 0);
const box = (w: number, h: number, d: number, m: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), m);
/** A beam from a to b (local metres), `t` thick. */
function beam(a: readonly [number, number, number], b: readonly [number, number, number], t: number, m: Material): Mesh {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const mesh = box(t, len, t, m); mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.quaternion.setFromUnitVectors(UP, new Vector3(dx / len, dy / len, dz / len));
  return mesh;
}

/**
 * The signal tower in local space (origin at its foot, the stair on +Z): four timber legs, X-braces, a plank deck at
 * `deck` m, a rail, a mast with a crossbar, an iron brazier. `drop` is how far the stair foot sits below the tower's foot.
 */
export function buildTower(deck: number, half: number, drop: number): TowerModel {
  const group = new Group(); group.name = 'sunscar.tower';
  const wood = new MeshStandardMaterial({ color: 0x7a5236, roughness: 0.92, flatShading: true });
  const plank = new MeshStandardMaterial({ color: 0x8a6040, roughness: 0.9, flatShading: true });
  const iron = new MeshStandardMaterial({ color: 0x241c18, roughness: 0.6, metalness: 0.5 });
  const top = half * 0.72;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(beam([sx * half, -1.2, sz * half], [sx * top, deck + 1.1, sz * top], 0.22, wood));
  const at = (y: number): number => half + (top - half) * (y + 1.2) / (deck + 2.3);
  // X-braces on every face; the south (stair) face only below the stair's sweep.
  for (const [y0, y1] of [[0.2, deck * 0.5], [deck * 0.5, deck - 0.3]] as const) {
    for (const s of [-1, 1]) {
      if (s > 0 && y1 > deck * 0.6) continue;
      group.add(beam([-at(y0), y0, s * at(y0)], [at(y1), y1, s * at(y1)], 0.12, wood), beam([at(y0), y0, s * at(y0)], [-at(y1), y1, s * at(y1)], 0.12, wood));
    }
    for (const s of [-1, 1]) group.add(beam([s * at(y0), y0, -at(y0)], [s * at(y1), y1, at(y1)], 0.12, wood), beam([s * at(y0), y0, at(y0)], [s * at(y1), y1, -at(y1)], 0.12, wood));
  }
  const floor = box(top * 2 + 0.6, 0.18, top * 2 + 0.6, plank); floor.position.y = deck - 0.09; group.add(floor);
  for (const s of [-1, 1]) {
    const rx = box(0.08, 0.08, top * 2 + 0.6, wood); rx.position.set(s * (top + 0.3), deck + 1, 0); group.add(rx);
    const rz = box(top * 2 + 0.6, 0.08, 0.08, wood); rz.position.set(0, deck + 1, -(top + 0.3)); if (s < 0) group.add(rz);
  }
  const mast = box(0.16, 4.2, 0.16, wood); mast.position.set(-top + 0.2, deck + 2.1, -top + 0.2); group.add(mast);
  const bar = box(1.6, 0.1, 0.1, wood); bar.position.set(-top + 0.2, deck + 3.5, -top + 0.2); group.add(bar);
  // The stair: one box per tread down the south face to the stair foot.
  const rise = deck + drop, steps = Math.max(1, Math.ceil(rise / STAIR.rise)), r = rise / steps;
  for (let i = 0; i < steps; i++) {
    const tread = box(STAIR.width, 0.08, STAIR.run + 0.04, plank);
    tread.position.set(0, deck - (i + 1) * r + r - 0.04, top + 0.3 + (i + 0.5) * STAIR.run); group.add(tread);
  }
  for (const s of [-1, 1]) group.add(beam([s * (STAIR.width / 2 + 0.05), deck - 0.1, top + 0.3], [s * (STAIR.width / 2 + 0.05), -drop - 0.1, top + 0.3 + steps * STAIR.run], 0.1, wood));
  // The brazier and its (unlit) fire.
  const bowl = new Mesh(new CylinderGeometry(0.5, 0.3, 0.4, 10, 1, true), iron); bowl.position.set(0, deck + 1.5, -0.6); group.add(bowl);
  const stand = new Mesh(new CylinderGeometry(0.06, 0.12, 1.3, 6), iron); stand.position.set(0, deck + 0.65, -0.6); group.add(stand);
  const fire = new Group(); fire.position.set(0, deck + 1.55, -0.6); fire.visible = false; group.add(fire);
  const flames: Mesh[] = [];
  for (const [h, rr, c, x] of [[1.8, 0.42, 0xe8480a, 0], [1.3, 0.28, 0xff8a1a, 0.08], [0.9, 0.18, 0xffc040, -0.06]] as const) {
    const flame = new Mesh(new ConeGeometry(rr, h, 8, 1, true), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92, depthWrite: false }));
    flame.position.set(x, h / 2, 0); flame.userData['noFog'] = true; fire.add(flame); flames.push(flame);
  }
  const light = new PointLight(0xff8a3a, 0, 32, 1.4); light.position.set(0, deck + 2.4, -0.6); group.add(light);
  return { group, fire, light, flames, stairSteps: steps };
}
