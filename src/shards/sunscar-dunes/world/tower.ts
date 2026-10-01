/**
 * The wooden signal tower: four splayed posts, cross bracing, a plank deck with a rail, a stair up the south side and
 * an iron fire basket stacked with wood. All the timber is one merged mesh (one draw), the iron another. The fire is
 * a real fire: flickering flame cones and one warm point light, off until the player lights it.
 */
import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Quaternion, Vector3 } from 'three';

export const TOWER_SIZE = { deck: 7, half: 2, legs: 1.75, stairRun: 0.4, stairRise: 0.32, stairWidth: 1.1 } as const;

/** Concatenate indexed geometries (position, normal, uv) into one. */
export function mergeBoxes(parts: BufferGeometry[]): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const part of parts) {
    const base = pos.length / 3, p = part.getAttribute('position'), n = part.getAttribute('normal'), index = part.getIndex();
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (index) for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
    part.dispose();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3)); g.setIndex(idx);
  return g;
}

const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(1, 1, 1), _a = new Vector3(), _d = new Vector3(), _y = new Vector3(0, 1, 0);
/** A beam of square section `w` from a to b. */
function beam(a: Vector3, b: Vector3, w: number): BufferGeometry {
  const g = new BoxGeometry(w, a.distanceTo(b), w);
  _d.subVectors(b, a).normalize(); _q.setFromUnitVectors(_y, _d);
  g.applyMatrix4(_m.compose(_a.addVectors(a, b).multiplyScalar(0.5), _q, _s)); return g;
}
function box(x: number, y: number, z: number, w: number, h: number, d: number): BufferGeometry { const g = new BoxGeometry(w, h, d); g.translate(x, y, z); return g; }

export interface TowerParts { root: Group; fire: Group; light: PointLight; flames: Mesh[]; stairFoot: number; stairCount: number }

/**
 * Built at the origin of its group: the deck top at `deck`, the ground at 0 under the tower, `footDrop` metres lower
 * at the stair's foot (the crest falls away to the south).
 */
export function buildTower(footDrop: number): TowerParts {
  const root = new Group(), { deck, half, legs } = TOWER_SIZE, wood: BufferGeometry[] = [], iron: BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wood.push(beam(new Vector3(sx * (legs + 0.35), -1.5, sz * (legs + 0.35)), new Vector3(sx * legs, deck + 1.1, sz * legs), 0.2));
  }
  // cross bracing on all four faces, two storeys
  for (const [y0, y1] of [[0.2, deck * 0.5], [deck * 0.5, deck - 0.2]] as const) for (const face of [0, 1, 2, 3]) {
    const along = face < 2 ? 'x' : 'z', s = face % 2 === 0 ? -1 : 1, w0 = legs + 0.35 * (1 - y0 / deck), w1 = legs + 0.35 * (1 - y1 / deck);
    const p = (u: number, y: number, w: number): Vector3 => along === 'x' ? new Vector3(u * w, y, s * w) : new Vector3(s * w, y, u * w);
    wood.push(beam(p(-1, y0, w0), p(1, y1, w1), 0.09), beam(p(1, y0, w0), p(-1, y1, w1), 0.09));
  }
  // the plank deck, its joists and a rail on three sides (the stair comes up the south, +z)
  for (let i = 0; i < 9; i++) wood.push(box(-half + 0.22 + i * 0.445, deck - 0.06, 0, 0.42, 0.08, half * 2));
  wood.push(box(0, deck - 0.2, -half + 0.1, half * 2, 0.16, 0.16), box(0, deck - 0.2, half - 0.1, half * 2, 0.16, 0.16));
  for (const [x, z, w, d] of [[0, -half, half * 2, 0.08], [-half, 0, 0.08, half * 2], [half, 0, 0.08, half * 2]] as const) {
    wood.push(box(x, deck + 1.0, z, w, 0.08, d), box(x, deck + 0.5, z, w, 0.06, d));
  }
  // the stair down the south side to the falling sand
  const rise = deck + footDrop, count = Math.ceil(rise / TOWER_SIZE.stairRise), run = TOWER_SIZE.stairRun, step = rise / count;
  for (let i = 0; i < count; i++) wood.push(box(0.6, deck - step * i - step * 0.5 + 0.02, half + run * (i + 0.5), TOWER_SIZE.stairWidth, 0.07, run * 0.92));
  for (const x of [0.6 - TOWER_SIZE.stairWidth / 2, 0.6 + TOWER_SIZE.stairWidth / 2]) wood.push(beam(new Vector3(x, deck, half), new Vector3(x, -footDrop - 0.2, half + run * count), 0.12));
  // a signal mast at the north-west corner with a cross arm, so the tower reads from the spawn
  wood.push(beam(new Vector3(-half + 0.15, deck, -half + 0.15), new Vector3(-half + 0.15, deck + 4.2, -half + 0.15), 0.12));
  wood.push(beam(new Vector3(-half - 0.7, deck + 3.6, -half + 0.15), new Vector3(-half + 1.0, deck + 3.6, -half + 0.15), 0.08));
  // the fire basket: an iron bowl on a post, stacked with split wood
  iron.push(box(0, deck + 0.35, 0, 0.14, 0.7, 0.14));
  const bowl = new CylinderGeometry(0.55, 0.32, 0.4, 10, 1, true); bowl.translate(0, deck + 0.9, 0); iron.push(bowl);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; wood.push(beam(new Vector3(Math.cos(a) * 0.4, deck + 0.75, Math.sin(a) * 0.4), new Vector3(-Math.cos(a) * 0.1, deck + 1.35, -Math.sin(a) * 0.1), 0.08)); }
  const timber = new Mesh(mergeBoxes(wood), new MeshStandardMaterial({ color: 0x5e4129, roughness: 0.92, metalness: 0 }));
  const basket = new Mesh(mergeBoxes(iron), new MeshStandardMaterial({ color: 0x23201e, roughness: 0.6, metalness: 0.6, side: DoubleSide }));
  timber.castShadow = true; timber.receiveShadow = true; basket.castShadow = true;
  root.add(timber, basket);
  // the fire (off): three flame cones and a warm light
  const fire = new Group(); fire.position.set(0, deck + 1.05, 0); fire.visible = false;
  const flameMat = new MeshBasicMaterial({ color: 0xff4a08, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const coreMat = new MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const flames = [new Mesh(new ConeGeometry(0.5, 2.0, 8, 1, true), flameMat), new Mesh(new ConeGeometry(0.34, 1.5, 8, 1, true), flameMat), new Mesh(new ConeGeometry(0.3, 1.2, 8, 1, true), flameMat), new Mesh(new ConeGeometry(0.22, 0.9, 8, 1, true), coreMat)];
  for (const [i, f] of flames.entries()) { f.geometry.translate(0, 0.45, 0); f.position.set(Math.cos(i * 2.1) * 0.14 * Math.min(1, i), 0, Math.sin(i * 2.1) * 0.14 * Math.min(1, i)); fire.add(f); }
  const light = new PointLight(0xff7a30, 0, 40, 1.6); light.position.y = 0.9; fire.add(light);
  root.add(fire);
  return { root, fire, light, flames, stairFoot: half + run * count, stairCount: count };
}

/** The flicker: each cone breathes on its own beat, the light follows the biggest. */
export function flicker(parts: TowerParts, t: number): void {
  for (const [i, f] of parts.flames.entries()) {
    const k = 1 + Math.sin(t * (9 + i * 3.1)) * 0.12 + Math.sin(t * (14.3 + i * 5.7)) * 0.08;
    f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.rotation.y = t * (0.6 + i * 0.4);
  }
  parts.light.intensity = 26 * (0.85 + Math.sin(t * 11.3) * 0.08 + Math.sin(t * 23.1) * 0.05);
}
