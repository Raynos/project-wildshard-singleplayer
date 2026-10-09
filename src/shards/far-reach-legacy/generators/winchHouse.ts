import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { STEP, WINCH_HOUSE } from '../data/layout';
import { bakeKinds, foldKinds, type KindExtra, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { beam, leanAbove, quad, shackMesh, shackPart, strut, tri, type ShackPart } from './shackKit';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/winch-house.glb` +
 * `data/winchHouse.json`; the client draws the bake (`world/winchHouse.ts`).
 *
 * The winch house on the high step (loop 5; restyled E392 round 18 toward H3-7 / H3-8: "the mockup's are weathered
 * timber shacks: plank walls, shingle roofs, trim, a lean"). A two-storey timber shack on a battered stone footing: a
 * plank ground storey framed by corner posts, sill and braces; a band of joist ends; an upper storey that leans a little
 * off true; a steep shingled gable roof with barge boards crossed into horns at the ridge, an iron stovepipe. A plank
 * door under a small pent roof with stone steps (+z, toward the updraft), shuttered windows with a warm lamp behind
 * them, the teal banner, and the great spoked winch wheel on its bracket on the bridge side (+x). Code-built, the
 * surfaces drawn by the shack kit's procedural shaders (`./shack`); one box collider, the footprint unchanged.
 */

/** The shack's frame (local metres, base at y 0): footing, storeys, roof. */
const F = { foot: 0.9, footBase: 2.55, footTop: 2.42, gx: 2.2, gz: 2.2, band: 4.15, ux: 2.38, uz: 2.32, plate: 7.2, ridge: 9.55, eave: 0.5, gable: 0.4 } as const;

const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const tone = (hex: number, k: number): Color => new Color(hex).multiplyScalar(k);
const PAL = { plank: 0xb3a48e, plankHi: 0xbfb19c, beam: 0x6e5a48, door: 0x7d6450, shingle: 0x7c6a5a, stone: 0xa2988a, sheath: 0x4a3e36 } as const;

/** A wall rectangle from its two bottom corners (seen from outside, left then right) and a height. */
function wall(part: ShackPart, left: Vector3, right: Vector3, h: number, tint: Color, seed: number): void {
  const u = right.clone().sub(left), w = u.length();
  quad(part, left, u.normalize(), V(0, 1, 0), w, h, tint, seed, left.x + left.z, left.y);
}

/** A window on a wall: frame, sill, a dark pane (into `glass`), and two shutters, one hung open, one askew. */
function windowOn(parts: { plank: ShackPart; beam: ShackPart; glass: ShackPart }, c: Vector3, out: Vector3, w: number, h: number, seed: number, askew = false): void {
  const u = V(out.z, 0, -out.x), up = V(0, 1, 0), o = c.clone().addScaledVector(u, -w / 2).addScaledVector(up, -h / 2).addScaledVector(out, 0.015);
  quad(parts.glass, o, u, up, w, h, new Color(1, 1, 1), seed);
  const t = tone(PAL.beam, 0.95), f = 0.11, yaw = Math.atan2(out.x, out.z);
  const at = (du: number, dv: number, dn: number): Vector3 => c.clone().addScaledVector(u, du).addScaledVector(up, dv).addScaledVector(out, dn);
  beam(parts.beam, at(0, h / 2 + f / 2, 0.05), V(w + 2 * f, f, 0.1), t, seed + 1, 0, yaw);
  beam(parts.beam, at(0, -h / 2 - f / 2, 0.08), V(w + 2 * f + 0.16, f, 0.16), t, seed + 2, 0, yaw);
  beam(parts.beam, at(-w / 2 - f / 2, 0, 0.05), V(f, h, 0.1), t, seed + 3, 0, yaw);
  beam(parts.beam, at(w / 2 + f / 2, 0, 0.05), V(f, h, 0.1), t, seed + 4, 0, yaw);
  // the mullions: a cross of glazing bars
  beam(parts.beam, at(0, 0, 0.03), V(0.05, h, 0.04), t, seed + 7, 0, yaw);
  beam(parts.beam, at(0, 0, 0.03), V(w, 0.05, 0.04), t, seed + 8, 0, yaw);
  // the shutters: folded back flat beside the frame; the second one hangs from a single hinge when `askew`
  const sw = w / 2 + 0.04, st = tone(PAL.door, 0.9);
  quad(parts.plank, at(-w / 2 - f - sw, -h / 2, 0.035), u, up, sw, h, st, seed + 5);
  if (askew) {
    const pivot = at(w / 2 + f, h / 2, 0.035), m = new Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
      .multiply(new Matrix4().makeRotationY(yaw)).multiply(new Matrix4().makeRotationZ(-0.32));
    const saved = parts.plank.pre; parts.plank.pre = saved.clone().multiply(m);
    quad(parts.plank, V(0, -h, 0), V(1, 0, 0), up, sw, h, st, seed + 6);
    parts.plank.pre = saved;
  } else quad(parts.plank, at(w / 2 + f, -h / 2, 0.035), u, up, sw, h, st, seed + 6);
}

function geometryOf(part: ShackPart): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(part.pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(part.nor, 3));
  return g;
}

export function buildWinchHouse(): { group: Group; colliders: ColliderDesc[] } {
  const group = new Group(); group.name = 'far.step.winch-house';
  const plank = shackPart('plank'), shingle = shackPart('shingle'), stone = shackPart('stone'), timber = shackPart('beam'), glass = shackPart('beam');
  const parts = { plank, beam: timber, glass };
  const iron = new MeshStandardMaterial({ color: 0x3a3438, roughness: 0.55, metalness: 0.6 });
  const B = tone(PAL.beam, 1);

  // ── the stone footing: battered walls sunk into the turf, a ledge on top, steps up to the door ──
  const b = F.footBase, t = F.footTop, y0 = -0.3;
  const sides: readonly (readonly [Vector3, Vector3, Vector3, Vector3])[] = [
    [V(-b, y0, b), V(b, y0, b), V(t, F.foot, t), V(-t, F.foot, t)], [V(b, y0, -b), V(-b, y0, -b), V(-t, F.foot, -t), V(t, F.foot, -t)],
    [V(b, y0, b), V(b, y0, -b), V(t, F.foot, -t), V(t, F.foot, t)], [V(-b, y0, -b), V(-b, y0, b), V(-t, F.foot, t), V(-t, F.foot, -t)],
  ];
  sides.forEach(([p0, p1, p2, p3], i) => {
    const st = tone(PAL.stone, 0.95 + 0.05 * i), w = 2 * b;
    tri(stone, [p0, p1, p2], [[0, y0], [w, y0], [w - (b - t), F.foot]], st, 11 + i);
    tri(stone, [p0, p2, p3], [[0, y0], [w - (b - t), F.foot], [b - t, F.foot]], st, 11 + i);
  });
  quad(stone, V(-t, F.foot, t), V(1, 0, 0), V(0, 0, -1), 2 * t, 2 * t, tone(PAL.stone, 0.85), 15);
  beam(stone, V(0, 0.3, 2.62), V(1.6, 1.2, 0.46), tone(PAL.stone, 0.92), 16);
  beam(stone, V(1.05, 0.15, 2.62), V(0.5, 0.9, 0.44), tone(PAL.stone, 1.02), 17);
  beam(stone, V(1.52, 0, 2.62), V(0.45, 0.6, 0.42), tone(PAL.stone, 0.96), 18);

  // ── the ground storey: plank walls, corner posts, sill, mid rails and braces ──
  const { gx, gz, foot, band } = F, gh = band - foot;
  const pw = (k: number): Color => tone(PAL.plank, k);
  wall(plank, V(-gx, foot, gz), V(gx, foot, gz), gh, pw(1), 21);
  wall(plank, V(gx, foot, -gz), V(-gx, foot, -gz), gh, pw(0.94), 22);
  wall(plank, V(gx, foot, gz), V(gx, foot, -gz), gh, pw(1.04), 23);
  wall(plank, V(-gx, foot, -gz), V(-gx, foot, gz), gh, pw(0.9), 24);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) beam(timber, V(x * gx, foot + gh / 2, z * gz), V(0.28, gh, 0.28), B, 31 + x + 2 * z);
  for (const s of [1, -1]) {
    beam(timber, V(0, foot + 0.1, s * (gz + 0.03)), V(2 * gx + 0.3, 0.2, 0.2), B, 35 + s);
    beam(timber, V(s * (gx + 0.03), foot + 0.1, 0), V(0.2, 0.2, 2 * gz + 0.3), B, 37 + s);
  }
  beam(timber, V(0, 2.55, -gz - 0.05), V(2 * gx, 0.15, 0.1), B, 40);
  beam(timber, V(-gx - 0.05, 2.95, 0), V(0.1, 0.15, 2 * gz), B, 41);
  strut(timber, V(-gx + 0.2, foot + 0.2, -gz - 0.06), V(-gx + 1.35, band - 0.1, -gz - 0.06), 0.13, B, 42);
  strut(timber, V(gx - 0.2, foot + 0.2, -gz - 0.06), V(gx - 1.35, band - 0.1, -gz - 0.06), 0.13, B, 43);
  strut(timber, V(-gx - 0.06, foot + 0.2, gz - 0.2), V(-gx - 0.06, band - 0.1, gz - 1.35), 0.13, B, 44);
  strut(timber, V(gx + 0.06, foot + 0.2, gz - 0.2), V(gx + 0.06, band - 0.1, gz - 1.2), 0.13, B, 45);

  // the door (+z): a plank leaf on Z-battens in a frame, iron straps, under a small shingled pent roof
  const dz = gz + 0.03;
  quad(plank, V(-0.5, foot + 0.05, dz), V(1, 0, 0), V(0, 1, 0), 1, 2, tone(PAL.door, 1), 51);
  for (const y of [foot + 0.35, foot + 1.75]) beam(timber, V(0, y, dz + 0.04), V(0.96, 0.13, 0.06), tone(PAL.door, 0.8), 52);
  strut(timber, V(-0.4, foot + 0.42, dz + 0.04), V(0.4, foot + 1.68, dz + 0.04), 0.1, tone(PAL.door, 0.8), 53);
  beam(timber, V(-0.58, foot + 1.08, dz + 0.06), V(0.15, 2.16, 0.14), B, 54);
  beam(timber, V(0.58, foot + 1.08, dz + 0.06), V(0.15, 2.16, 0.14), B, 55);
  beam(timber, V(0, foot + 2.2, dz + 0.07), V(1.5, 0.17, 0.16), B, 56);
  const penO = V(-0.95, 3.32, gz + 0.85), penV = V(0, 0.45, -0.85), penL = penV.length(); penV.normalize();
  quad(shingle, penO, V(1, 0, 0), penV, 1.9, penL, tone(PAL.shingle, 1), 57);
  quad(timber, penO.clone().add(V(1.9, -0.06, 0)), V(-1, 0, 0), penV, 1.9, penL, tone(PAL.sheath, 1), 58);
  beam(timber, V(0, 3.29, gz + 0.86), V(2, 0.12, 0.08), B, 59);
  for (const x of [-0.85, 0.85]) strut(timber, V(x, 2.7, gz), V(x, 3.27, gz + 0.78), 0.1, B, 60);

  // the band: a beam ring with the joist ends showing under it
  for (const s of [1, -1]) {
    beam(timber, V(0, band + 0.12, s * (F.uz + 0.04)), V(2 * F.ux + 0.3, 0.26, 0.3), B, 61 + s);
    beam(timber, V(s * (F.ux + 0.04), band + 0.12, 0), V(0.3, 0.26, 2 * F.uz + 0.3), B, 63 + s);
  }
  for (let i = -3; i <= 3; i++) {
    beam(timber, V(gx + 0.1, band - 0.1, i * 0.62), V(0.24, 0.14, 0.14), B, 70 + i);
    beam(timber, V(-gx - 0.1, band - 0.1, i * 0.62), V(0.24, 0.14, 0.14), B, 80 + i);
  }

  // ground-storey window on the west wall, its second shutter hanging askew
  windowOn(parts, V(-gx, 2.35, -0.6), V(-1, 0, 0), 0.62, 0.72, 91, true);

  // ── the upper storey and roof: leaned a little toward the bridge side and back ──
  const lean = leanAbove(band, 0.028, -0.014);
  for (const p of [plank, shingle, stone, timber, glass]) p.pre = lean;
  const { ux, uz, plate, ridge } = F, top = band + 0.25, uh = plate - top;
  const pu = (k: number): Color => tone(PAL.plankHi, k);
  wall(plank, V(-ux, top, uz), V(ux, top, uz), uh, pu(1), 101);
  wall(plank, V(ux, top, -uz), V(-ux, top, -uz), uh, pu(0.93), 102);
  wall(plank, V(ux, top, uz), V(ux, top, -uz), uh, pu(1.05), 103);
  wall(plank, V(-ux, top, -uz), V(-ux, top, uz), uh, pu(0.9), 104);
  // the gables (±z)
  for (const s of [1, -1]) {
    const l = V(-s * ux, plate, s * uz), r = V(s * ux, plate, s * uz), apex = V(0, ridge, s * uz);
    tri(plank, [l, r, apex], [[-s * ux, plate], [s * ux, plate], [0, ridge]], pu(s > 0 ? 1.02 : 0.92), 105 + s);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) beam(timber, V(x * ux, top + (uh - 0.25) / 2, z * uz), V(0.24, uh - 0.25, 0.24), B, 111 + x + 2 * z);
  for (const s of [1, -1]) {
    beam(timber, V(s * (ux + 0.02), plate - 0.3, 0), V(0.2, 0.18, 2 * uz + 0.24), B, 115 + s);
    beam(timber, V(0, plate - 0.3, s * (uz + 0.02)), V(2 * ux + 0.24, 0.18, 0.2), B, 117 + s);
  }
  strut(timber, V(-ux + 0.18, top + 0.1, uz + 0.05), V(-0.75, plate - 0.15, uz + 0.05), 0.12, B, 120);
  strut(timber, V(ux - 0.18, top + 0.1, uz + 0.05), V(0.75, plate - 0.15, uz + 0.05), 0.12, B, 121);
  strut(timber, V(-ux - 0.05, top + 0.1, -uz + 0.18), V(-ux - 0.05, plate - 0.15, -0.2), 0.12, B, 122);
  strut(timber, V(ux + 0.05, top + 0.1, uz - 0.18), V(ux + 0.05, plate - 0.15, 0.6), 0.12, B, 123);
  windowOn(parts, V(0, 5.75, uz), V(0, 0, 1), 0.8, 0.95, 131);
  windowOn(parts, V(-ux, 5.8, 0.75), V(-1, 0, 0), 0.7, 0.82, 141);
  windowOn(parts, V(ux, 5.8, -0.9), V(1, 0, 0), 0.7, 0.82, 151);
  windowOn(parts, V(0, 6.0, -uz), V(0, 0, -1), 0.55, 0.62, 161, true);
  windowOn(parts, V(0, 8.3, uz), V(0, 0, 1), 0.4, 0.42, 171);

  // the roof: two shingled slopes with a sheathed underside, fascia, a ridge cap, barge boards crossed into horns
  const ex = ux + F.eave, ey = plate - F.eave * ((ridge - plate) / ux), ez = uz + F.gable, rise = V(ex, ridge - ey, 0), slope = rise.length();
  for (const s of [1, -1]) {
    const up = V(-s * ex, ridge - ey, 0).normalize();
    quad(shingle, V(s * ex, ey, s * ez), V(0, 0, -s), up, 2 * ez, slope, tone(PAL.shingle, s > 0 ? 1.04 : 0.96), 181 + s);
    quad(timber, V(s * ex, ey - 0.1, -s * ez), V(0, 0, s), up, 2 * ez, slope, tone(PAL.sheath, 1), 183 + s);
    beam(timber, V(s * (ex - 0.02), ey - 0.07, 0), V(0.08, 0.22, 2 * ez), B, 185 + s);
  }
  beam(timber, V(0, ridge + 0.02, 0), V(0.24, 0.24, 2 * ez + 0.06), tone(PAL.beam, 0.9), 187);
  for (const s of [1, -1]) {
    const z = s * (ez + 0.02);
    for (const side of [1, -1]) {
      const a = V(side * (ex + 0.06), ey - 0.12, z), r = V(0, ridge + 0.06, z), dir = r.clone().sub(a).normalize();
      strut(timber, a, r.clone().addScaledVector(dir, 0.55), 0.26, B, 190 + s * 3 + side, 0.09);
    }
  }

  // ── the meshes ──
  for (const p of [plank, shingle, stone, timber]) group.add(shackMesh(p, `far.winch.${p.kind}`));
  const pane = new Mesh(geometryOf(glass), new MeshStandardMaterial({ color: 0x15131a, emissive: 0x2a1a0c, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.1 }));
  pane.name = 'far.winch.glass'; group.add(pane);

  // the stovepipe through the west slope (in the leaned frame)
  const pipeAt = V(-1.15, 8.35, -1.05).applyMatrix4(lean);
  const pipe = new Mesh(new CylinderGeometry(0.13, 0.13, 1.7, 8), iron); pipe.position.copy(pipeAt).add(V(0, 0.4, 0)); group.add(pipe);
  const cap = new Mesh(new CylinderGeometry(0.28, 0.16, 0.16, 8), iron); cap.position.copy(pipeAt).add(V(0, 1.3, 0)); group.add(cap);

  // iron straps on the door
  for (const y of [foot + 0.35, foot + 1.75]) {
    const strap = new Mesh(new BoxGeometry(0.62, 0.07, 0.03), iron); strap.position.set(-0.2, y + 0.1, dz + 0.085); group.add(strap);
  }

  // ── the winch wheel on the bridge side (+x): a timber wheel on an iron axle, braced to the wall ──
  for (const p of [plank, shingle, stone, timber, glass]) p.pre = new Matrix4();
  const wheel = shackPart('beam'), wc = V(gx + 0.62, 2.62, -0.15), R = 1.3, n = 12;
  const onWheel = (a: number, r: number): Vector3 => wc.clone().add(V(0, Math.sin(a) * r, Math.cos(a) * r));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    strut(wheel, onWheel(a0 - 0.03, R), onWheel(a1 + 0.03, R), 0.17, tone(PAL.beam, 1.08), 201 + i);
    strut(wheel, onWheel(a0, R - 0.02), onWheel(a0, R + 0.32), 0.09, tone(PAL.beam, 1.15), 221 + i);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    strut(wheel, onWheel(a, R), onWheel(a + Math.PI, R), 0.11, tone(PAL.beam, 1.1), 241 + i);
  }
  strut(wheel, V(gx + 0.12, foot + 0.15, -1.25), V(gx + 0.38, wc.y, wc.z), 0.16, B, 251);
  strut(wheel, V(gx + 0.12, foot + 0.15, 0.95), V(gx + 0.38, wc.y, wc.z), 0.16, B, 252);
  group.add(shackMesh(wheel, 'far.winch.wheel'));
  const axle = new Mesh(new CylinderGeometry(0.1, 0.1, 0.95, 8), iron); axle.rotation.z = Math.PI / 2; axle.position.set(gx + 0.45, wc.y, wc.z); group.add(axle);
  const hub = new Mesh(new CylinderGeometry(0.24, 0.24, 0.26, 10), iron); hub.rotation.z = Math.PI / 2; hub.position.copy(wc); group.add(hub);

  // the teal banner beside the door, hung from the band
  const banner = new Mesh(new BoxGeometry(0.8, 2.1, 0.03), new MeshStandardMaterial({ color: 0x2f8a8c, roughness: 0.9, metalness: 0, side: DoubleSide, emissive: 0x0c2a2a }));
  banner.position.set(-1.4, band - 1.1, gz + 0.1); group.add(banner);
  const rod = new Mesh(new CylinderGeometry(0.03, 0.03, 1.0, 5), iron); rod.rotation.z = Math.PI / 2; rod.position.set(-1.4, band - 0.04, gz + 0.12); group.add(rod);

  group.position.set(WINCH_HOUSE.x, STEP.y, WINCH_HOUSE.z);
  const { w, h } = WINCH_HOUSE;
  return { group, colliders: [boxDesc({ x: WINCH_HOUSE.x, z: WINCH_HOUSE.z, hw: w * 0.62, hd: w * 0.62, rot: 0, yBottom: STEP.y, yTop: STEP.y + h }, 'stone')] };
}

/** A kind's extra row field: the shack shader that draws it (a stand-in material's `userData.shack`). */
const shackRow = (material: MeshStandardMaterial): KindExtra => {
  const kind: unknown = material.userData['shack'];
  return typeof kind === 'string' ? { shack: kind } : {};
};

/**
 * The winch house folded into instanced kinds (every part keeps its transform in the house's own frame: the client stands
 * the piece at WINCH_HOUSE on the step, so a part draws through the same matrices as before), its `shk` channel kept, and
 * its collider.
 */
export function bakeSkyWinchHouse(): PieceBake {
  const built = buildWinchHouse();
  built.group.position.set(0, 0, 0);
  return bakeKinds('far.winch-house', foldKinds(built.group, { extra: shackRow }), built.colliders, { extra: shackRow, attributes: { _SHK: 'shk' } });
}
