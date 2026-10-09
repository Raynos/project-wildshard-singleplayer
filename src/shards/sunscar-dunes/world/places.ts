import { addFire, addLampGlow, COOKFIRE, fireLight, WAYMARK_FIRE } from './fireFx';
import { BoxGeometry, BufferGeometry, CapsuleGeometry, CylinderGeometry, DataTexture, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, LinearFilter,
  LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RGBAFormat, SphereGeometry, SRGBColorSpace, TorusGeometry,
  UnsignedByteType, Vector3, type Material } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { rock } from '@wildshard/engine/world/geometryKit';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { CARAVAN, SEED, WELL } from '../data/layout';
import { WIND } from './dunes';
import { duneHd, duneMaterial, duneMesh, fit, smoothColors, warmByFire, without } from './meshes';

// round 2 (R1C-2): sun-greyed wood and worn iron a step lighter; at dusk the old near-black values read as black cut-outs
const WOOD = 0xa07656, WOOD_DARK = 0x86603f, IRON = 0x6e5e56, CANVAS = 0x8a6448, CANVAS_BLEACHED = 0xd8bc92, LAMPLIT = 0x6e3210, STONE = 0x6a4a3a, LEATHER = 0x3a1e12, CLAY = 0x7a3a22;
const POLE = 0x86603f;
export const RAG = 0x8a2a16, RAG_GLOW = 0x1a0603;
/** The places' marker poles (metres): as tall as the waymark poles' reach from above. */
const MARK = { h: 6.5 } as const;
/** The textured hero models' fitted sizes (metres): the wagon's span and turn, the brazier's height and its bowl's
 *  height as a share of it. */
export const HD = { wagon: 6.4, wagonYaw: Math.PI, brazier: 2.5, bowlAt: 0.86 } as const;
const mat = (color: number, extra: Partial<{ metalness: number; side: typeof DoubleSide; emissive: number }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
/** A generated model's painted material a step lighter (round 2, R1C-2: the iron brazier and the well read black at dusk). */
export const litDune = (): MeshStandardMaterial => {
  // the bowls measured 2 against the sand's 31 (check pass): lifted paint and a faint warm self-light, never black on lit sand
  const m = duneMaterial(); m.color.setRGB(4.2, 3.7, 3.2); m.emissive.setRGB(0.07, 0.045, 0.03); m.roughness = 0.7; return m;
};
const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);
const at = (mesh: Mesh, x: number, y: number, z: number, parent: Group): Mesh => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

/** The lantern on its pole, in the caravan's frame (metres): beside the tailboard (−Z), the glass `y` up. */
// E399 (mockup B): the lantern hangs in the wagon's back hoop, over the logbook on the tailboard
// row 7: wagon-hd2's bed runs ~0.3 m further back, so the lantern hangs at the back hoop's opening, not inside the canvas
const LANTERN = { x: -0.45, y: 2.0, z: -3.05 } as const;
/** The cookfire beside the wagon, in the caravan's frame (mockup B's smoke). */
// E399 (mockup B): in front of the wagon, its wisp rising behind it as you come up from the back; round 24 (seats B and C:
// the plume rose right of the wagon, x 0.71, where the mockup's rises over the canvas, x 0.53): on the approach's sight line
// through the wagon, 5 m beyond its middle
const COOK = { x: 2.6, z: 4.0 } as const;

/** Spilled cargo on the lee (−X) side, on the sand itself: x, z, half size, yaw. */
// E399 (mockup B): the crates stacked off the back corner on the left as you come up behind the wagon (+X)
// round 9: standing on the sand (they were sunk to 0.8 of their height, low slabs), the small one stacked on the big one
const CARGO: readonly [number, number, number, number][] = [[2.6, -2.6, 0.42, 0.25], [3.4, -3.3, 0.36, -0.35], [2.6, -2.6, 0.26, 0.6]];
/** Grain sacks slumped against the crates (mockup B): x, z, size, yaw. */
const SACKS: readonly [number, number, number, number][] = [[1.7, -3.5, 0.34, 0.4], [2.0, -4.0, 0.3, -0.6], [3.3, -4.1, 0.32, 1.2]];
/** The caravan's tent, dark canvas pitched off the wagon's right as you come up behind it (mockup B). */
// round 8 (the council: a big flat grey sheet at the frame's edge; the mockup's tent is small and dark behind the horse)
const TENT = { x: -8.2, z: 2.6, yaw: 0.35, w: 2.6, h: 1.9, d: 3.0 } as const;
/** The pack horse, tethered between the tent and the wagon (mockup B): in the caravan's frame, its head toward the wagon's front. */
// round 8 (the council: end-on to mock-B; the mockup shows it side-on, its head to the right): broadside to the approach from the tailboard
const HORSE = { x: -5.0, z: 1.6, yaw: 0.39, h: 1.62 } as const;
const BURLAP = 0xa48a62, TENT_CANVAS = 0x3a2e28; // council round 2: 0x2c2220 read as a pure-black wedge

/** Sun-bleached crate planks (loop 3: the plain dark boxes read as black cubes against the afterglow). */
const CRATE_GLOW = 0x2c1a0c, BARREL = 0x7e5a3e; // round 9 (the seats since round 5: black slabs; mockup B's crates read planked and tan in the dusk): a warmer self-light
/**
 * The crates' planks (E399, council round 2: the mockup's crates are planked and stencilled, ours read as plain boxes): a
 * 64² tile per face, four planks with dark seams and grain streaks inside a darker frame of boards, a nail at each frame
 * corner and a faded stencilled mark in the middle. The caravan returns it (`CaravanParts.textures`) for the level scope.
 */
function crateTexture(): DataTexture {
  const n = 64, data = new Uint8Array(n * n * 4), rng = new Rng(SEED + 77);
  const plankShade = [0.86, 1.0, 0.9, 0.8].map((v) => v * rng.range(0.92, 1.05));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const frame = x < 6 || x > n - 7 || y < 6 || y > n - 7, plank = Math.min(3, Math.floor((y - 6) / ((n - 12) / 4)));
    const seam = !frame && (y - 6) % Math.round((n - 12) / 4) === 0;
    const grain = 0.9 + 0.1 * Math.sin(x * 0.55 + Math.sin(y * 1.7) * 2.2 + plank * 3.1);
    let v = frame ? 0.62 : (plankShade[Math.max(0, plank)] ?? 0.9) * grain;
    if (seam) v *= 0.35;
    const nail = (Math.abs(x - 3) < 1.5 || Math.abs(x - (n - 4)) < 1.5) && (Math.abs(y - 3) < 1.5 || Math.abs(y - (n - 4)) < 1.5);
    if (nail) v = 0.25;
    // the stencil: a faded dark rectangle with an arrow, as cargo marks go
    const sx = x - n / 2, sy = y - n / 2, inBox = Math.abs(sx) < 12 && Math.abs(sy) < 8 && !(Math.abs(sx) < 10 && Math.abs(sy) < 6);
    const arrow = Math.abs(sx) < 1.6 && sy > -4 && sy < 4 || (sy > 1 && sy < 4 && Math.abs(sx) < 4 - (sy - 1));
    if (!frame && (inBox || arrow)) v *= 0.55;
    const i = (y * n + x) * 4;
    data[i] = Math.round(Math.min(1, v) * 168); data[i + 1] = Math.round(Math.min(1, v) * 118); data[i + 2] = Math.round(Math.min(1, v) * 78); data[i + 3] = 255;
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
const crateMaterial = (map: DataTexture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.9, emissive: CRATE_GLOW });
/** A crate: a box whose six faces each carry the plank tile (`crateTexture`). */
function crateGeometry(half: number): BoxGeometry { return new BoxGeometry(half * 2, half * 2, half * 2); }

/**
 * A tall marker pole with a long madder pennant downwind (after the check pass: the caravan and the well could not be
 * picked out from the aerial overview; the tower's pennant is the same mark). In `parent`'s frame at (lx, lz), standing on
 * `groundY` (relative to the parent), `h` metres tall; its collider in world space at (wx, wz).
 */
function markerPole(parent: Group, lx: number, lz: number, groundY: number, h: number, wx: number, wz: number, worldY: number, colliders: ColliderDesc[]): void {
  const wood = mat(POLE), pole = box(0.11, h, 0.11, wood); at(pole, lx, groundY + h / 2 - 0.3, lz, parent);
  const flag = new Mesh(bannerGeometry(), new MeshStandardMaterial({ color: RAG, roughness: 0.9, side: DoubleSide, emissive: RAG_GLOW }));
  flag.scale.set(1.6, 1.2, 1.2); flag.position.set(lx, groundY + h - 0.35, lz);
  flag.rotation.y = Math.atan2(-WIND.z, WIND.x) - parent.rotation.y; parent.add(flag);
  colliders.push(boxDesc({ x: wx, z: wz, hw: 0.07, hd: 0.07, rot: 0, yBottom: worldY - 0.3, yTop: worldY + h }, 'wood'));
}

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; logbook: Mesh; textures: DataTexture[]; lampAt: Vector3 }

/**
 * The half-buried caravan: a covered wagon sunk to its axles and tipped by the drift, its canvas torn off the front
 * hoops, one wheel showing, crates and a barrel spilled on the lee side, the logbook on the tailboard.
 */
export function buildCaravan(groundAt: (x: number, z: number) => number): CaravanParts {
  const root = new Group(), wagon = new Group(), colliders: ColliderDesc[] = [];
  const wood = mat(WOOD), dark = mat(WOOD_DARK);
  const y = groundAt(CARAVAN.x, CARAVAN.z);
  root.position.set(CARAVAN.x, y, CARAVAN.z); root.rotation.y = CARAVAN.yaw;
  // The wagon in its own frame (+Z is the front), tipped and sunk.
  wagon.position.set(0, -0.55, 0); wagon.rotation.set(-0.1, 0, 0.13); root.add(wagon);
  // C6: the generated wagon (Hunyuan3D-2 from `ref-caravan.jpg`; its shafts lie along −X, turned to +Z), else the code one.
  // loop 6 (mockup B): the textured hero wagon when it loaded, else the facet-painted one, else the code wagon
  // the original top-10's row 7 (art/sunscar-dunes/round-28-camp): wagon-hd2 from mockup B, torn canvas over bare hoops, a
  // planked tailboard, spoked wheels (turned like wagon-hd, its tailboard to the logbook's approach); wagon-hd if it did not load
  const hdWagon = duneHd('wagon-hd2', { size: HD.wagon, by: 'span', yaw: HD.wagonYaw }) ?? duneHd('wagon-hd', { size: HD.wagon, by: 'span', yaw: HD.wagonYaw });
  const generated = hdWagon ? null : duneMesh('caravan');
  if (hdWagon) wagon.add(hdWagon);
  else if (generated) {
    // round 1 (R1A-5): the painted wood a step lighter, so boards, hoops and wheels separate instead of one dark shell
    const painted = duneMaterial(); // the regions carry their own values now (wagonRegions)
    const body = fit(generated, { size: 6.2, by: 'span', yaw: Math.PI / 2 }); smoothColors(body); wagonRegions(body);
    wagon.add(new Mesh(body, painted)); coverHoops(wagon);
  }
  else buildCodeWagon(wagon, wood, dark);
  // round 8 (the council: the cargo read as black slabs; the mockup lights it warm): the lantern lights the cargo too
  const crateMap = crateTexture(), crateWood = crateMaterial(crateMap); warmByFire(crateWood);
  // row 7: the modelled crate pair (a crate stacked on a larger one, mockup B) where the code stack stood; the code crates if it did not load
  const cratesHd = duneHd('crates-hd', { size: 1.36, by: 'height', yaw: 0.25 });
  if (cratesHd) { const [cx, cz] = CARGO[0] ?? [2.6, -2.6]; cratesHd.position.set(cx, -0.04, cz); root.add(cratesHd); }
  else CARGO.forEach(([x, z, half, yaw], i) => { const crate = new Mesh(crateGeometry(half), crateWood); crate.rotation.y = yaw; at(crate, x, i === 2 ? 0.84 + half - 0.05 : half - 0.04, z, root); });
  // The barrel (loop 4: it was a plain near-black cylinder): sun-bleached staves, a bulge, two iron hoops.
  const barrel = new Group(); barrel.rotation.set(0, 0.6, Math.PI / 2); barrel.position.set(-2.4, 0.25, 2.3); root.add(barrel);
  const staves = mat(BARREL, { emissive: CRATE_GLOW }); warmByFire(staves); // no vertex colours on a cylinder: a plain material, not the crates'
  barrel.add(new Mesh(new CylinderGeometry(0.31, 0.31, 0.9, 12, 3), staves));
  barrel.add(new Mesh(new CylinderGeometry(0.345, 0.345, 0.5, 12, 1, true), staves));
  for (const yy of [-0.32, 0.32]) { const hoop = new Mesh(new TorusGeometry(0.33, 0.025, 4, 14), mat(IRON, { metalness: 0.4 })); hoop.rotation.x = Math.PI / 2; hoop.position.y = yy; barrel.add(hoop); }
  // The logbook: on the tailboard, the wagon's back (−Z).
  const logbook = box(0.32, 0.07, 0.42, mat(LEATHER)); logbook.rotation.y = 0.3; at(logbook, 0.35, 1.12, -2.55, root);
  const logbookAt = new Vector3(0.35, 1.12, -2.55).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  // The lantern (loop 4, mockup B): on a leaning pole beside the tailboard, the logbook's warm light in the dusk.
  const lamp = new Group(); lamp.position.set(LANTERN.x, LANTERN.y, LANTERN.z); root.add(lamp);
  const iron = mat(IRON, { metalness: 0.4 });
  at(box(0.025, 0.55, 0.025, iron), -0.22, 0.45, 0, lamp); // the hook rod up to the hoop
  at(box(0.2, 0.04, 0.2, iron), -0.22, 0.18, 0, lamp); at(box(0.2, 0.04, 0.2, iron), -0.22, -0.16, 0, lamp);
  { const glass = new MeshBasicMaterial({ color: 0xffb24a }); glass.color.multiplyScalar(3.2); at(box(0.13, 0.28, 0.13, glass), -0.22, 0.01, 0, lamp); } // round 10 (R9B-9: the lantern peaked at 183, the mockup's 252): a hot centre
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) at(box(0.02, 0.32, 0.02, iron), -0.22 + dx * 0.09, 0.01, dz * 0.09, lamp);
  const cosY = Math.cos(CARAVAN.yaw), sinY = Math.sin(CARAVAN.yaw);
  addLampGlow(lamp, 0.5, (lx, lz) => { // round 10: drawn over the canvas, 2.4 washed the whole wagon
    const x = LANTERN.x + lx, z = LANTERN.z + lz; // the lamp's frame → the caravan's → the world (three's Ry)
    return groundAt(CARAVAN.x + x * cosY + z * sinY, CARAVAN.z - x * sinY + z * cosY) - (y + LANTERN.y);
  });
  // The sacks (E399, mockup B): squashed burlap lumps against the crates.
  const burlap = new MeshStandardMaterial({ color: BURLAP, roughness: 0.97, emissive: 0x241a10 }); warmByFire(burlap);
  // row 7: the modelled sack pile (three tied burlap sacks and a strapped bedroll, mockup B) against the crates
  const sacksHd = duneHd('sacks-hd', { size: 0.78, by: 'height', yaw: 0.5 });
  if (sacksHd) { sacksHd.position.set(2.0, -0.04, -3.85); root.add(sacksHd); }
  else for (const [x, z, r, yaw] of SACKS) {
    const sack = new Mesh(new CapsuleGeometry(r * 0.62, r * 1.3, 4, 10), burlap); sack.scale.set(1, 1, 0.8); sack.rotation.set(0, yaw, Math.PI / 2 - 0.12); at(sack, x, r * 0.5, z, root);
    const neck = new Mesh(new CylinderGeometry(r * 0.16, r * 0.3, r * 0.4, 8), burlap); neck.rotation.set(0, yaw, Math.PI / 2 - 0.12);
    neck.position.set(x + Math.cos(yaw) * r * 1.35, r * 0.62, z - Math.sin(yaw) * r * 1.35); root.add(neck);
  }
  // The tent (E399, mockup B): an A-frame of dark canvas on two poles, its ridge along the wagon.
  const tent = new Group(), canvasDark = mat(TENT_CANVAS, { side: DoubleSide }), slope = Math.atan2(TENT.h, TENT.w / 2), side = Math.hypot(TENT.h, TENT.w / 2);
  tent.position.set(TENT.x, 0, TENT.z); tent.rotation.y = TENT.yaw; root.add(tent);
  for (const k of [-1, 1]) { const panel = box(0.04, side, TENT.d, canvasDark); panel.rotation.z = k * (Math.PI / 2 - slope); at(panel, k * TENT.w / 4, TENT.h / 2, 0, tent); }
  for (const k of [-1, 1]) at(box(0.07, TENT.h + 0.2, 0.07, dark), 0, TENT.h / 2, k * (TENT.d / 2 + 0.05), tent);
  // Colliders: the wagon body and the cargo (world space).
  const world = (x: number, z: number): Vector3 => new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  // E399 (mockup B): a smouldering cookfire on the lee side, its thin smoke column rising behind the wagon
  const cook = new Group(); cook.position.set(COOK.x, 0.15, COOK.z); root.add(cook);
  for (let i = 0; i < 6; i++) { const st = box(0.16, 0.12, 0.14, mat(STONE)); const a = (i / 6) * Math.PI * 2; st.position.set(Math.cos(a) * 0.38, -0.08, Math.sin(a) * 0.38); st.rotation.y = a; cook.add(st); }
  const cw = world(COOK.x, COOK.z); addFire(cook, COOKFIRE, { at: new Vector3(cw.x, y + 0.15, cw.z), groundAt });
  const body = world(0, 0);
  colliders.push(boxDesc({ x: body.x, z: body.z, hw: 1.1, hd: 2.3, rot: -CARAVAN.yaw, yBottom: y - 1, yTop: y + 1.9 }, 'wood'));
  // The pack horse (E399, mockup B): the generated model (art/sunscar-dunes/round-19-horse), its head (model -X) turned along the wagon
  const horse = duneHd('horse-hd', { size: HORSE.h, by: 'height', yaw: HORSE.yaw });
  if (horse) {
    horse.position.set(HORSE.x, 0, HORSE.z); root.add(horse);
    const at2 = world(HORSE.x, HORSE.z); colliders.push(boxDesc({ x: at2.x, z: at2.z, hw: 0.35, hd: 1.1, rot: -CARAVAN.yaw, yBottom: y - 0.3, yTop: y + HORSE.h }, 'flesh'));
  }
  const tentAt = world(TENT.x, TENT.z); colliders.push(boxDesc({ x: tentAt.x, z: tentAt.z, hw: TENT.w / 2, hd: TENT.d / 2, rot: -(CARAVAN.yaw + TENT.yaw), yBottom: y - 0.5, yTop: y + TENT.h }, 'felt'));
  for (const [i, [x, z, half]] of CARGO.entries()) { if (i === 2 || (i === 1 && cratesHd)) continue; const c = world(x, z); colliders.push(boxDesc({ x: c.x, z: c.z, hw: half, hd: half, rot: -CARAVAN.yaw, yBottom: y - 0.5, yTop: y + (i === 0 ? 0.84 + 0.52 : half * 2) }, 'wood')); } // the stacked crate rides on the first's collider
  { // the caravan's marker, off the lee side (in the caravan's frame, -X)
    // E399 (mockup B shows the wagon alone): no marker pole at the caravan; the well keeps its
    void markerPole;
  }
  const lampAt = new Vector3(LANTERN.x, LANTERN.y, LANTERN.z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  return { root, colliders, logbookAt, logbook, textures: [crateMap], lampAt };
}

/**
 * The generated wagon's hoops carry no canvas of their own (they read as bare dark ribs against the afterglow), so a
 * sun-bleached cover sits just outside the back three: an arch over the hoops' tops (x ±0.81, top 3.55 m in the fitted
 * frame), straight sides down to 2.1 m, a torn flap off its front edge; a faint glow keeps it pale against the afterglow.
 * The front hoops stay bare, as in the ref.
 */
// round 2 (R1A-5): the cover runs the wagon's whole length (from the H2 side only bare dark hoops showed), torn at the front
const HOOPS = { cx: 0.88, cy: 2.62, top: 1.0, side: 0.55, back: -2.65, front: 1.9 } as const;
function coverHoops(wagon: Group): void {
  const canvas = mat(CANVAS_BLEACHED, { side: DoubleSide, emissive: LAMPLIT }), len = HOOPS.front - HOOPS.back, mid = (HOOPS.front + HOOPS.back) / 2;
  // the arch shaded (check pass: a flat unshaded slab): paler on the crown, darker down the sides, the cloth sagging
  // and creased between the hoops
  const archGeo = new CylinderGeometry(1, 1, len, 14, 12, true, -Math.PI / 2, Math.PI), ap = archGeo.getAttribute('position');
  const shade = new Float32Array(ap.count * 3), hoopGap = len / 5;
  for (let i = 0; i < ap.count; i++) {
    const ax = ap.getX(i), ay = ap.getY(i), az = ap.getZ(i), fold = Math.cos(((ay + len / 2) / hoopGap) * Math.PI * 2);
    const sag = 1 - 0.05 * (1 - fold) * 0.5;
    ap.setX(i, ax * sag); ap.setZ(i, az * sag);
    const crown = Math.max(0, -az), v = (0.62 + 0.38 * crown) * (0.86 + 0.14 * fold);
    shade[i * 3] = v; shade[i * 3 + 1] = v * 0.97; shade[i * 3 + 2] = v * 0.92;
  }
  archGeo.setAttribute('color', new Float32BufferAttribute(shade, 3)); archGeo.computeVertexNormals();
  // loop 5 (mockup B): a lamp left burning inside, so the cloth glows warm through, brightest low on the sides
  const cloth = new MeshStandardMaterial({ color: CANVAS_BLEACHED, vertexColors: true, roughness: 0.95, side: DoubleSide, emissive: LAMPLIT, emissiveIntensity: 1 });
  const arch = new Mesh(archGeo, cloth);
  arch.geometry.rotateX(-Math.PI / 2); arch.scale.set(HOOPS.cx, HOOPS.top, 1); at(arch, 0, HOOPS.cy, mid, wagon);
  for (const side of [-1, 1]) at(box(0.02, HOOPS.side, len, canvas), side * HOOPS.cx, HOOPS.cy - HOOPS.side / 2, mid, wagon);
  const flap = box(1.1, 0.8, 0.02, canvas); flap.rotation.set(0.45, 0.2, 0.3); at(flap, 0.45, HOOPS.cy + 0.55, HOOPS.front + 0.25, wagon);
}

/** The code wagon (the stand-in when the generated one did not load): bed, sides, hoops, the torn canvas, wheels, shafts. */
function buildCodeWagon(wagon: Group, wood: Material, dark: Material): void {
  const iron = mat(IRON, { metalness: 0.4 }), canvas = mat(CANVAS, { side: DoubleSide });
  at(box(2.0, 0.35, 4.4, wood), 0, 0.9, 0, wagon);
  for (const side of [-1, 1]) at(box(0.08, 0.62, 4.4, dark), side, 1.36, 0, wagon);
  at(box(2.0, 0.62, 0.08, dark), 0, 1.36, -2.2, wagon);
  for (let i = 0; i < 5; i++) {
    const hoop = new Mesh(new TorusGeometry(1.0, 0.045, 4, 12, Math.PI), dark); at(hoop, 0, 1.62, -1.8 + i * 0.9, wagon);
  }
  const cover = new Mesh(new CylinderGeometry(1.03, 1.03, 2.5, 12, 1, true, -Math.PI / 2, Math.PI), canvas);
  cover.geometry.rotateX(-Math.PI / 2); at(cover, 0, 1.62, -0.95, wagon);
  // A torn flap hanging off the last covered hoop.
  const flap = box(1.2, 0.9, 0.02, canvas); flap.rotation.set(0.5, 0.2, 0.35); at(flap, 0.55, 2.0, 0.45, wagon);
  for (const [x, z] of [[1.12, 1.5], [1.12, -1.5]] as const) {
    const wheel = new Mesh(new CylinderGeometry(0.78, 0.78, 0.1, 14), wood); wheel.rotation.z = Math.PI / 2; at(wheel, x, 0.72, z, wagon);
    const rim = new Mesh(new TorusGeometry(0.78, 0.05, 4, 14), iron); rim.rotation.y = Math.PI / 2; at(rim, x + 0.02, 0.72, z, wagon);
  }
  for (const side of [-1, 1]) { const shaft = box(0.09, 0.09, 2.6, wood); shaft.rotation.x = 0.22; at(shaft, side * 0.45, 0.55, 3.3, wagon); }
}

/**
 * The generated wagon recoloured by region (check pass: body, wheels and hoops read as one maroon value), keeping the
 * paint's own light and dark: the wheels dark iron-shod wood out at the sides and low, the hoops dark wood up top, the
 * bed and sides a warm sun-faded timber between. In the fitted frame (`fit`, the wagon's length along z, the ground y 0).
 */
const WAGON = { wheelX: 0.78, wheelY: 1.5, hoopY: 1.9, wheel: [0.16, 0.1, 0.07], hoop: [0.26, 0.17, 0.11], bed: [0.62, 0.42, 0.26] } as const;
function wagonRegions(g: BufferGeometry): void {
  if (!g.hasAttribute('color')) return;
  const p = g.getAttribute('position'), c = g.getAttribute('color');
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i)), y = p.getY(i), lum = 0.3 * c.getX(i) + 0.59 * c.getY(i) + 0.11 * c.getZ(i);
    const tone = y > WAGON.hoopY ? WAGON.hoop : x > WAGON.wheelX && y < WAGON.wheelY ? WAGON.wheel : WAGON.bed;
    const k = Math.min(1.35, Math.max(0.6, 0.6 + lum * 2.2)); // the paint's own light and dark, kept
    c.setXYZ(i, tone[0] * k, tone[1] * k, tone[2] * k);
  }
  c.needsUpdate = true;
}

/** The generated well's span (metres, the crank end to the far post): its ring then sits on the stones' colliders. */
const WELL_FIT = 3.4;

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crank: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

/**
 * The dry well: a ring of 12 dressed stones, two posts and a windlass with a crank (the whip's pull target), the rope
 * down to a bucket that holds a sealed clay oil jar. `drop` is how far below the rim the bucket hangs.
 */
export function buildWell(groundAt: (x: number, z: number) => number): WellParts {
  const root = new Group(), colliders: ColliderDesc[] = [], y = groundAt(WELL.x, WELL.z), wood = mat(WOOD), dark = mat(WOOD_DARK);
  root.position.set(WELL.x, y, WELL.z);
  const R = 1.35, n = 12, ring = new InstancedMesh(new BoxGeometry(0.72, 0.85, 0.42), mat(STONE), n), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    q.setFromAxisAngle(up, a); m.compose(new Vector3(Math.sin(a) * R, 0.35, Math.cos(a) * R), q, new Vector3(1, 1, 1)); ring.setMatrixAt(i, m);
    colliders.push(boxDesc({ x: WELL.x + Math.sin(a) * R, z: WELL.z + Math.cos(a) * R, hw: 0.38, hd: 0.24, rot: -a, yBottom: y - 0.5, yTop: y + 0.78 }, 'stone'));
  }
  ring.instanceMatrix.needsUpdate = true; ring.computeBoundingSphere();
  // C6: the generated well (Hunyuan3D-2 from `ref-well.jpg`): its ring, posts and windlass; its bucket and crank are cut
  // away, the code ones (below) animate. Else the code ring, posts and axle.
  const generated = duneMesh('dry-well');
  if (generated) {
    const fitted = fit(generated, { size: WELL_FIT, by: 'span' }), maxX = fitted.boundingBox?.max.x ?? 2;
    root.add(new Mesh(without(fitted, (cx, cy, cz) => cx > maxX - 0.3 || (Math.hypot(cx, cz) < 0.5 && cy > 0.75 && cy < 1.95)), litDune()));
  } else root.add(ring);
  // The shaft: a dark disc inside the ring.
  const hole = new Mesh(new CylinderGeometry(R - 0.3, R - 0.3, 0.05, 16), new MeshBasicMaterial({ color: 0x0a0605 })); at(hole, 0, 0.62, 0, root);
  for (const side of [-1, 1]) {
    if (!generated) at(box(0.16, 2.3, 0.16, wood), side * (R + 0.15), 1.15, 0, root);
    colliders.push(boxDesc({ x: WELL.x + side * (R + 0.15), z: WELL.z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y, yTop: y + 2.3 }, 'wood'));
  }
  if (!generated) { const axle = new Mesh(new CylinderGeometry(0.12, 0.12, R * 2 + 0.3, 8), dark); axle.rotation.z = Math.PI / 2; at(axle, 0, 2.05, 0, root); }
  const crank = box(0.07, 0.6, 0.07, mat(IRON, { metalness: 0.1 })); // matte: metal at dusk mirrored the dark sky to black at(crank, R + 0.32, 1.85, 0, root);
  const drop = 2.6, bucket = new Group(); bucket.position.set(0, 1.85 - drop, 0); root.add(bucket);
  const ropeGeo = new CylinderGeometry(0.02, 0.02, drop, 4); ropeGeo.translate(0, drop / 2, 0);
  const rope = new Mesh(ropeGeo, mat(0x6b5236)); bucket.add(rope); // grows from the bucket up to the axle; scaled down as it winds
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.material.side = DoubleSide; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), mat(CLAY)); jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  markerPole(root, -2.6, 1.4, groundAt(WELL.x - 2.6, WELL.z + 1.4) - y, MARK.h, WELL.x - 2.6, WELL.z + 1.4, groundAt(WELL.x - 2.6, WELL.z + 1.4), colliders);
  return { root, colliders, bucket, rope, jar, crank, crankAt: new Vector3(WELL.x + R + 0.32, y + 1.85, WELL.z), jarAt: new Vector3(WELL.x, y + 1.0, WELL.z), drop };
}

/** The waymark's dressing (metres): stones in its ring, the ring's radius, the marker pole's height, the plinth's. */
const WAYMARK = { stones: 9, ring: 1.45, pole: 4.4, plinth: 0.75 } as const;
const PLINTH_STONE = 0x9a6a4c, PLINTH_BASE = 0x6e4634, PLINTH_LIGHT = 0xa87a58;
const KINDLING = 0x6e4a2e, CHARRED = 0x1c120c;
/** A long banner hanging from the crossbar, streaming along +x and sagging, in two kinked panels. */
export function bannerGeometry(): BufferGeometry {
  const pts = [[0, 0, 0], [0, -0.75, 0], [0.55, -0.12, 0.06], [0.5, -0.82, 0.05], [1.1, -0.3, -0.04], [1.0, -0.9, -0.03]];
  const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5], pos: number[] = [];
  for (const i of idx) pos.push(...(pts[i] ?? [0, 0, 0]));
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

/**
 * A crossed stack of kindling for a brazier's bowl (round 1: the unlit bowls read empty and black); `y` the bowl's floor.
 * `crown`: charred logs splaying out over the rim instead (E399, mockup C: the hero brazier's log fire).
 */
export function kindling(y: number, size = 1, crown = false): Group {
  // the crown's logs glow at the ember (council round 2: unlit, they read as a black tent inside the flame)
  // round 18 (row 3, mockup C: the logs burn orange inside the flame): the crown's charred wood carries an ember glow the
  // brazier switches on when lit (`userData.ember`)
  const g = new Group(), wood = crown ? new MeshStandardMaterial({ color: CHARRED, roughness: 0.95, emissive: 0xff4a10, emissiveIntensity: 0 }) : mat(KINDLING), n = crown ? 11 : 5;
  if (crown) g.userData['ember'] = wood;
  // round 8 (mockup C): the crown adds four logs laid low across the bowl at odd angles, charred dark inside the flame (a
  // steep teepee read as a Λ against the flame's core)
  for (let i = 0; i < n; i++) {
    // a teepee: each stick leans in from the bowl's edge, the tips meeting above the rim, so it reads at eye level; the
    // crown adds four crossing logs over seven splayed ends (round 7's splayed ends read as one stub)
    const tee = crown && i >= 7, a = tee ? (i - 7) * 1.9 + 0.4 : (i / Math.min(n, 7)) * Math.PI * 2 + (crown ? (i % 2) * 0.3 : 0);
    const lean = tee ? 0.72 + (i % 2) * 0.16 : crown ? -0.8 - (i % 3) * 0.1 : 0.5, len = (tee ? 0.4 + (i % 2) * 0.06 : crown ? 0.34 + (i % 2) * 0.06 : 0.6) * size;
    const log = new Mesh(new CylinderGeometry(0.03 * size, 0.04 * size, len, 5), wood);
    log.rotation.order = 'YXZ'; log.rotation.set(-lean, a, 0);
    log.position.set(Math.sin(a) * Math.sin(lean) * len * 0.5, y + Math.cos(lean) * len * 0.5, Math.cos(a) * Math.sin(lean) * len * 0.5); g.add(log);
  }
  return g;
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; bowlAt: Vector3; oil: Mesh; glow: (lit: boolean) => void }

/** A waymark brazier: a stone plinth, an iron post and bowl, and a hidden fire (`fireFx.ts`; no light). */
export function buildBrazier(x: number, z: number, groundAt: (x: number, z: number) => number): BrazierParts {
  const root = new Group(), colliders: ColliderDesc[] = [];
  // Sit on the lowest corner so the plinth never floats on a slope.
  const y = Math.min(groundAt(x, z), groundAt(x + 0.5, z + 0.5), groundAt(x - 0.5, z - 0.5), groundAt(x + 0.5, z - 0.5), groundAt(x - 0.5, z + 0.5));
  root.position.set(x, y, z);
  // C6: the generated brazier (Hunyuan3D-2 from `ref-brazier.jpg`, plinth to bowl rim 1.85 m), else the code one.
  // Round 2 prep: the waymark stands on a two-tier dressed-stone plinth (`WAYMARK.plinth` m), a monument rather than a
  // pole on a bare slope; everything above it rises with it.
  const hdBrazier = duneHd('brazier-hd', { size: HD.brazier, by: 'height', floor: 0 });
  const P = hdBrazier ? 0 : WAYMARK.plinth, dressed = mat(PLINTH_STONE), base = mat(PLINTH_BASE);
  const tierHost = new Group(); tierHost.visible = hdBrazier === null; root.add(tierHost);
  // each tier is 2 x 2 dressed blocks, a shade apart, with thin mortar gaps: masonry, not a crate
  const tier = new Group(); tier.rotation.y = 0.12; tierHost.add(tier);
  const shades = [mat(PLINTH_STONE), dressed, mat(PLINTH_LIGHT), base];
  for (const [w, h, y0, k] of [[1.7, P * 0.55 + 0.3, -0.3, 0], [1.15, P * 0.45, P * 0.55, 1]] as const) {
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -1 : 1, sz = i < 2 ? -1 : 1, bh = h * (0.94 + 0.06 * ((i * 7 + k) % 3) / 2);
      const block = box(w / 2 - 0.03, bh, w / 2 - 0.03, shades[(i + k) % shades.length] ?? dressed);
      block.position.set(sx * w / 4, y0 + bh / 2, sz * w / 4); tier.add(block);
    }
  }
  // a capstone slab, a shade lighter and a hand wider than the upper tier: the plinth reads built, not stacked boxes
  const cap = box(1.32, 0.07, 1.32, mat(PLINTH_LIGHT)); cap.rotation.y = 0.12; at(cap, 0, P + 0.035, 0, tierHost);
  const ledge = box(1.86, 0.06, 1.86, mat(PLINTH_STONE)); ledge.rotation.y = 0.12; at(ledge, 0, P * 0.55 + 0.03, 0, tierHost);
  colliders.push(boxDesc({ x, z, hw: 0.85, hd: 0.85, rot: -0.12, yBottom: y - 0.3, yTop: y + P * 0.55 }, 'stone'));
  // loop 6 (mockup C): the textured hero brazier on the plinth when it loaded, else the facet-painted one, else code
  const generated = hdBrazier ? null : duneMesh('waymark-brazier'), bowl = hdBrazier ? P + HD.brazier * HD.bowlAt : (generated ? 1.74 : 1.62) + P;
  if (hdBrazier) root.add(hdBrazier);
  else if (generated) root.add(new Mesh(fit(generated, { size: 1.85, by: 'height', floor: -0.12 + P }), litDune()));
  else {
    at(box(0.9, 0.7, 0.9, mat(STONE)), 0, 0.2 + P, 0, root);
    at(new Mesh(new CylinderGeometry(0.07, 0.1, 1.0, 6), mat(IRON, { metalness: 0.4 })), 0, 1.05 + P, 0, root);
    at(new Mesh(new CylinderGeometry(0.42, 0.18, 0.32, 8, 1, true), mat(IRON, { metalness: 0.4 })), 0, 1.6 + P, 0, root);
  }
  const oil = at(new Mesh(new CylinderGeometry(0.33, 0.33, 0.04, 8), new MeshStandardMaterial({ color: 0x1a120c, roughness: 0.2 })), 0, bowl, 0, root);
  const sticks = hdBrazier ? kindling(bowl - 0.15, 1.6, true) : kindling(bowl - 0.08); root.add(sticks);
  const ember: unknown = sticks.userData['ember'];
  oil.visible = false;
  colliders.push(boxDesc({ x, z, hw: 0.45, hd: 0.45, rot: 0, yBottom: y + P * 0.5, yTop: y + 1.75 + P }, 'stone'));
  // Round 1 (R1C-1 / R1B-12): the unlit waymark reads from afar: a ring of fieldstones round its foot, and a tall
  // marker pole beside it with a crossbar and a long faded banner streaming downwind (the waymarks' madder).
  const stones = new InstancedMesh(rock(1, 1, new Rng(SEED + 211 + Math.round(x)), 0.8, 0.22), mat(STONE), WAYMARK.stones); // round 2: round, half-sunk fieldstones, not flat chips
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  for (let i = 0; i < WAYMARK.stones; i++) {
    const a = (i / WAYMARK.stones) * Math.PI * 2 + 0.3, r = WAYMARK.ring * (0.9 + 0.2 * ((i * 37) % 7) / 7), sz = 0.16 + 0.1 * ((i * 53) % 5) / 5;
    const sx = Math.sin(a) * r, sz2 = Math.cos(a) * r;
    q.setFromAxisAngle(up, a * 1.7); m.compose(new Vector3(sx, groundAt(x + sx, z + sz2) - y - sz * 0.4, sz2), q, new Vector3(sz * 1.2, sz, sz)); stones.setMatrixAt(i, m);
  }
  stones.instanceMatrix.needsUpdate = true; stones.computeBoundingSphere(); stones.visible = hdBrazier === null; root.add(stones);
  // E399 (mockup C: the waymark is the brazier on its plinth, nothing else): the banner pole and lantern only with the
  // stand-in brazier, which needs them to read from afar
  if (hdBrazier === null) {
    const poleX = WAYMARK.ring * 0.8, poleZ = -WAYMARK.ring * 0.5, poleY = groundAt(x + poleX, z + poleZ) - y;
    const wood = mat(POLE);
    const pole = box(0.09, WAYMARK.pole, 0.09, wood); pole.rotation.z = -0.04; at(pole, poleX, poleY + WAYMARK.pole / 2 - 0.3, poleZ, root);
    const bar = box(0.7, 0.06, 0.06, wood); at(bar, poleX, poleY + WAYMARK.pole - 0.55, poleZ, root);
    const banner = new Mesh(bannerGeometry(), new MeshStandardMaterial({ color: RAG, roughness: 0.9, side: DoubleSide, emissive: RAG_GLOW }));
    banner.position.set(poleX, poleY + WAYMARK.pole - 0.5, poleZ); banner.rotation.y = Math.atan2(-WIND.z, WIND.x); root.add(banner);
    colliders.push(boxDesc({ x: x + poleX, z: z + poleZ, hw: 0.06, hd: 0.06, rot: 0, yBottom: y + poleY - 0.3, yTop: y + poleY + WAYMARK.pole }, 'wood'));
    // round 2 (R1C-1, seat B: 'a built, lit structure'): a small lantern hangs off the crossbar, its halo and a warm pool
    // on the sand, so the waymark reads lit before its fire is
    const lampY = poleY + WAYMARK.pole - 1.0, lampX = poleX - 0.3, lamp = new Group(); lamp.position.set(lampX, lampY, poleZ); root.add(lamp);
    const iron = mat(IRON, { metalness: 0.4 });
    at(box(0.16, 0.035, 0.16, iron), 0, 0.15, 0, lamp); at(box(0.16, 0.035, 0.16, iron), 0, -0.13, 0, lamp);
    at(box(0.1, 0.22, 0.1, new MeshBasicMaterial({ color: 0xffb24a })), 0, 0.01, 0, lamp);
    at(box(0.012, 0.42, 0.012, iron), 0, 0.37, 0, lamp);
    addLampGlow(lamp, 0.55, (lx, lz) => groundAt(x + lampX + lx, z + poleZ + lz) - (y + lampY)); // a small halo: 1.6 filled the sky at 5 m
  }
  const fire = new Group(); fire.position.set(0, bowl, 0); fire.visible = false; root.add(fire);
  // The fire (P2 #8): layered flame, glow, embers downwind, a smoke column and a warm pool on the sand.
  addFire(fire, WAYMARK_FIRE, { at: new Vector3(x, y + bowl, z), groundAt });
  const light = fireLight(new Vector3(x, y + bowl + 0.4, z));
  return { root, colliders, fire, bowlAt: new Vector3(x, y + 1.6 + P, z), oil, glow: (lit: boolean) => {
    light(lit); if (ember instanceof MeshStandardMaterial) ember.emissiveIntensity = lit ? 1.1 : 0;
  } };
}
