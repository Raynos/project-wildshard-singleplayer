import { AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { DECK } from '../layout';

const WOOD = 0x4b3424, WOOD_DARK = 0x2e2017, IRON = 0x1d1a18;
const UP = new Vector3(0, 1, 0);
type P3 = readonly [number, number, number];
/** A square beam from a to b (local metres), `t` thick. */
function beam(material: MeshStandardMaterial, a: P3, b: P3, t: number): Mesh {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const mesh = new Mesh(new BoxGeometry(t, len, t), material);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  return mesh;
}
/** Where the stair starts and ends, in the tower's local frame (it climbs toward +Z onto the deck's south edge). */
export const STAIR = { x: 0, z0: -DECK.half - DECK.stairRun, z1: -DECK.half, steps: 16 };
export const LEG = 1.4;
export const BRAZIER: P3 = [0.9, DECK.height + 0.15, 0.9];

/** The wooden signal tower: four braced legs, a plank deck with rails, a mast and cross, a stair, and the iron brazier. */
export function buildTower(): { tower: Group; fire: Group; light: PointLight } {
  const tower = new Group(), wood = new MeshStandardMaterial({ color: WOOD, roughness: 0.9 }), dark = new MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.95 });
  const h = DECK.height;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower.add(beam(wood, [sx * (LEG + 0.25), 0, sz * (LEG + 0.25)], [sx * LEG, h, sz * LEG], 0.2));
  for (let level = 0; level < 2; level++) {
    const y0 = level * h / 2 + 0.3, y1 = (level + 1) * h / 2;
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
      tower.add(beam(dark, [ax * LEG, y0, az * LEG], [bx * LEG, y1, bz * LEG], 0.08), beam(dark, [bx * LEG, y0, bz * LEG], [ax * LEG, y1, az * LEG], 0.08));
      tower.add(beam(wood, [ax * LEG, y1, az * LEG], [bx * LEG, y1, bz * LEG], 0.12));
    }
  }
  const deck = new Mesh(new BoxGeometry(DECK.half * 2, 0.16, DECK.half * 2), wood); deck.position.y = h - 0.08; tower.add(deck);
  // Rails on three sides; the south side stays open where the stair lands.
  for (const [ax, az, bx, bz] of [[-1, -1, -0.45, -1], [0.45, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
    tower.add(beam(dark, [ax * DECK.half, h + 1, az * DECK.half], [bx * DECK.half, h + 1, bz * DECK.half], 0.07));
    tower.add(beam(dark, [ax * DECK.half, h, az * DECK.half], [ax * DECK.half, h + 1.05, az * DECK.half], 0.09));
  }
  tower.add(beam(wood, [-0.9, h, -0.9], [-0.9, h + 3.4, -0.9], 0.14), beam(wood, [-1.6, h + 2.7, -0.9], [-0.2, h + 2.7, -0.9], 0.1));
  // The stair: two stringers and the treads.
  for (const sx of [-1, 1]) tower.add(beam(dark, [STAIR.x + sx * (DECK.stairWidth / 2 + 0.05), 0, STAIR.z0], [STAIR.x + sx * (DECK.stairWidth / 2 + 0.05), h, STAIR.z1], 0.1));
  for (let i = 0; i < STAIR.steps; i++) {
    const tread = new Mesh(new BoxGeometry(DECK.stairWidth, 0.06, DECK.stairRun / STAIR.steps + 0.04), wood);
    tread.position.set(STAIR.x, (i + 1) * h / STAIR.steps - 0.03, STAIR.z0 + (i + 0.5) * DECK.stairRun / STAIR.steps); tower.add(tread);
  }
  const iron = new MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.6 });
  const basket = new Mesh(new CylinderGeometry(0.45, 0.3, 0.45, 10, 1, true), iron); basket.position.set(BRAZIER[0], BRAZIER[1] + 0.2, BRAZIER[2]);
  const stand = new Mesh(new CylinderGeometry(0.06, 0.12, 0.2, 6), iron); stand.position.set(BRAZIER[0], BRAZIER[1] - 0.05, BRAZIER[2]);
  const logs = new Group();
  for (let i = 0; i < 4; i++) { const log = new Mesh(new CylinderGeometry(0.05, 0.05, 0.6, 5), dark); log.rotation.set(Math.PI / 2, 0, i * Math.PI / 4); log.position.set(BRAZIER[0], BRAZIER[1] + 0.3, BRAZIER[2]); logs.add(log); }
  tower.add(basket, stand, logs);
  const fire = new Group(), flame = new MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  const core = new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const cone = new Mesh(new ConeGeometry(0.22 - i * 0.02, 0.9 + (i % 3) * 0.35, 7), i < 2 ? core : flame);
    const a = i * 1.3; cone.position.set(BRAZIER[0] + Math.cos(a) * 0.14 * (i > 0 ? 1 : 0), BRAZIER[1] + 0.75 + (i % 3) * 0.12, BRAZIER[2] + Math.sin(a) * 0.14 * (i > 0 ? 1 : 0));
    fire.add(cone);
  }
  const light = new PointLight(0xff8a3a, 0, 40, 1.6); light.position.set(BRAZIER[0], BRAZIER[1] + 1.2, BRAZIER[2]); fire.add(light);
  fire.visible = false; tower.add(fire);
  return { tower, fire, light };
}
