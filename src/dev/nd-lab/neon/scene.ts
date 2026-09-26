// The throwaway test scene for the neon lab: a short wet plaza street (8 m wide) between two walls of towers, a
// cinnabar paifang with a gold-on-lacquer 九龍 plaque, 18 neon signs on both walls, two lantern strings across the
// street plus lanterns under the gate, lit shopfronts and amber windows, silk fog. Only as much architecture as the
// light needs to read against: walls are one ruled wash program (floors, window modules, lit windows).
import {
  BackSide, BufferGeometry, Float32BufferAttribute, Mesh, type Object3D, ShaderMaterial, SphereGeometry, Uint32BufferAttribute, Vector3,
} from 'three';
import { FOG, LIGHTS, NOISE } from './glsl';
import { Cables, Lanterns } from './lanterns';
import { type Emitter, type LabShared, NEON, lin } from './shared';
import { NeonSigns, type SignDef } from './signs';
import type { GlyphAtlas } from './glyphs';
import { WetGround } from './wetground';

// ── the wash program: flat colour × top light (2 bands) + spill, ruled edges at the face borders, windows on walls ──
const VS_WASH = /* glsl */ `
attribute vec2 aFaceUv;   // metres across the face
attribute vec2 aFaceSize; // the face size, metres
attribute vec4 aKind;     // x: kind (0 plain, 1 facade with windows, 2 shopfront glow, 3 roof tiles), y: seed, z: line weight, w: emissive gain
varying vec2 vF;
varying vec2 vFS;
varying vec4 vK;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
void main() {
  vF = aFaceUv; vFS = aFaceSize; vK = aKind; vCol = color;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_WASH = /* glsl */ `
${NOISE}
${FOG}
${LIGHTS}
uniform vec3 uInk;
uniform vec3 uAmbient;
uniform vec3 uWinWarm;
uniform float uSpillOn;
uniform float uWinGain;
varying vec2 vF;
varying vec2 vFS;
varying vec4 vK;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vCol;
float lineAt(float d, float fw, float w) { return 1.0 - smoothstep(w * fw * 0.5, w * fw * 0.5 + fw, d); }
void main() {
  vec3 n = normalize(vN);
  float kind = floor(vK.x + 0.5);
  // two hard bands: lit from the sky screens above, shade = the wash × a heavy-ink tint (never black)
  float top = n.y * 0.5 + 0.5;
  float band = mix(0.72, 1.0, step(0.62, top + (n.x * 0.12 + n.z * 0.06)));
  vec3 wash = vCol * band * uAmbient * 1.1;
  if (uSpillOn > 0.5) wash += vCol * spill(vWorld, n) * 1.4;
  vec3 E = vec3(0.0);
  float bw = 0.0;
  vec2 fw2 = max(fwidth(vF), vec2(1e-5));
  // the face border: one ruled ink line
  vec2 e2 = min(vF, vFS - vF);
  float edge = min(lineAt(e2.x, fw2.x, vK.z * 2.0), lineAt(e2.y, fw2.y, vK.z * 2.0));
  edge = max(lineAt(e2.x, fw2.x, vK.z * 2.0), lineAt(e2.y, fw2.y, vK.z * 2.0));
  float lines = edge;
  if (kind == 1.0) {
    // facade: floors every 3.2 m (slab lips), window modules of 1.6 m, a window per module (lit amber or dark glass)
    float fh = 3.2, mw = 1.6;
    vec2 cell = floor(vec2(vF.x / mw, vF.y / fh));
    vec2 f = vec2(vF.x - cell.x * mw, vF.y - cell.y * fh);
    float slab = lineAt(min(f.y, fh - f.y), fw2.y, 2.2) * smoothstep(3.0, 7.0, fh / fw2.y);
    vec2 wmin = vec2(0.42, 1.0), wmax = vec2(mw - 0.42, 2.35);
    vec2 wa = smoothstep(wmin - fw2, wmin + fw2, f) * (1.0 - smoothstep(wmax - fw2, wmax + fw2, f));
    float win = wa.x * wa.y * step(3.3, vF.y);
    float frame = max(lineAt(min(abs(f.x - wmin.x), abs(f.x - wmax.x)), fw2.x, 1.3) * step(wmin.y, f.y) * step(f.y, wmax.y),
                      lineAt(min(abs(f.y - wmin.y), abs(f.y - wmax.y)), fw2.y, 1.3) * step(wmin.x, f.x) * step(f.x, wmax.x)) * step(3.3, vF.y);
    float mull = lineAt(abs(f.x - mw * 0.5), fw2.x, 1.0) * win;
    float h = h12(cell + vK.y * 17.0);
    float lit = step(0.8, h);
    vec3 glass = mix(vec3(0.05, 0.06, 0.08), fogCol(vWorld) * 0.35, 0.3);
    vec3 warm = uWinWarm * (0.55 + 0.9 * h12(cell + 3.0 + vK.y)) * uWinGain;
    E += warm * win * lit * (1.0 - mull);
    wash = mix(wash, glass, win * (1.0 - lit));
    wash *= mix(1.0, 0.0, win * lit);
    bw = win * lit * 0.8;
    lines = max(lines, max(slab * 0.9, max(frame, mull) * 0.75) * smoothstep(3.0, 6.0, mw / fw2.x));
  } else if (kind == 2.0) {
    // shopfront: a warm lit interior behind a mullioned front
    float mw = 1.1;
    float m = abs(fract(vF.x / mw) * mw - mw * 0.5);
    float mull = lineAt(abs(m - mw * 0.5), fw2.x, 1.6);
    float tr = lineAt(abs(vF.y - vFS.y * 0.72), fw2.y, 1.4);
    // a dim warm interior: shelves / counters as darker bands, brightest under the lip
    float g = 0.6 + 0.4 * vnoise(vF * vec2(1.2, 0.7) + vK.y * 7.0);
    float counter = smoothstep(1.05, 1.1, vF.y);
    E += uWinWarm * vK.w * g * mix(0.12, 1.0, counter) * mix(0.55, 1.0, smoothstep(1.1, vFS.y, vF.y));
    wash = vec3(0.012, 0.011, 0.012);
    bw = 0.45;
    lines = max(lines, max(mull, tr));
  } else if (kind == 3.0) {
    // glazed roof tiles: courses down the slope, joints across
    float rp = 0.3, cp = 0.26;
    float rows = lineAt(abs(fract(vF.y / rp + 0.5) - 0.5) * rp, fw2.y, 1.2) * smoothstep(2.5, 6.0, rp / fw2.y);
    float cols = lineAt(abs(fract(vF.x / cp + 0.5) - 0.5) * cp, fw2.x, 0.9) * smoothstep(3.0, 7.0, cp / fw2.x) * 0.7;
    wash *= 0.92 + 0.16 * h12(floor(vF / vec2(cp, rp)));
    lines = max(lines, max(rows, cols));
  }
  float f = fogAmt(vWorld);
  // the ink dilutes with distance before the wash does
  float lineFade = 1.0 - smoothstep(25.0, 90.0, distance(vWorld, uCam));
  vec3 col = mix(wash, uInk, lines * lineFade * 0.9);
  col = mix(col, fogCol(vWorld), f) + E * (1.0 - f * 0.6);
  gl_FragColor = vec4(col, bw * (1.0 - f * 0.6));
}
`;

const VS_SKY = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const FS_SKY = /* glsl */ `
uniform vec3 uFogCol;
uniform vec3 uFogTop;
uniform vec3 uZenith;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = mix(uFogCol, uFogTop, smoothstep(0.0, 0.35, d.y));
  c = mix(c, uZenith, smoothstep(0.35, 1.0, d.y));
  gl_FragColor = vec4(c, 0.0);
}
`;

/** collects boxes for the wash program */
class Kit {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];
  private readonly fuv: number[] = [];
  private readonly fsz: number[] = [];
  private readonly kind: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;

  face(c: Vector3, x: Vector3, y: Vector3, hx: number, hy: number, color: number, kind: readonly [number, number, number, number]): void {
    const nn = new Vector3().crossVectors(x, y).normalize();
    const cc = lin(color);
    const i = this.n;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const p = c.clone().addScaledVector(x, sx * hx).addScaledVector(y, sy * hy);
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(nn.x, nn.y, nn.z);
      this.col.push(cc.r, cc.g, cc.b);
      this.fuv.push((sx + 1) * hx, (sy + 1) * hy);
      this.fsz.push(hx * 2, hy * 2);
      this.kind.push(kind[0], kind[1], kind[2], kind[3]);
      this.n++;
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** an axis-aligned box from min to max; `front` faces get `frontKind` */
  box(min: Vector3, max: Vector3, color: number, kind: readonly [number, number, number, number] = [0, 0, 1, 0], frontKind?: readonly [number, number, number, number], frontAxis?: 'x+' | 'x-' | 'z+' | 'z-'): void {
    const c = new Vector3().addVectors(min, max).multiplyScalar(0.5);
    const h = new Vector3().subVectors(max, min).multiplyScalar(0.5);
    const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
    const pick = (ax: 'x+' | 'x-' | 'z+' | 'z-'): readonly [number, number, number, number] => (frontAxis === ax && frontKind !== undefined ? frontKind : kind);
    this.face(c.clone().addScaledVector(Z, h.z), X, Y, h.x, h.y, color, pick('z+'));
    this.face(c.clone().addScaledVector(Z, -h.z), X.clone().negate(), Y, h.x, h.y, color, pick('z-'));
    this.face(c.clone().addScaledVector(X, h.x), Z.clone().negate(), Y, h.z, h.y, color, pick('x+'));
    this.face(c.clone().addScaledVector(X, -h.x), Z, Y, h.z, h.y, color, pick('x-'));
    this.face(c.clone().addScaledVector(Y, h.y), X, Z.clone().negate(), h.x, h.z, color, kind);
    this.face(c.clone().addScaledVector(Y, -h.y), X, Z, h.x, h.z, color, kind);
  }

  /** a sloped roof slab (tiles) from a ridge line down to an eave line */
  slope(ridgeA: Vector3, ridgeB: Vector3, eaveA: Vector3, eaveB: Vector3, color: number): void {
    const c = new Vector3().add(ridgeA).add(ridgeB).add(eaveA).add(eaveB).multiplyScalar(0.25);
    const x = new Vector3().subVectors(ridgeB, ridgeA);
    const hx = x.length() / 2;
    x.normalize();
    const mid0 = new Vector3().addVectors(eaveA, eaveB).multiplyScalar(0.5), mid1 = new Vector3().addVectors(ridgeA, ridgeB).multiplyScalar(0.5);
    const y = new Vector3().subVectors(mid1, mid0);
    const hy = y.length() / 2;
    y.normalize();
    this.face(c, x, y, hx, hy, color, [3, 0, 1, 0]);
    this.face(c, x.clone().negate(), y, hx, hy, color, [3, 0, 1, 0]);
  }

  build(mat: ShaderMaterial): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFaceUv', new Float32BufferAttribute(this.fuv, 2));
    g.setAttribute('aFaceSize', new Float32BufferAttribute(this.fsz, 2));
    g.setAttribute('aKind', new Float32BufferAttribute(this.kind, 4));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return new Mesh(g, mat);
  }
}

export interface LabScene {
  objects: Object3D[];
  /** the meshes the planar mirror draws (emissive layer) */
  emissive: Object3D[];
  emitters: Emitter[];
  ground: WetGround;
  signs: NeonSigns;
  lanterns: Lanterns;
  washMat: ShaderMaterial;
  cardMesh: Mesh;
  tubeMesh: Mesh;
  lanternMesh: Object3D;
}

/** the street runs along -z; x = ±HALF are the wall faces; the gate stands at z = GATE_Z */
export const HALF = 4.2;
export const GATE_Z = -21;

export function buildScene(shared: LabShared, atlas: GlyphAtlas): LabScene {
  const u = shared.u;
  const washMat = new ShaderMaterial({
    uniforms: {
      uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog, uLPos: u.uLPos, uLCol: u.uLCol, uAmbient: u.uAmbient,
      uInk: { value: lin(0x14161c) }, uWinWarm: { value: lin(0xffb45a) }, uSpillOn: { value: 1 }, uWinGain: { value: 1.25 },
    },
    vertexShader: VS_WASH, fragmentShader: FS_WASH, vertexColors: true,
  });
  const kit = new Kit();
  // ── the two walls: towers of varying width and setback; ground floors are lit shopfronts ──
  let seed = 1;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const side of [-1, 1] as const) {
    let z = 6;
    while (z > -95) {
      const wdt = 5 + rnd() * 6;
      const face = side * HALF;
      const back = side * (HALF + 9);
      const hgt = 26 + rnd() * 30;
      const wash = [0x8d929c, 0x858a93, 0x959aa3, 0x7f848d][Math.floor(rnd() * 4)] ?? 0x8d929c;
      const zf = z - wdt;
      const min = new Vector3(Math.min(face, back), 0, zf), max = new Vector3(Math.max(face, back), hgt, z);
      const s = Math.floor(rnd() * 97);
      kit.box(min, max, wash, [0, s, 1, 0], [1, s, 1, 0], side < 0 ? 'x+' : 'x-');
      // the shopfront: a recessed lit bay under a slab lip
      if (z < 2 && rnd() > 0.2) {
        const fx = side * (Math.abs(face) - 0.02);
        const bay0 = new Vector3(Math.min(fx, fx - side * 0.05), 0, zf + 0.6), bay1 = new Vector3(Math.max(fx, fx - side * 0.05), 2.9, z - 0.6);
        kit.box(bay0, bay1, 0x111216, [0, s, 1, 0], [2, s, 1, 0.35 + rnd() * 0.45], side < 0 ? 'x+' : 'x-');
        // the slab lip / awning over it
        const lip0 = new Vector3(Math.min(fx, fx - side * 0.9), 3.0, zf + 0.3), lip1 = new Vector3(Math.max(fx, fx - side * 0.9), 3.18, z - 0.3);
        kit.box(lip0, lip1, 0x6c717b, [0, s, 1.4, 0]);
      }
      // balcony slabs up the face
      for (let y = 6.4; y < hgt - 3; y += 3.2) {
        if (rnd() > 0.55) continue;
        const bx = side * (Math.abs(face) - 0.6);
        kit.box(new Vector3(Math.min(face, bx), y, zf + 0.5), new Vector3(Math.max(face, bx), y + 0.14, z - 0.5), 0x7b808a, [0, s, 1.2, 0]);
      }
      z = zf - 0.02;
    }
  }
  // ── the paifang ──
  const G = GATE_Z;
  const red = 0xa8321f;
  for (const x of [-3.3, -1.25, 1.25, 3.3]) {
    const hgt = Math.abs(x) > 2 ? 4.6 : 6.1;
    kit.box(new Vector3(x - 0.2, 0, G - 0.2), new Vector3(x + 0.2, hgt, G + 0.2), red, [0, 0, 1.2, 0]);
    kit.box(new Vector3(x - 0.34, 0, G - 0.34), new Vector3(x + 0.34, 0.5, G + 0.34), 0x8f939b, [0, 0, 1.2, 0]);
  }
  kit.box(new Vector3(-1.6, 5.1, G - 0.24), new Vector3(1.6, 5.5, G + 0.24), red, [0, 0, 1.2, 0]);
  kit.box(new Vector3(-1.6, 6.1, G - 0.28), new Vector3(1.6, 6.45, G + 0.28), red, [0, 0, 1.2, 0]);
  kit.box(new Vector3(-3.7, 4.1, G - 0.22), new Vector3(-1.25, 4.45, G + 0.22), red, [0, 0, 1.2, 0]);
  kit.box(new Vector3(1.25, 4.1, G - 0.22), new Vector3(3.7, 4.45, G + 0.22), red, [0, 0, 1.2, 0]);
  const roof = (x0: number, x1: number, y: number, d: number): void => {
    kit.slope(new Vector3(x0, y + 0.75, G), new Vector3(x1, y + 0.75, G), new Vector3(x0 - 0.4, y, G + d), new Vector3(x1 + 0.4, y, G + d), 0x2f7a6a);
    kit.slope(new Vector3(x0, y + 0.75, G), new Vector3(x1, y + 0.75, G), new Vector3(x0 - 0.4, y, G - d), new Vector3(x1 + 0.4, y, G - d), 0x2f7a6a);
    kit.box(new Vector3(x0 - 0.1, y + 0.72, G - 0.1), new Vector3(x1 + 0.1, y + 0.9, G + 0.1), 0x24262c, [0, 0, 1.2, 0]);
  };
  roof(-1.9, 1.9, 6.45, 1.1);
  roof(-4.0, -1.3, 4.45, 0.95);
  roof(1.3, 4.0, 4.45, 0.95);

  // ── the signs ──
  const signs = new NeonSigns(shared, atlas);
  const L = new Vector3(1, 0, 0), R = new Vector3(-1, 0, 0), toCam = new Vector3(0, 0, 1);
  const blade = (side: 'L' | 'R', z: number, y: number, text: string, color: number, em: number, flicker = 0): SignDef => ({
    text, color, vertical: true, em, facing: toCam, twoSided: true, flicker,
    wall: { at: new Vector3(side === 'L' ? -HALF : HALF, y, z), normal: side === 'L' ? L : R, gap: 0.3 },
  });
  const defs: SignDef[] = [
    blade('L', -7, 6.2, '九龍', NEON.red, 0.95),
    blade('L', -12.5, 4.6, '牙科', NEON.cyan, 0.72),
    blade('L', -16.5, 6.6, '旅館', NEON.amber, 0.7),
    blade('L', -21, 4.4, '火鍋', NEON.red, 0.62, 0.7),
    blade('L', -24.5, 7.6, '茶', NEON.jade, 0.8),
    blade('L', -34, 5.2, '麻雀', NEON.magenta, 0.6),
    blade('L', -44, 7.5, '當舖', NEON.amber, 0.7),
    blade('R', -5.5, 7.4, '茶', NEON.jade, 0.95),
    blade('R', -10.5, 5.0, '藥房', NEON.jade, 0.78),
    blade('R', -14.8, 8.2, '麻雀', NEON.magenta, 0.66),
    blade('R', -19.5, 4.7, '茶樓', NEON.cyan, 0.62),
    blade('R', -31, 6.4, '九龍', NEON.magenta, 0.62, 0.4),
    blade('R', -40, 5.0, '牙科', NEON.cyan, 0.6),
    // horizontal shop signs over the shopfronts, facing into the street
    { text: '麵', color: NEON.red, vertical: false, em: 0.9, at: new Vector3(HALF - 0.12, 3.75, -3.2), facing: R },
    { text: '火鍋', color: NEON.amber, vertical: false, em: 0.62, at: new Vector3(-HALF + 0.12, 3.6, -9.6), facing: L },
    { text: '藥房', color: NEON.cyan, vertical: false, em: 0.55, at: new Vector3(HALF - 0.12, 3.6, -13.2), facing: R, flicker: 0.3 },
    { text: '旅館', color: NEON.magenta, vertical: false, em: 0.55, at: new Vector3(-HALF + 0.12, 3.6, -18.6), facing: L },
    // a horizontal sign hung across the view under the gate's side beam
    { text: '茶樓', color: NEON.cyan, vertical: false, em: 0.5, at: new Vector3(-2.5, 3.35, G + 0.25), facing: toCam },
    // the gate's plaque: gold paint on lacquer, no glow
    { text: '九龍', color: 0, vertical: false, em: 0.62, at: new Vector3(0, 5.8, G + 0.3), facing: toCam, style: 'plaque' },
  ];
  for (const d of defs) signs.add(d);

  // ── lanterns: two strings across the street + a row under the gate ──
  const cables = new Cables();
  const lanterns = new Lanterns(shared, cables);
  lanterns.string({ a: new Vector3(-HALF, 6.4, -9), b: new Vector3(HALF, 6.0, -11), sag: 1.1, count: 5 });
  lanterns.string({ a: new Vector3(-HALF, 7.2, -17.5), b: new Vector3(HALF, 7.0, -18.5), sag: 1.0, count: 6, scale: 0.9 });
  for (const x of [-2.5, -0.8, 0.8, 2.5]) lanterns.hang(new Vector3(x, Math.abs(x) > 2 ? 4.1 : 5.1, G + 0.3), 0.85, 0.35);
  // wires between the towers (ink)
  cables.seg(new Vector3(-HALF, 9.5, -6), new Vector3(HALF, 10.2, -8.5));
  cables.seg(new Vector3(-HALF, 11.2, -13), new Vector3(HALF, 10.4, -12));
  cables.seg(new Vector3(-HALF, 8.8, -23), new Vector3(HALF, 9.6, -25));

  // lit shopfronts are emitters too (warm, low, wide): they make the amber streaks
  const shopEmit: Emitter[] = [];
  for (const [x, z] of [[-HALF, -3], [HALF, -8], [-HALF, -14], [HALF, -20], [-HALF, -30], [HALF, -36]] as const) {
    shopEmit.push({ at: new Vector3(x * 0.99, 1.5, z), color: lin(0xffa84a), w: 2.2, h: 2.6, power: 0.55, spill: 0 });
  }

  const ground = new WetGround(shared);
  const plane = ground.plane(-30, 30, -140, 12);
  const lanternMesh = lanterns.build();
  const cableMesh = cables.build(shared, 1.4);
  const signMeshes = signs.build();
  const emitters = [...signs.emitters, ...lanterns.emitters, ...shopEmit];
  const cardMesh = ground.buildCards(emitters);
  const sky = new Mesh(new SphereGeometry(500, 24, 12), new ShaderMaterial({
    uniforms: { uFogCol: u.uFogCol, uFogTop: u.uFogTop, uZenith: { value: lin(0x7d89a3) } },
    vertexShader: VS_SKY, fragmentShader: FS_SKY, side: BackSide, depthWrite: false,
  }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  const walls = kit.build(washMat);
  const emissive = [signMeshes.boards, signMeshes.tubes, lanternMesh];
  for (const o of emissive) o.layers.enable(WetGround.EMISSIVE_LAYER);
  return {
    objects: [sky, plane, walls, signMeshes.boards, signMeshes.tubes, lanternMesh, cableMesh, cardMesh],
    emissive, emitters, ground, signs, lanterns, washMat, cardMesh, tubeMesh: signMeshes.tubes, lanternMesh,
  };
}
