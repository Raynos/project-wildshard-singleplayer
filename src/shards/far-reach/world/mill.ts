import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshStandardMaterial, Vector2, type BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The windmill (loop 5; mockup A and the style bible's "white stone tower, slate cap, cloth sails"): a code-built tower
 * mill, the first frame's subject. A tapered round tower of whitewashed stone (faint courses, weathered and mossy at its
 * foot, warm in the low sun), a dark wooden door and three small windows up the side facing the spawn, a timber curb
 * under an ogee slate cap, and four lattice sails, each a spar with a frame of bars and a cream cloth over most of it.
 * The hub turns (the plugin spins it). Local frame: base at y 0, the sails face +z.
 */
export const MILL = { base: 2.5, top: 1.7, height: 8.6, cap: 2.9, sail: 7.4 } as const;

function paintGeometry(g: BufferGeometry, color: (x: number, y: number, z: number) => Color): BufferGeometry {
  const p = g.getAttribute('position'), col: number[] = [];
  for (let i = 0; i < p.count; i++) { const c = color(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); return g;
}

const hash = (a: number, b: number): number => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

/** The windows' headings (radians from +z toward +x) and heights: the weather streaks run down from them. */
const WINDOWS: readonly (readonly [number, number])[] = [[3.6, 0.5], [5.4, -0.35], [7.0, 0.15]];

function tower(): BufferGeometry {
  const pts: Vector2[] = [];
  // a slight flare at the foot, a straight taper, a lip under the curb
  pts.push(new Vector2(0, 0), new Vector2(MILL.base + 0.25, 0), new Vector2(MILL.base + 0.15, 0.5));
  for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push(new Vector2(MILL.base + (MILL.top - MILL.base) * t, 0.5 + (MILL.height - 0.5) * t)); }
  pts.push(new Vector2(MILL.top + 0.12, MILL.height + 0.02), new Vector2(0, MILL.height + 0.02));
  const g = new LatheGeometry(pts, 48).toNonIndexed();
  // whitewashed stone blocks (council round 2: "a plain cream windmill"): each course and block its own tone, the joints
  // staggered; grey-brown streaks run down under the windows; grime and moss at the foot; warm where the sun reaches
  const lime = new Color(0xf1e9da), block = new Color(0xd9ccb8), stain = new Color(0x9c8c78), dirt = new Color(0x8f7c66), moss = new Color(0x7d8a48), out = new Color();
  const p = g.getAttribute('position'), col: number[] = [];
  for (let k = 0; k < p.count; k += 3) {
    // colour per face (flat blocks), from the face's centre
    let cx = 0, cy = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += p.getX(k + v) / 3; cy += p.getY(k + v) / 3; cz += p.getZ(k + v) / 3; }
    const a = Math.atan2(cx, cz), course = Math.floor(cy / 0.42), blockN = Math.floor(((a / (Math.PI * 2)) + 0.5) * 22 + (course % 2) * 0.5);
    out.copy(lime).lerp(block, 0.25 + 0.5 * hash(course, blockN));
    for (const [wy, wa] of WINDOWS) {
      let da = Math.abs(a - wa); da = Math.min(da, Math.PI * 2 - da);
      if (cy < wy && da < 0.09) out.lerp(stain, (1 - da / 0.09) * 0.45 * Math.max(0, 1 - (wy - cy) / 3));
    }
    if (cy < 1.4) out.lerp(dirt, ((1.4 - cy) / 1.4) * 0.6);
    if (cy < 0.6 && hash(blockN, 7) > 0.5) out.lerp(moss, 0.45);
    for (let v = 0; v < 3; v++) col.push(out.r, out.g, out.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

function cap(): BufferGeometry {
  // an ogee: a bulge, a waist, a point with a finial
  const pts = [new Vector2(0, 0), new Vector2(MILL.top + 0.45, 0), new Vector2(MILL.top + 0.55, 0.35), new Vector2(MILL.top + 0.35, 1.1),
    new Vector2(1.0, 1.8), new Vector2(0.45, 2.4), new Vector2(0.22, 2.75), new Vector2(0.08, MILL.cap), new Vector2(0, MILL.cap)];
  const g = new LatheGeometry(pts, 24), slate = new Color(0x4e5872), light = new Color(0x7a85a0), out = new Color();
  return paintGeometry(g, (x, y, z) => { const a = Math.atan2(z, x), rib = Math.abs(Math.sin(a * 12)) > 0.94 ? 0.5 : 0; return out.copy(slate).lerp(light, rib + y / MILL.cap * 0.25).clone(); });
}

/** One sail: the spar from the hub, a lattice frame along it and the cloth over the frame's outer two thirds. */
function sail(): { frame: BufferGeometry; cloth: BufferGeometry } {
  const parts: BufferGeometry[] = [], L = MILL.sail, w = 1.7, x0 = 0.3;
  const bar = (sx: number, sy: number, sz: number, x: number, y: number, z: number): void => { const b = new BoxGeometry(sx, sy, sz); b.translate(x, y, z); parts.push(b); };
  bar(0.24, L, 0.24, 0, L / 2, 0); // the spar
  bar(0.08, L * 0.82, 0.08, x0 + w, L * 0.59, 0.08); // the outer rail
  for (let i = 0; i <= 9; i++) bar(w + 0.1, 0.07, 0.07, x0 + w / 2, L * 0.18 + (L * 0.82) * (i / 9), 0.08); // the cross bars
  const frame = mergeGeometries(parts.map((g) => g.toNonIndexed())); for (const g of parts) g.dispose();
  const cloth = new BoxGeometry(w * 0.92, L * 0.62, 0.03); cloth.translate(x0 + w * 0.5, L * 0.66, 0.13);
  return { frame, cloth };
}

export function towerMill(): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const group = new Group(), hub = new Group();
  const stone = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  group.add(new Mesh(tower(), stone));
  const wood = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 }), dark = new MeshStandardMaterial({ color: 0x2c2430, roughness: 1, metalness: 0 });
  // the door and three windows on the side facing the spawn (+z), each set into the taper
  const radiusAt = (y: number): number => MILL.base + (MILL.top - MILL.base) * Math.max(0, (y - 0.5) / (MILL.height - 0.5));
  const door = new Mesh(new BoxGeometry(1.0, 1.9, 0.3), wood); door.position.set(0, 1.0, radiusAt(1) - 0.02); group.add(door);
  const lintel = new Mesh(new BoxGeometry(1.3, 0.22, 0.34), new MeshStandardMaterial({ color: 0xbfb2a0, roughness: 0.9, metalness: 0 })); lintel.position.set(0, 2.05, radiusAt(2) + 0.02); group.add(lintel);
  for (const [y, a] of WINDOWS) {
    const win = new Mesh(new BoxGeometry(0.5, 0.75, 0.2), dark), r = radiusAt(y) - 0.03;
    win.position.set(Math.sin(a) * r, y, Math.cos(a) * r); win.rotation.y = a; group.add(win);
  }
  // the curb and the cap
  const curb = new Mesh(new CylinderGeometry(MILL.top + 0.5, MILL.top + 0.4, 0.3, 24), wood); curb.position.y = MILL.height + 0.15; group.add(curb);
  const capMesh = new Mesh(cap(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 })); capMesh.position.y = MILL.height + 0.3; group.add(capMesh);
  // the windshaft out of the cap toward +z, and the hub on it
  const hubAt = { y: MILL.height + 1.0, z: MILL.top + 0.95 };
  const shaft = new Mesh(new CylinderGeometry(0.2, 0.24, 1.4, 10), wood); shaft.rotation.x = Math.PI / 2; shaft.position.set(0, hubAt.y, hubAt.z - 0.6); group.add(shaft);
  hub.position.set(0, hubAt.y, hubAt.z); group.add(hub);
  const boss = new Mesh(new CylinderGeometry(0.42, 0.42, 0.5, 12), wood); boss.rotation.x = Math.PI / 2; hub.add(boss);
  const { frame, cloth } = sail();
  const frameMat = new MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.9, metalness: 0 });
  const clothMat = new MeshStandardMaterial({ color: 0xeee2c8, roughness: 0.95, metalness: 0, side: DoubleSide, emissive: 0x2a2014 });
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = (i * Math.PI) / 2 + 0.3; hub.add(arm);
    arm.add(new Mesh(frame, frameMat), new Mesh(cloth, clothMat));
  }
  return { group, hub, hubAt };
}
