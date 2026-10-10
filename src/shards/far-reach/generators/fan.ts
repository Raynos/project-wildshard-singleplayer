import { BufferGeometry, CapsuleGeometry, CatmullRomCurve3, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Quaternion, Shape, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { FAN } from '../weapons/fanModel';
import { ARM_DIR, GLOVE, gloveWrist } from '../weapons/glove';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): the war fan's built shapes (weapons/fanModel.ts, mockup C), baked by
 * `scripts/bake-sky-world.mjs` into `baked/fan.bin` (a deflated `@wildshard/sdk/kit/geometryPack`) + `data/fan.json`; the
 * page draws each in its own material (`fanParts`). Local frame: the pivot at the origin, the fan opens up (+Y) in the XY
 * plane facing +Z (the camera).
 */

/** The fan's baked shapes, each a geometry of the pack. */
export interface FanRows extends PackedGeometryRows { panels: number; sticks: number; straps: number; guards: number; rim: number; plates: number; strands: number; leather: number; sleeve: number }

/**
 * The leaf (loop 4): each panel is a real pleat, two strips meeting at a raised crease, mapped polar onto the painted silk
 * (`public/assets/far-reach/fan/leaf.webp`: u across the open fan guard to guard, v from the leaf's inner edge out to the
 * gilt rim). The vertex colour shades the pleat's two faces apart (one toward the light, one turned away), so the folds
 * read even under the flat viewmodel light.
 */
function fanPanels(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], nor: number[] = [], uv: number[] = [], from = -FAN.spread / 2, step = FAN.spread / FAN.panels, inner = FAN.leaf;
  const rings = [inner, 0.62, 0.82, 1];
  const at = (a: number, r: number): [number, number] => [Math.sin(a) * r * FAN.reach, Math.cos(a) * r * FAN.reach];
  const vert = (a: number, r: number, z: number, shade: number): void => {
    const [x, y] = at(a, r); pos.push(x, y, z); col.push(shade, shade, shade); nor.push(0, 0, 1);
    uv.push((a - from) / FAN.spread, (r - inner) / (1 - inner));
  };
  for (let i = 0; i < FAN.panels; i++) {
    const a = from + i * step, m = a + step / 2, b = a + step;
    // the crease stands proud toward the camera; the two faces of the pleat take the light differently
    // row 3 (E407): the folds deeper and the turned-away face darker (mockup C's pleats read as real folds, ours as flat)
    const crease = 0.018;
    for (let k = 0; k + 1 < rings.length; k++) {
      const r0 = rings[k] ?? inner, r1 = rings[k + 1] ?? 1;
      for (const [x0, x1, z0, z1, shade] of [[a, m, 0, crease, 0.62], [m, b, crease, 0, 1]] as const) {
        vert(x0, r0, z0 * r0, shade); vert(x1, r0, z1 * r0, shade); vert(x1, r1, z1 * r1, shade);
        vert(x0, r0, z0 * r0, shade); vert(x1, r1, z1 * r1, shade); vert(x0, r1, z0 * r1, shade);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** One cross-section of a stick: at radius `r` (fraction of the reach), `w` metres wide, in colour `c`. */
interface Station { readonly r: number; readonly w: number; readonly c: Color }
/**
 * A flat stick along the angle `a` through its stations: a slim prism (front, back and two sides), coloured per station
 * (the lacquer darker at the root, lighter toward the tip, a bronze tip).
 */
function stick(a: number, stations: readonly Station[], z0: number, z1: number, pos: number[], col: number[]): void {
  const s = Math.sin(a), c = Math.cos(a), px = c, py = -s; // across the stick, in the fan plane
  const corner = (st: Station, side: number, z: number): [number, number, number] => {
    const R = st.r * FAN.reach; return [s * R + px * side * st.w / 2, c * R + py * side * st.w / 2, z];
  };
  const quad = (p: readonly [number, number, number][], k: readonly Color[]): void => {
    for (const i of [0, 1, 2, 0, 2, 3]) { const v = p[i], q = k[i]; if (v === undefined || q === undefined) continue; pos.push(...v); col.push(q.r, q.g, q.b); }
  };
  for (let i = 0; i + 1 < stations.length; i++) {
    const A = stations[i], B = stations[i + 1]; if (A === undefined || B === undefined) continue;
    const side = A.c.clone().multiplyScalar(0.55), sideB = B.c.clone().multiplyScalar(0.55);
    quad([corner(A, -1, z1), corner(A, 1, z1), corner(B, 1, z1), corner(B, -1, z1)], [A.c, A.c, B.c, B.c]);
    quad([corner(A, 1, z0), corner(A, -1, z0), corner(B, -1, z0), corner(B, 1, z0)], [side, side, sideB, sideB]);
    quad([corner(A, -1, z0), corner(A, -1, z1), corner(B, -1, z1), corner(B, -1, z0)], [side, side, sideB, sideB]);
    quad([corner(A, 1, z1), corner(A, 1, z0), corner(B, 1, z0), corner(B, 1, z1)], [side, side, sideB, sideB]);
  }
}

/** The sticks as one vertex-coloured geometry (dark lacquered wood, bronze tips); the two guards are extrusions (below). */
function fanSticks(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], from = -FAN.spread / 2, step = FAN.spread / FAN.panels;
  // E399 round 6 (the seats: 'flat matte brown sticks', read red-brown under the warm rim): mockup C's sticks are a dark,
  // cool lacquered wood with lighter edges
  const root = new Color(0x1c1814), wood = new Color(0x302a24), grain = new Color(0x463e34), tip = new Color(0x7a6644);
  for (let i = 1; i < FAN.panels; i++) {
    const a = from + i * step;
    // a stick: wide and flat through the bare part (they nearly meet at the leaf), a slim rib laid over the silk
    stick(a, [{ r: 0.03, w: 0.009, c: root }, { r: FAN.leaf * 0.6, w: 0.016, c: wood }, { r: FAN.leaf + 0.03, w: 0.019, c: grain }], -0.002, 0.006, pos, col);
    stick(a, [{ r: FAN.leaf + 0.02, w: 0.0062, c: wood }, { r: 0.9, w: 0.005, c: grain }, { r: 0.985, w: 0.0045, c: tip }], 0.004, 0.011, pos, col);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A guard's end plate (row 3, mockup C's 'angular iron guards'): a faceted iron arrowhead with a pierced diamond, `l` long
 * and `w` wide, lying in XY along +Y, its edges a real chamfer.
 */
function guardPlate(l: number, w: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0); s.lineTo(w * 0.32, l * 0.06); s.lineTo(w * 0.5, l * 0.38); s.lineTo(w * 0.36, l * 0.5); s.lineTo(w * 0.42, l * 0.62); s.lineTo(0, l);
  s.lineTo(-w * 0.42, l * 0.62); s.lineTo(-w * 0.36, l * 0.5); s.lineTo(-w * 0.5, l * 0.38); s.lineTo(-w * 0.32, l * 0.06); s.lineTo(0, 0);
  const hole = new Shape(); hole.moveTo(0, l * 0.28); hole.lineTo(w * 0.17, l * 0.46); hole.lineTo(0, l * 0.64); hole.lineTo(-w * 0.17, l * 0.46); hole.lineTo(0, l * 0.28);
  s.holes.push(hole);
  return new ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0014, bevelSize: 0.0014, bevelSegments: 1, curveSegments: 1 });
}

/**
 * A guard's outline along +Y (fractions of the reach, half widths in metres): a slim root, a straight shaft that widens a
 * little to a shoulder past the leaf's middle, then an angular, faceted point beyond the rim.
 */
const GUARD: readonly (readonly [number, number])[] = [[0, 0.0105], [0.3, 0.0135], [0.74, 0.0155], [0.8, 0.0235], [0.93, 0.021], [1.0, 0.0125], [1.1, 0]];
/** The guard's outline in metres; `grow` offsets it outward (the bronze edging behind the wood). */
function guardShape(grow: number): Shape {
  const s = new Shape(), R = FAN.reach, side = GUARD.map(([r, w]) => [w + grow, r * R + (r === 0 ? -grow : 0)] as const), tip = side[side.length - 1];
  s.moveTo(-(side[0]?.[0] ?? 0), side[0]?.[1] ?? 0);
  for (const [x, y] of side.slice(0, -1)) s.lineTo(x, y);
  if (tip !== undefined) s.lineTo(0, tip[1] + grow * 1.6);
  for (const [x, y] of side.slice(0, -1).reverse()) s.lineTo(-x, y);
  return s;
}

const capsuleBetween = (a: Vector3, b: Vector3, r: number): BufferGeometry => {
  const d = b.clone().sub(a), len = d.length(), g = new CapsuleGeometry(r, Math.max(0.0005, len), 3, 8);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); return g;
};
/**
 * The code hand's glove (weapons/glove.ts gloveHand, loop 5, mockup C's "target C"): four three-jointed fingers curled
 * across the front of the grip, the palm and the back of the hand, the thumb laid over the fingers and the wrist out
 * toward the arm, as one leather geometry.
 */
function gloveLeather(): BufferGeometry {
  // the fingers: index at the top, little finger lowest; each curls from the knuckle (back, +x−z) round the front (+z)
  // to its tip pressed on the far side of the grip (−x)
  const R = GLOVE.grip + GLOVE.finger * 0.95, parts: BufferGeometry[] = [];
  for (let f = 0; f < 4; f++) {
    const y = -f * GLOVE.spacing, r = GLOVE.finger * (1 - f * 0.07), reach = 1 - f * 0.08;
    const at = (deg: number, rr = R): Vector3 => { const a = (deg * Math.PI) / 180; return new Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); };
    const knuckle = at(-35, R + 0.012), p1 = at(30), p2 = at(100), tip = at(100 + 70 * reach);
    parts.push(capsuleBetween(knuckle, p1, r), capsuleBetween(p1, p2, r * 0.95), capsuleBetween(p2, tip, r * 0.88));
  }
  // the palm and the back of the hand: a rounded block behind the grip, the knuckle ridge on its front edge
  const palm = new SphereGeometry(1, 12, 10); palm.scale(0.03, 0.048, 0.024); palm.translate(0.034, -0.032, -0.012); parts.push(palm);
  // the thumb: from the palm's heel round over the index and middle fingers
  const t0 = new Vector3(0.03, -0.07, 0.016), t1 = new Vector3(0.016, -0.03, 0.03), t2 = new Vector3(-0.004, -0.008, 0.032);
  parts.push(capsuleBetween(t0, t1, 0.012), capsuleBetween(t1, t2, 0.0105));
  // the wrist, out of the palm toward the arm
  const wrist0 = gloveWrist(), dir = ARM_DIR.clone().normalize();
  parts.push(capsuleBetween(wrist0, wrist0.clone().addScaledVector(dir, 0.05), 0.026));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
/**
 * The code hand's sleeve (council round 2: "a plain cream tube"): loose linen in soft folds, the fold valleys shaded, a
 * woven teal-and-gold border at the cuff end.
 */
function gloveSleeve(): BufferGeometry {
  const sleeveGeo = new CylinderGeometry(0.041, 0.058, 0.34, 20, 10), sp = sleeveGeo.getAttribute('position'), sc: number[] = [];
  const cream = new Color(0xece2cc), shadow = new Color(0xb9ab92), teal = new Color(0x2f8a8c), gold = new Color(0xc79a4a), out = new Color();
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, x), fold = Math.sin(a * 5 + y * 14) * 0.5 + 0.5;
    const k = 1 + 0.09 * fold; sp.setXYZ(i, x * k, y, z * k);
    out.copy(cream).lerp(shadow, (1 - fold) * 0.55);
    const t = (y + 0.17) / 0.34;
    if (t > 0.04 && t < 0.1) out.copy(teal); else if (t >= 0.1 && t < 0.13) out.copy(gold);
    sc.push(out.r, out.g, out.b);
  }
  sleeveGeo.setAttribute('color', new Float32BufferAttribute(sc, 3)); sleeveGeo.computeVertexNormals();
  return sleeveGeo;
}

/**
 * The fan's shapes as the page drew them: the leaf, the sticks, the guards' iron backings and lacquered wood, the gilt rim,
 * the bronze plates, studs, boss and rivet (one geometry), the tassel's fringe, and the code hand's leather and sleeve.
 */
export function bakeSkyFan(): { bin: Uint8Array; rows: FanRows } {
  const pack = new GeometryPackWriter('far-reach fan'), panels = pack.add(fanPanels()), sticks = pack.add(fanSticks());
  // the guards' metal (E399 round 6, mockup C: 'riveted metal guards with engraved end caps', every seat since round 3):
  // each guard sheathed in a dark iron strap from the grip to past the leaf, riveted along its length, an engraved bronze
  // cap at its tip and a smaller one at its root; a bronze stud on every stick where the leaf starts
  const from = -FAN.spread / 2, plates: BufferGeometry[] = [], straps: BufferGeometry[] = [], guardWood: BufferGeometry[] = [];
  const along = (a: number, r: number, z: number): [number, number, number] => [Math.sin(a) * r * FAN.reach, Math.cos(a) * r * FAN.reach, z];
  for (const a of [from, -from]) {
    for (const [r, l, w] of [[0.8, 0.105, 0.05], [0.03, 0.05, 0.03]] as const) {
      const p = guardPlate(l, w); p.rotateZ(-a); p.translate(...along(a, r, 0.0185)); plates.push(p);
    }
    // row 3 (E407; the seats: 'plain guards'): each guard a chamfered extrusion of dark lacquered wood on a slightly
    // larger bronze-edged iron backing (so a metal rim runs round it), the angular plates and rivets on top
    const wood = new ExtrudeGeometry(guardShape(0), { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0013, bevelSize: 0.0013, bevelSegments: 1, curveSegments: 1 });
    wood.translate(0, 0, 0.012); wood.rotateZ(-a); guardWood.push(wood);
    const back = new ExtrudeGeometry(guardShape(0.0026), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 1 });
    back.translate(0, 0, 0.0095); back.rotateZ(-a); straps.push(back);
    for (let r = 0.16; r < 0.76; r += 0.085) {
      const stud = new SphereGeometry(0.0034, 6, 4); stud.scale(1, 1, 0.6); stud.translate(...along(a, r, 0.0196)); plates.push(stud);
    }
  }
  for (let i = 1; i < FAN.panels; i++) {
    const a = from + i * (FAN.spread / FAN.panels), stud = new SphereGeometry(0.0036, 6, 4); stud.scale(1, 1, 0.55); stud.translate(...along(a, FAN.leaf + 0.03, 0.012)); plates.push(stud);
  }
  const strapsAt = pack.add(mergeGeometries(straps)), guards = pack.add(mergeGeometries(guardWood));
  // the gilt rim along the leaf's outer edge (mockup C's lit edge)
  const rimPoints: Vector3[] = [];
  for (let i = 0; i <= 24; i++) { const a = from + (i / 24) * FAN.spread; rimPoints.push(new Vector3(Math.sin(a) * FAN.reach, Math.cos(a) * FAN.reach, 0.004)); }
  const rim = pack.add(new TubeGeometry(new CatmullRomCurve3(rimPoints), 48, 0.003, 4, false));
  // the pivot: a bronze boss and its rivet
  const boss = new CylinderGeometry(0.017, 0.019, 0.012, 14); boss.rotateX(Math.PI / 2); boss.translate(0, 0, 0.012); plates.push(boss);
  const rivet = new SphereGeometry(0.008, 8, 6); rivet.translate(0, 0, 0.019); plates.push(rivet);
  const platesAt = pack.add(mergeGeometries(plates.map((g) => g.index === null ? g : g.toNonIndexed())));
  // the tassel's long silk fringe (mockup C)
  const fringe: BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, r = i === 0 ? 0 : 0.0045, len = 0.075 + ((i * 37) % 7) * 0.003, g = new CylinderGeometry(0.0016, 0.0024, len, 3);
    g.translate(0, -len / 2, 0); g.rotateZ(Math.cos(a) * 0.07); g.rotateX(Math.sin(a) * 0.07); g.translate(Math.cos(a) * r, -0.076, Math.sin(a) * r); fringe.push(g.toNonIndexed());
  }
  const strands = pack.add(mergeGeometries(fringe)), leather = pack.add(gloveLeather()), sleeve = pack.add(gloveSleeve());
  return { bin: pack.bytes(), rows: { ...pack.rows(), panels, sticks, straps: strapsAt, guards, rim, plates: platesAt, strands, leather, sleeve } };
}
