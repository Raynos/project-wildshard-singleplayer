import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, TorusGeometry, type BufferGeometry } from 'three';
import { boxDesc, type ColliderDesc } from '#engine';
import { STEP, apothem } from '../layout';

/**
 * The winch house on the high step (loop 5; council round 2 prep: H3, the updraft view, framed a bare island while every
 * other shard's H3 frames a built subject). A squat tapered stone tower with a timber gallery and a pitched slate roof, a
 * great spoked winch wheel on its bridge side, a teal banner: the landmark you ride the updraft toward, and the place the
 * fallen crown bridge hangs from. Code-built, one group; one box collider for the tower.
 */
export const WINCH_HOUSE = { x: STEP.x - 6, z: STEP.z - apothem(STEP) + 4.8, w: 4.6, h: 9 } as const;

function painted(g: BufferGeometry, base: number, dark: number, bands = 0): BufferGeometry {
  const p = g.getAttribute('position'), col: number[] = [], a = new Color(base), b = new Color(dark), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), n = Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.7) * 0.5 + 0.5;
    c.copy(a).lerp(b, 0.15 + 0.25 * n + (bands > 0 && Math.abs(((y * bands) % 1) - 0.5) < 0.07 ? 0.3 : 0));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); return g;
}

export function winchHouse(): { group: Group; colliders: ColliderDesc[] } {
  const group = new Group(); group.name = 'far.step.winch-house';
  const stone = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
  const timber = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 });
  const slate = new MeshStandardMaterial({ color: 0x4e5872, roughness: 0.7, metalness: 0.05, flatShading: true });
  const iron = new MeshStandardMaterial({ color: 0x3e3a40, roughness: 0.5, metalness: 0.6 });
  const { w, h } = WINCH_HOUSE;
  // the tower: four-sided, tapering, stone courses
  const tower = painted(new CylinderGeometry(w * 0.62, w * 0.74, h, 4, 6).toNonIndexed(), 0xcfc3b2, 0x8a7d70, 1.6);
  tower.rotateY(Math.PI / 4); tower.translate(0, h / 2, 0); group.add(new Mesh(tower, stone));
  // the timber gallery round the top, with posts
  const gallery = new Mesh(new BoxGeometry(w * 1.25, 0.22, w * 1.25), timber); gallery.position.y = h + 0.1; group.add(gallery);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const post = new Mesh(new BoxGeometry(0.16, 1.5, 0.16), timber); post.position.set(x * w * 0.58, h + 0.9, z * w * 0.58); group.add(post);
  }
  // the pitched slate roof
  const roof = new Mesh(new ConeGeometry(w * 1.05, 2.4, 4), slate); roof.rotation.y = Math.PI / 4; roof.position.y = h + 2.85; group.add(roof);
  const finial = new Mesh(new CylinderGeometry(0.05, 0.05, 1.1, 5), iron); finial.position.y = h + 4.5; group.add(finial);
  // the door and a window toward the updraft (+z)
  const dark = new MeshStandardMaterial({ color: 0x2c2430, roughness: 1, metalness: 0 });
  const door = new Mesh(new BoxGeometry(1.1, 1.9, 0.2), timber); door.position.set(0, 0.95, w * 0.72); group.add(door);
  const win = new Mesh(new BoxGeometry(0.6, 0.8, 0.2), dark); win.position.set(0, h * 0.68, w * 0.66); group.add(win);
  // the winch wheel on the bridge side (+x), spoked, on an iron axle
  const wheel = new Group(); wheel.position.set(w * 0.78, h * 0.42, -0.2); wheel.rotation.y = Math.PI / 2; group.add(wheel);
  wheel.add(new Mesh(new TorusGeometry(1.4, 0.09, 6, 24), timber));
  for (let i = 0; i < 8; i++) { const spoke = new Mesh(new BoxGeometry(0.08, 2.8, 0.08), timber); spoke.rotation.z = (i / 8) * Math.PI; wheel.add(spoke); }
  const axle = new Mesh(new CylinderGeometry(0.12, 0.12, 0.9, 8), iron); axle.rotation.x = Math.PI / 2; wheel.add(axle);
  // a teal banner down the face toward the updraft
  const banner = new Mesh(new BoxGeometry(0.9, 2.4, 0.03), new MeshStandardMaterial({ color: 0x2f8a8c, roughness: 0.9, metalness: 0, side: DoubleSide, emissive: 0x0c2a2a }));
  banner.position.set(-w * 0.32, h * 0.62, w * 0.62); group.add(banner);
  group.position.set(WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z);
  return { group, colliders: [boxDesc({ x: WINCH_HOUSE.x, z: WINCH_HOUSE.z, hw: w * 0.62, hd: w * 0.62, rot: 0, yBottom: STEP.y, yTop: STEP.y + h }, 'stone')] };
}
