import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { gloveHand, heroHand } from './glove';

/**
 * The war fan to mockup C (round-18-council-mockups; E399 seats: "the fan is plain and bright, thin gold ribs on flat
 * teal"): a folding fan whose cloud-silk leaf (nine pleats) covers only its outer part; below it the bare dark-lacquered
 * sticks fan out to a bronze pivot; two heavy dark guard sticks with ornate bronze end plates and studs; a wrapped grip;
 * a red silk tassel with a knot and a bead; held in the gloved hand (weapons/glove.ts).
 *
 * Local frame: the pivot at the origin, the fan opens up (+Y) in the XY plane facing +Z (the camera); the grip runs down
 * −Y into the fist.
 */
export const FAN = { panels: 9, reach: 0.31, spread: Math.PI * 0.68, grip: 0.07, leaf: 0.42 } as const;
/** The silk's grade: how much of the paint's saturation stays, the lift after it and a tint toward blue (measured against the mockups' leaf, where blue >= green). */
export const SILK = { saturation: 0.8, lift: 2.6, tint: [0.94, 1.0, 1.16] } as const;

/**
 * The leaf (loop 4): each panel is a real pleat, two strips meeting at a raised crease, mapped polar onto the painted silk
 * (`public/assets/far-reach/fan/leaf.webp`: u across the open fan guard to guard, v from the leaf's inner edge out to the
 * gilt rim). The vertex colour shades the pleat's two faces apart (one toward the light, one turned away), so the folds
 * read even under the flat viewmodel light; without the texture the silk is one plain teal.
 */
export function fanPanels(): BufferGeometry {
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

/** One cross-section of a stick: at radius `r` (fraction of the reach), `w` metres wide, from `z0` back to `z1` front. */
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

/** The sticks and the two guards as one vertex-coloured geometry (dark lacquered wood, bronze tips). */
export function fanSticks(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], from = -FAN.spread / 2, step = FAN.spread / FAN.panels;
  // a brown wood, not near-black (the seats read the rim-lit black lacquer as red ribs; the mockups' are slim brown wood)
  // E399 round 6 (the seats: 'flat matte brown sticks', read red-brown under the warm rim): mockup C's sticks are a dark,
  // cool lacquered wood with lighter edges
  const root = new Color(0x1c1814), wood = new Color(0x302a24), grain = new Color(0x463e34), tip = new Color(0x7a6644);
  for (let i = 0; i <= FAN.panels; i++) {
    const a = from + i * step, guard = i === 0 || i === FAN.panels;
    // the two guards are chamfered extrusions (fanParts: guardShape), not sticks
    if (!guard) {
      // a stick: wide and flat through the bare part (they nearly meet at the leaf), a slim rib laid over the silk
      stick(a, [{ r: 0.03, w: 0.009, c: root }, { r: FAN.leaf * 0.6, w: 0.016, c: wood }, { r: FAN.leaf + 0.03, w: 0.019, c: grain }], -0.002, 0.006, pos, col);
      stick(a, [{ r: FAN.leaf + 0.02, w: 0.0062, c: wood }, { r: 0.9, w: 0.005, c: grain }, { r: 0.985, w: 0.0045, c: tip }], 0.004, 0.011, pos, col);
    }
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
 * A guard's outline along +Y (metres): a slim root, a straight shaft that widens a little to a shoulder past the leaf's
 * middle, then an angular, faceted point beyond the rim. `grow` offsets it outward (the bronze edging behind the wood).
 */
export const GUARD: readonly (readonly [number, number])[] = [[0, 0.0105], [0.3, 0.0135], [0.74, 0.0155], [0.8, 0.0235], [0.93, 0.021], [1.0, 0.0125], [1.1, 0]];
function guardShape(grow: number): Shape {
  const s = new Shape(), R = FAN.reach, side = GUARD.map(([r, w]) => [w + grow, r * R + (r === 0 ? -grow : 0)] as const), tip = side[side.length - 1];
  s.moveTo(-(side[0]?.[0] ?? 0), side[0]?.[1] ?? 0);
  for (const [x, y] of side.slice(0, -1)) s.lineTo(x, y);
  if (tip !== undefined) s.lineTo(0, tip[1] + grow * 1.6);
  for (const [x, y] of side.slice(0, -1).reverse()) s.lineTo(-x, y);
  return s;
}

export interface FanParts { readonly group: Group; readonly fan: Group; readonly tassel: Group; readonly silk: MeshStandardMaterial }

export function fanParts(): FanParts {
  const group = new Group(), fan = new Group();
  // untextured (the Model Explorer, before the leaf loads) the silk is a muted teal; `setLeaf` paints it
  const silk = new MeshStandardMaterial({ vertexColors: true, color: 0x2f7c7a, roughness: 0.8, metalness: 0, side: 2, emissive: 0x041212 });
  // the painted silk toward the mockups' muted, lighter teal (E399 round 6, measured in the leaf region: mockup C's median
  // 47,91,97 and A's 55,71,77 against ours 2,48,49, its red channel at 0-2): part-way to grey, then lifted
  patchShader(silk, 'far.fan-silk', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, ${SILK.saturation.toFixed(2)}) * ${SILK.lift.toFixed(2)} * vec3(${SILK.tint.map((v) => v.toFixed(2)).join(', ')});`);
  }, { key: (prior) => `${prior}|far.fan-silk` });
  const lacquer = new MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.1, side: 2 });
  const bronze = new MeshStandardMaterial({ color: 0x7a5c32, roughness: 0.42, metalness: 0.55, emissive: 0x0a0602 });
  const wrap = new MeshStandardMaterial({ color: 0x2c1c14, roughness: 0.85, metalness: 0 });
  const red = new MeshStandardMaterial({ color: 0xa8201a, roughness: 0.75, metalness: 0, emissive: 0x1e0403 });
  fan.add(new Mesh(fanPanels(), silk), new Mesh(fanSticks(), lacquer));
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
  const iron = new MeshStandardMaterial({ color: 0x6a5232, roughness: 0.4, metalness: 0.75, emissive: 0x080503 });
  fan.add(new Mesh(mergeGeometries(straps), iron));
  const guardLacquer = new MeshStandardMaterial({ color: 0x2a2420, roughness: 0.34, metalness: 0.08 });
  fan.add(new Mesh(mergeGeometries(guardWood), guardLacquer));
  for (const g of [...straps, ...guardWood]) g.dispose();
  // the gilt rim along the leaf's outer edge (mockup C's lit edge)
  const rim: Vector3[] = [];
  for (let i = 0; i <= 24; i++) { const a = from + (i / 24) * FAN.spread; rim.push(new Vector3(Math.sin(a) * FAN.reach, Math.cos(a) * FAN.reach, 0.004)); }
  fan.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(rim), 48, 0.003, 4, false), new MeshStandardMaterial({ color: 0xc49a52, roughness: 0.35, metalness: 0.6, emissive: 0x1a1006 })));
  // the pivot: a bronze boss and its rivet
  const boss = new CylinderGeometry(0.017, 0.019, 0.012, 14); boss.rotateX(Math.PI / 2); boss.translate(0, 0, 0.012); plates.push(boss);
  const rivet = new SphereGeometry(0.008, 8, 6); rivet.translate(0, 0, 0.019); plates.push(rivet);
  fan.add(new Mesh(mergeGeometries(plates.map((g) => g.index === null ? g : g.toNonIndexed())), bronze));
  for (const g of plates) g.dispose();
  const grip = new Mesh(new CylinderGeometry(0.016, 0.018, FAN.grip, 10), wrap); grip.position.y = -FAN.grip / 2; fan.add(grip);
  const ring = new Mesh(new TorusGeometry(0.009, 0.0025, 5, 12), bronze); ring.position.y = -FAN.grip - 0.006; fan.add(ring);
  // the tassel (mockup C): a red cord, a knot, a bronze bead and cap, and a long silk fringe
  const tassel = new Group(); tassel.position.set(0, -FAN.grip - 0.012, 0); fan.add(tassel);
  const cord = new Mesh(new CylinderGeometry(0.0022, 0.0022, 0.04, 4), red); cord.position.y = -0.02; tassel.add(cord);
  const knot = new Mesh(new SphereGeometry(0.009, 8, 6), red); knot.scale.set(1.2, 0.8, 0.7); knot.position.y = -0.042; tassel.add(knot);
  const loops = new Mesh(new TorusGeometry(0.008, 0.0025, 4, 10), red); loops.position.y = -0.042; loops.scale.set(1.6, 1, 1); tassel.add(loops);
  const bead = new Mesh(new SphereGeometry(0.0055, 8, 6), bronze); bead.position.y = -0.058; tassel.add(bead);
  const cap = new Mesh(new CylinderGeometry(0.0045, 0.007, 0.012, 8), bronze); cap.position.y = -0.07; tassel.add(cap);
  const strands: BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, r = i === 0 ? 0 : 0.0045, len = 0.075 + ((i * 37) % 7) * 0.003, g = new CylinderGeometry(0.0016, 0.0024, len, 3);
    g.translate(0, -len / 2, 0); g.rotateZ(Math.cos(a) * 0.07); g.rotateX(Math.sin(a) * 0.07); g.translate(Math.cos(a) * r, -0.076, Math.sin(a) * r); strands.push(g.toNonIndexed());
  }
  tassel.add(new Mesh(mergeGeometries(strands), red));
  group.add(fan);
  // the gloved hand closes round the grip (weapons/glove.ts: the textured hero hand when it loaded, else the code hand);
  // the forearm runs out to the frame's right edge (E399 seats: 'a long cylinder up through the GUST / JUMP / LOOK buttons')
  const hero = heroHand();
  if (hero === null) { const hand = gloveHand(); hand.position.y = -FAN.grip * 0.35; group.add(hand); }
  else {
    // the hero hand brings its own wrapped handle with bronze caps: the code grip goes, the tassel hangs from its foot
    // row 3 (mockup C): the tassel hangs from the pivot boss in front of the fist (it hung below the fist, off the frame)
    group.add(hero.group); grip.visible = false; ring.position.y = -hero.grip - 0.006; tassel.position.set(0, -0.004, 0.028);
  }
  return { group, fan, tassel, silk };
}

/** The viewmodel root (kept for the Model Explorer and older callers). */
export function fanModel(): Group { return fanParts().group; }
