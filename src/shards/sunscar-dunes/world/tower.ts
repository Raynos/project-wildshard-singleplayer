import { addFire, SIGNAL_FIRE } from './fireFx';
import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, PointLight, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '#engine';
import { TOWER } from '../layout';
import { duneMesh, fit } from './meshes';
import { bannerGeometry, kindling, litDune, RAG, RAG_GLOW } from './places';
import { WIND } from './dunes';

// round 2 (R1C-2): a step lighter; the H4 deck's rail, post and brazier read black at dusk
const WOOD = 0xa07656, WOOD_DARK = 0x86603f, IRON = 0x6e5e56; // check pass: the rail and posts measured 16/255
export const STAIR = { count: 22, run: 0.42, width: 1.3, x: 0.75 } as const;

export interface TowerParts { root: Group; colliders: ColliderDesc[]; fire: Group; light: PointLight; brazierAt: Vector3; deckY: number }

const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);

/** A high tread's collider is a slab this thick (more than a rise, so its riser meets the tread below with no gap). */
const SLAB = 0.5;
/** Headroom under a slab that lets the player (1.8 m) walk beneath the stair; a lower tread stays solid to the sand. */
const HEADROOM = 2.3;

/**
 * The south stair's colliders, one box per tread (rise ≤ 0.35 m, run 0.42 m: autostep climbs them). The engine's
 * `treads` fill every tread down to the stair's foot, a solid wedge the player cannot pass on the sand beside the
 * tower (E374 walk check, leg tower-waymark-north). The stair is drawn open underneath (treads on two stringers), so
 * a tread with room under it is a slab and the player walks under the high end, as the drawing says.
 */
function stairColliders(foot: Vector3, rise: number, groundAt: (x: number, z: number) => number): ColliderDesc[] {
  const out: ColliderDesc[] = [], hx = STAIR.width / 2, hz = STAIR.run / 2;
  for (let i = 0; i < STAIR.count; i++) {
    const z = foot.z - (i + 0.5) * STAIR.run, top = foot.y + (i + 1) * rise;
    const sand = Math.max(groundAt(foot.x - hx, z - hz), groundAt(foot.x + hx, z - hz), groundAt(foot.x - hx, z + hz), groundAt(foot.x + hx, z + hz));
    const bottom = top - SLAB - sand >= HEADROOM ? top - SLAB : Math.min(foot.y, sand) - 0.2, hy = (top - bottom) / 2;
    out.push({ kind: 'box', x: foot.x, y: bottom + hy, z, hx, hy, hz, surface: 'wood' });
  }
  return out;
}

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
  // The deck: nine sun-weathered planks in three shades with thin gaps (round 1: one dark slab read as a flat brown floor
  // in the H4 view), on a dark frame.
  add(box(half * 2 + 0.6, 0.14, half * 2 + 0.6, dark), 0, deckY - 0.13, 0);
  const plankShades = [0xb08c68, 0x9c7a58, 0xbe9a74].map((color) => new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true }));
  const span = half * 2 + 0.6, plank = span / 9;
  for (let i = 0; i < 9; i++) add(box(plank - 0.025, 0.06, span, plankShades[(i * 2) % 3] ?? wood), -span / 2 + (i + 0.5) * plank, deckY - 0.03, 0);
  colliders.push(boxDesc({ x: cx, z: cz, hw: half + 0.3, hd: half + 0.3, rot: 0, yBottom: deckY - 0.2, yTop: deckY }, 'wood'));
  const railH = 1.0, edge = half + 0.25;
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.08], [-edge, 0, 0.08, edge * 2], [edge, 0, 0.08, edge * 2], [-edge * 0.6, edge, edge * 0.8, 0.08]] as const) {
    add(box(w, 0.08, d, dark), x, deckY + railH, z);
    colliders.push(boxDesc({ x: cx + x, z: cz + z, hw: Math.max(0.04, w / 2), hd: Math.max(0.04, d / 2), rot: 0, yBottom: deckY, yTop: deckY + railH }, 'wood'));
  }
  for (const [x, z] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge], [-edge * 0.2, edge]] as const) add(box(0.1, railH, 0.1, dark), x, deckY + railH / 2, z);
  // The mast and its crossbar over the north-east corner (round 1: on the north-west it stood in the deck view, H4).
  add(box(0.14, 4.6, 0.14, wood), half - 0.2, deckY + 2.3, -half + 0.2);
  add(box(1.3, 0.1, 0.1, wood), half - 0.2, deckY + 2.9, -half + 0.2);
  // check pass (4): a long madder pennant off the mast, the tower's mark from the spawn and from above
  const pennant = new Mesh(bannerGeometry(), new MeshStandardMaterial({ color: RAG, roughness: 0.9, side: DoubleSide, emissive: RAG_GLOW }));
  pennant.scale.set(1.5, 1.1, 1.1); pennant.position.set(cx + half - 0.2, deckY + 4.55, cz - half + 0.2); pennant.rotation.y = Math.atan2(-WIND.z, WIND.x); root.add(pennant);
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
  colliders.push(...stairColliders(foot, rise, groundAt));
  // The brazier: an iron bowl on a post, its fire hidden until the signal is lit.
  const brazierAt = new Vector3(cx - 0.4, deckY + 1.1, cz - 0.5);
  // Round 1 (R1C-1 / R1B-12): the generated waymark brazier, the H4 view's subject (it was a near-black post and bowl);
  // the code one stays the stand-in.
  const generated = duneMesh('waymark-brazier');
  if (generated) add(new Mesh(fit(generated, { size: 1.25, by: 'height', floor: 0 }), litDune()), brazierAt.x - cx, deckY, brazierAt.z - cz);
  else {
    add(new Mesh(new CylinderGeometry(0.08, 0.12, 0.9, 6), iron), brazierAt.x - cx, deckY + 0.45, brazierAt.z - cz);
    add(new Mesh(new CylinderGeometry(0.45, 0.22, 0.3, 8, 1, true), iron), brazierAt.x - cx, deckY + 1.0, brazierAt.z - cz);
  }
  const sticks = kindling(deckY + (generated ? 1.05 : 0.95), 0.8); sticks.position.x = brazierAt.x; sticks.position.z = brazierAt.z; root.add(sticks);
  colliders.push(boxDesc({ x: brazierAt.x, z: brazierAt.z, hw: 0.4, hd: 0.4, rot: 0, yBottom: deckY, yTop: deckY + 1.15 }, 'metal'));
  const fire = new Group(); fire.position.copy(brazierAt);
  // The signal fire: the brightest thing in the level, its column visible from the spawn (P2 #8, `fireFx.ts`).
  addFire(fire, SIGNAL_FIRE);
  const light = new PointLight(0xff8a3a, 0, 40, 1.6); light.position.set(0, 1.0, 0); fire.add(light);
  fire.visible = false; root.add(fire);
  return { root, colliders, fire, light, brazierAt, deckY };
}
