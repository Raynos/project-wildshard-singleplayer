import { addFire, addLampGlow, KEEPER_LAMP, SIGNAL_FIRE } from './fireFx';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { TOWER } from '../data/layout';
import { duneHd, duneMesh, fit } from './meshes';
import { kindling, litDune } from './places';

// E399 (council round 1, D4: the mockups' tower is a tall dark steel lattice with an antenna, not pale wood): dark steel
// with a warm sheen; the deck a grating a step lighter, so the H4 deck view still reads (round 2, R1C-2)
const WOOD = 0x3a322e, WOOD_DARK = 0x2a2420, IRON = 0x6e5e56;
/** The lattice crown over the deck (m): corner posts to a top frame, then the antenna. */
export const CROWN = { posts: 7.5, antenna: 4.2 } as const; // E399 (council round 1, D4: the mockups' tower is about twice ours): ~20 m to the lamp
// round 20 (the walk test: the dunes round the tower moved, so 22 treads from the sand at 19.2 m to the deck rose 0.42 m
// each, over the player's 0.35 m step; leg waymark-west-tower stuck at the foot): 30 treads, ~0.32 m each
export const STAIR = { count: 30, run: 0.42, width: 1.3, x: 0.75 } as const;

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
  const wood = new MeshStandardMaterial({ color: WOOD, roughness: 0.55, metalness: 0.5 });
  const dark = new MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.6, metalness: 0.5 });
  const iron = new MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.4, flatShading: true });
  const { x: cx, z: cz, deck, half } = TOWER, deckY = y + deck;
  const add = (mesh: Mesh, x: number, my: number, z: number): Mesh => { mesh.position.set(cx + x, my, cz + z); root.add(mesh); return mesh; };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * half, z = sz * half, foot = Math.min(y, groundAt(cx + x, cz + z)) - 0.6, h = deckY - foot;
    add(box(0.24, h, 0.24, wood), x, foot + h / 2, z);
    colliders.push(boxDesc({ x: cx + x, z: cz + z, hw: 0.12, hd: 0.12, rot: 0, yBottom: foot, yTop: deckY }, 'wood'));
  }
  // The lattice (E399, D4): X braces on the four faces in three tiers, a strut at each tier's top.
  const tierH = (deck - 0.6) / 3;
  for (let tier = 0; tier < 3; tier++) {
    const y0 = y + 0.6 + tier * tierH, span = Math.hypot(half * 2, tierH), tilt = Math.atan2(tierH, half * 2);
    for (const [side, along] of [[-1, 'x'], [1, 'x'], [-1, 'z'], [1, 'z']] as const) {
      for (const lean of [-tilt, tilt]) {
        const brace = box(0.07, 0.09, span, dark);
        if (along === 'x') { brace.rotation.set(0, Math.PI / 2, 0); brace.rotateX(lean); add(brace, 0, y0 + tierH / 2, side * half); }
        else { brace.rotateX(lean); add(brace, side * half, y0 + tierH / 2, 0); }
      }
      const strut = box(along === 'x' ? half * 2 : 0.09, 0.09, along === 'x' ? 0.09 : half * 2, dark);
      add(strut, along === 'x' ? 0 : side * half, y0 + tierH, along === 'x' ? side * half : 0);
    }
  }
  // The deck and its rail (open on the south, where the stair lands).
  // The deck: nine sun-weathered planks in three shades with thin gaps (round 1: one dark slab read as a flat brown floor
  // in the H4 view), on a dark frame.
  add(box(half * 2 + 0.6, 0.14, half * 2 + 0.6, dark), 0, deckY - 0.13, 0);
  const plankShades = [0x5a4c42, 0x4e423a, 0x64544a].map((color) => new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.35 }));
  const span = half * 2 + 0.6, plank = span / 9;
  for (let i = 0; i < 9; i++) add(box(plank - 0.025, 0.06, span, plankShades[(i * 2) % 3] ?? wood), -span / 2 + (i + 0.5) * plank, deckY - 0.03, 0);
  colliders.push(boxDesc({ x: cx, z: cz, hw: half + 0.3, hd: half + 0.3, rot: 0, yBottom: deckY - 0.2, yTop: deckY }, 'wood'));
  const railH = 1.0, edge = half + 0.25;
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.08], [-edge, 0, 0.08, edge * 2], [edge, 0, 0.08, edge * 2], [-edge * 0.6, edge, edge * 0.8, 0.08]] as const) {
    add(box(w, 0.08, d, dark), x, deckY + railH, z);
    colliders.push(boxDesc({ x: cx + x, z: cz + z, hw: Math.max(0.04, w / 2), hd: Math.max(0.04, d / 2), rot: 0, yBottom: deckY, yTop: deckY + railH }, 'wood'));
  }
  for (const [x, z] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge], [-edge * 0.2, edge]] as const) add(box(0.1, railH, 0.1, dark), x, deckY + railH / 2, z);
  // The crown (E399, D4): four corner posts up from the rail to a top frame, X-braced on the three closed faces above the
  // rail (the south face stays open over the stair), then the antenna with its crossbar and a red lamp.
  const topY = deckY + CROWN.posts;
  for (const [x, z] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]] as const) add(box(0.12, CROWN.posts - railH, 0.12, wood), x, deckY + railH + (CROWN.posts - railH) / 2, z);
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.1], [0, edge, edge * 2, 0.1], [-edge, 0, 0.1, edge * 2], [edge, 0, 0.1, edge * 2]] as const) add(box(w, 0.12, d, dark), x, topY, z);
  // two tiers of X braces above the rail, a strut between them on all four faces
  const upH = (CROWN.posts - railH) / 2, upSpan = Math.hypot(edge * 2, upH), upTilt = Math.atan2(upH, edge * 2);
  for (let tier = 0; tier < 2; tier++) {
    const mid = deckY + railH + upH * (tier + 0.5);
    for (const [side, along] of [[-1, 'x'], [-1, 'z'], [1, 'z']] as const) for (const lean of [-upTilt, upTilt]) {
      const brace = box(0.06, 0.08, upSpan, dark);
      if (along === 'x') { brace.rotation.set(0, Math.PI / 2, 0); brace.rotateX(lean); add(brace, 0, mid, side * edge); }
      else { brace.rotateX(lean); add(brace, side * edge, mid, 0); }
    }
  }
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.08], [0, edge, edge * 2, 0.08], [-edge, 0, 0.08, edge * 2], [edge, 0, 0.08, edge * 2]] as const) add(box(w, 0.09, d, dark), x, deckY + railH + upH, z);
  // a pyramid of four rods from the top frame's corners to the antenna's foot
  const apex = new Vector3(0, topY + 1.4, 0);
  for (const [x, z] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]] as const) {
    const from = new Vector3(x, topY, z), len = from.distanceTo(apex), rod = box(0.07, 0.07, len, wood);
    rod.position.set(cx + (x + apex.x) / 2, (topY + apex.y) / 2, cz + (z + apex.z) / 2); rod.lookAt(cx + apex.x, apex.y, cz + apex.z); root.add(rod);
  }
  add(new Mesh(new CylinderGeometry(0.035, 0.06, CROWN.antenna, 6), wood), 0, apex.y + CROWN.antenna / 2, 0);
  add(box(1.1, 0.05, 0.05, wood), 0, apex.y + CROWN.antenna * 0.62, 0);
  add(new Mesh(new CylinderGeometry(0.09, 0.09, 0.14, 8), new MeshStandardMaterial({ color: 0x3a0a06, emissive: 0xff2a10, emissiveIntensity: 1.6 })), 0, apex.y + CROWN.antenna + 0.07, 0);
  // The keeper's lantern (round 8, mockup dusk-fire: a lamp burns in the tower's top before the signal is lit; the council: an
  // empty cage): hung under the crown's top frame, a lit glass in an iron cage, its small halo (fireFx addLampGlow)
  // (round 8 first cut: a 0.3 m glass under the frame read as a pale dot against the bright afterglow at 145 m)
  const keeperLamp = new Group(); keeperLamp.position.set(cx, topY + 0.45, cz); root.add(keeperLamp);
  const glass = new MeshBasicMaterial({ color: 0xffb860 }); glass.color.multiplyScalar(3.5); // past 1: the tone mapper whites its core
  keeperLamp.add(new Mesh(new BoxGeometry(0.6, 0.75, 0.6), glass));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { const bar = box(0.06, 0.85, 0.06, iron); bar.position.set(dx * 0.32, 0, dz * 0.32); keeperLamp.add(bar); }
  { const cap = box(0.8, 0.1, 0.8, iron); cap.position.y = 0.45; keeperLamp.add(cap); }
  addLampGlow(keeperLamp, 1.1, () => deckY - (topY + 0.45)); // round 12: 2.6 m read as a wash, not a lamp
  { const flame = new Group(); flame.position.y = 0.5; keeperLamp.add(flame); addFire(flame, KEEPER_LAMP); } // round 10 (R9B-8): the open flame over the cap (inside the glass it read as a pale box) // its flame (a lit glass alone read as a pale dot)
  // The south stair: STAIR.count treads from the sand to the deck edge.
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
  const hdBrazier = duneHd('brazier-hd', { size: 1.15, by: 'height', floor: 0 }); // a deck-sized one
  const generated = hdBrazier ? null : duneMesh('waymark-brazier');
  if (hdBrazier) { hdBrazier.position.set(brazierAt.x, deckY, brazierAt.z); root.add(hdBrazier); }
  else if (generated) add(new Mesh(fit(generated, { size: 1.25, by: 'height', floor: 0 }), litDune()), brazierAt.x - cx, deckY, brazierAt.z - cz);
  else {
    add(new Mesh(new CylinderGeometry(0.08, 0.12, 0.9, 6), iron), brazierAt.x - cx, deckY + 0.45, brazierAt.z - cz);
    add(new Mesh(new CylinderGeometry(0.45, 0.22, 0.3, 8, 1, true), iron), brazierAt.x - cx, deckY + 1.0, brazierAt.z - cz);
  }
  const sticks = kindling(deckY + (generated ? 1.05 : 0.95), 0.8); sticks.visible = hdBrazier === null; sticks.position.x = brazierAt.x; sticks.position.z = brazierAt.z; root.add(sticks);
  colliders.push(boxDesc({ x: brazierAt.x, z: brazierAt.z, hw: 0.4, hd: 0.4, rot: 0, yBottom: deckY, yTop: deckY + 1.15 }, 'metal'));
  const fire = new Group(); fire.position.copy(brazierAt);
  // The signal fire: the brightest thing in the level, its column visible from the spawn (P2 #8, `fireFx.ts`).
  addFire(fire, SIGNAL_FIRE);
  const light = new PointLight(0xff8a3a, 0, 40, 1.6); light.position.set(0, 1.0, 0); fire.add(light);
  fire.visible = false; root.add(fire);
  return { root, colliders, fire, light, brazierAt, deckY };
}
