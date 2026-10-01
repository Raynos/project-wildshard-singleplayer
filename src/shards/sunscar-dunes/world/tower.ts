import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '#engine';
import { TOWER } from '../layout';

const WOOD = 0x4a2e1e, WOOD_DARK = 0x2c1b14, IRON = 0x231c1c;
export const STAIR = { count: 22, run: 0.42, width: 1.3, x: 0.75 } as const;

export interface TowerParts { root: Group; colliders: ColliderDesc[]; fire: Group; light: PointLight; brazierAt: Vector3; deckY: number }

const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);

/**
 * The signal tower: four legs to a 7 m deck, cross braces, a rail, a mast with a crossbar, a south stair (treads)
 * and an iron brazier whose fire shows once lit. Built in world coordinates at `TOWER`, on ground `y` metres high.
 */
export function buildTower(y: number, groundAt: (x: number, z: number) => number): TowerParts {
  const root = new Group(), colliders: ColliderDesc[] = [];
  const wood = new MeshStandardMaterial({ color: WOOD, roughness: 0.9, flatShading: true });
  const dark = new MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.95, flatShading: true });
  const iron = new MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.4, flatShading: true });
  const { x: cx, z: cz, deck, half } = TOWER, deckY = y + deck;
  const add = (mesh: Mesh, x: number, my: number, z: number): Mesh => { mesh.position.set(cx + x, my, cz + z); root.add(mesh); return mesh; };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * half, z = sz * half, foot = Math.min(y, groundAt(cx + x, cz + z)) - 0.6, h = deckY - foot;
    add(box(0.24, h, 0.24, wood), x, foot + h / 2, z);
    colliders.push(boxDesc({ x: cx + x, z: cz + z, hw: 0.12, hd: 0.12, rot: 0, yBottom: foot, yTop: deckY }, 'wood'));
  }
  // Diagonal braces on the four faces, two tiers.
  for (const tier of [0, 1]) {
    const y0 = y + 0.6 + tier * 3.1, span = Math.hypot(half * 2, 3.1), tilt = Math.atan2(3.1, half * 2);
    for (const [side, along] of [[-1, 'x'], [1, 'x'], [-1, 'z'], [1, 'z']] as const) {
      const brace = box(0.1, 0.12, span, dark);
      if (along === 'x') { brace.rotation.set(0, Math.PI / 2, 0); brace.rotateX(tier === 0 ? -tilt : tilt); add(brace, 0, y0 + 1.55, side * half); }
      else { brace.rotateX(tier === 0 ? -tilt : tilt); add(brace, side * half, y0 + 1.55, 0); }
    }
  }
  // The deck and its rail (open on the south, where the stair lands).
  add(box(half * 2 + 0.6, 0.2, half * 2 + 0.6, wood), 0, deckY - 0.1, 0);
  colliders.push(boxDesc({ x: cx, z: cz, hw: half + 0.3, hd: half + 0.3, rot: 0, yBottom: deckY - 0.2, yTop: deckY }, 'wood'));
  const railH = 1.0, edge = half + 0.25;
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.08], [-edge, 0, 0.08, edge * 2], [edge, 0, 0.08, edge * 2], [-edge * 0.6, edge, edge * 0.8, 0.08]] as const) {
    add(box(w, 0.08, d, dark), x, deckY + railH, z);
    colliders.push(boxDesc({ x: cx + x, z: cz + z, hw: Math.max(0.04, w / 2), hd: Math.max(0.04, d / 2), rot: 0, yBottom: deckY, yTop: deckY + railH }, 'wood'));
  }
  for (const [x, z] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge], [-edge * 0.2, edge]] as const) add(box(0.1, railH, 0.1, dark), x, deckY + railH / 2, z);
  // The mast and its crossbar over the north-west corner.
  add(box(0.14, 3.4, 0.14, wood), -half + 0.2, deckY + 1.7, -half + 0.2);
  add(box(1.3, 0.1, 0.1, wood), -half + 0.2, deckY + 2.9, -half + 0.2);
  // The south stair: 22 treads from the sand to the deck edge.
  const top = new Vector3(cx + STAIR.x, deckY, cz + edge), foot = new Vector3(top.x, 0, top.z + STAIR.count * STAIR.run);
  foot.y = groundAt(foot.x, foot.z);
  const rise = (top.y - foot.y) / STAIR.count;
  for (let i = 0; i < STAIR.count; i++) {
    const tread = box(STAIR.width, 0.08, STAIR.run * 0.9, wood);
    tread.position.set(foot.x, foot.y + (i + 1) * rise - 0.04, foot.z - (i + 0.5) * STAIR.run); root.add(tread);
  }
  const run = top.z - foot.z, length = Math.hypot(run, top.y - foot.y), pitch = Math.atan2(top.y - foot.y, -run);
  for (const side of [-1, 1]) {
    const stringer = box(0.08, 0.22, length, dark); stringer.rotation.x = pitch;
    stringer.position.set(foot.x + side * (STAIR.width / 2 + 0.04), (foot.y + top.y) / 2, (foot.z + top.z) / 2); root.add(stringer);
  }
  colliders.push({ kind: 'treads', from: { x: foot.x, y: foot.y, z: foot.z }, to: { x: top.x, y: top.y, z: top.z }, width: STAIR.width, count: STAIR.count, surface: 'wood' });
  // The brazier: an iron bowl on a post, its fire hidden until the signal is lit.
  const brazierAt = new Vector3(cx - 0.4, deckY + 1.1, cz - 0.5);
  add(new Mesh(new CylinderGeometry(0.08, 0.12, 0.9, 6), iron), brazierAt.x - cx, deckY + 0.45, brazierAt.z - cz);
  add(new Mesh(new CylinderGeometry(0.45, 0.22, 0.3, 8, 1, true), iron), brazierAt.x - cx, deckY + 1.0, brazierAt.z - cz);
  colliders.push(boxDesc({ x: brazierAt.x, z: brazierAt.z, hw: 0.4, hd: 0.4, rot: 0, yBottom: deckY, yTop: deckY + 1.15 }, 'metal'));
  const fire = new Group(); fire.position.copy(brazierAt);
  const flame = (r: number, h: number, color: number, x: number, z: number): void => {
    const cone = new Mesh(new ConeGeometry(r, h, 7), new MeshBasicMaterial({ color })); cone.position.set(x, h / 2, z); fire.add(cone);
  };
  flame(0.36, 1.3, 0xff7a1e, 0, 0); flame(0.22, 1.7, 0xffb347, 0.06, -0.04); flame(0.12, 1.0, 0xffe6a0, -0.08, 0.05);
  const light = new PointLight(0xff8a3a, 0, 40, 1.6); light.position.set(0, 1.0, 0); fire.add(light);
  fire.visible = false; root.add(fire);
  return { root, colliders, fire, light, brazierAt, deckY };
}
