// Neon calligraphy signs, merged from the neon lab (src/dev/nd-lab/neon/signs.ts, round-7-lab-neon): an SDF brush
// fill with a darker glass rim and a short in-quad halo, on dark plank boards framed by a procedural neon tube.
// Two draws for every 'tube' sign in the Stack:
//   boards — opaque: the board (planks, grime, a ruled ink edge, lit by its own tubes), the rounded-rect frame tube,
//            four rivets; board sides;
//   tubes  — additive: one quad per character sampling the GlyphAtlas distance fields.
// The fog is the clean room's banded silk (FOG_GLSL); neon is fogged at half strength. `emitters` feeds the streak
// cards and the baked spill.
import {
  BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial, Uint32BufferAttribute, Vector3,
} from 'three';
import type { Emitter } from './emitters';
import { GlyphAtlas } from './glyphs';
import { ADD_KEEP_ALPHA, FOG_GLSL, NOISE_GLSL, type Shared } from './style';
import { chars } from '../util';

export interface NeonDef {
  text: string;
  /** neon hue, sRGB hex */
  color: string;
  vertical: boolean;
  /** character height, metres */
  em: number;
  /** board centre */
  at: Vector3;
  /** the front face's normal */
  facing: Vector3;
  twoSided?: boolean;
  gain?: number;
  flicker?: number;
}

const MODE = { face: 0, side: 1 } as const;

const FLICKER = /* glsl */ `
uniform float uTime;
float flick(float seed) {
  if (seed <= 0.0) return 1.0;
  float t = uTime * (0.9 + seed * 2.0) + seed * 57.0;
  float n = h11(floor(t) + seed * 13.0);
  float m = h11(floor(t * 14.0) + seed * 7.0);
  return n < 0.3 ? (m < 0.5 ? 0.08 : 1.0) : 1.0;
}
`;

class Batch {
  readonly pos: number[] = [];
  readonly a2: number[] = [];
  readonly b2: number[] = [];
  readonly tint: number[] = [];
  readonly p: number[] = [];
  readonly idx: number[] = [];
  n = 0;

  quad(c: Vector3, right: Vector3, up: Vector3, hw: number, hh: number, uv: readonly [number, number, number, number], b: readonly [number, number], quadLocal: boolean, tint: Color, p: readonly [number, number, number, number]): void {
    const i = this.n;
    const [u0, v0, u1, v1] = uv;
    const corners: readonly (readonly [number, number, number, number])[] = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const [sx, sy, u, v] of corners) {
      const q = c.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh);
      this.pos.push(q.x, q.y, q.z);
      this.a2.push(u, v);
      if (quadLocal) this.b2.push(sx, sy);
      else this.b2.push(b[0], b[1]);
      this.tint.push(tint.r, tint.g, tint.b);
      this.p.push(p[0], p[1], p[2], p[3]);
      this.n++;
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** an oriented box; the ±n faces get the face uv (0..1) and p's mode, the rest `sideMode` */
  box(c: Vector3, x: Vector3, y: Vector3, n: Vector3, hx: number, hy: number, hz: number, tint: Color, p: readonly [number, number, number, number], sideMode: number, twoFaced: boolean): void {
    const full = [0, 0, 1, 1] as const;
    const sideP = [p[0], p[1], sideMode, p[3]] as const;
    this.quad(c.clone().addScaledVector(n, hz), x, y, hx, hy, full, [hx * 2, hy * 2], false, tint, p);
    this.quad(c.clone().addScaledVector(n, -hz), x.clone().negate(), y, hx, hy, full, [hx * 2, hy * 2], false, tint, twoFaced ? p : sideP);
    this.quad(c.clone().addScaledVector(x, hx), n.clone().negate(), y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(x, -hx), n, y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, hy), x, n.clone().negate(), hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, -hy), x, n, hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
  }

  geometry(names: readonly [string, string]): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute(names[0], new Float32BufferAttribute(this.a2, 2));
    g.setAttribute(names[1], new Float32BufferAttribute(this.b2, 2));
    g.setAttribute('aTint', new Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aP', new Float32BufferAttribute(this.p, 4));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const VS_BOARD = /* glsl */ `
attribute vec2 aUv;
attribute vec2 aSize;
attribute vec3 aTint;
attribute vec4 aP;
varying vec2 vUv;
varying vec2 vSize;
varying vec3 vTint;
varying vec4 vP;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vUv = aUv; vSize = aSize; vTint = aTint; vP = aP;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS_BOARD = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
${FLICKER}
uniform vec4 uFrame;   // x: inset m, y: tube radius m, z: corner radius m, w: board lift (own-light tint)
uniform vec3 uBoard;
uniform float uSutra;
uniform vec3 uPaperDeep;
uniform vec3 uGold;
uniform float uNear;
varying float vViewZ;
varying vec2 vUv;
varying vec2 vSize;
varying vec3 vTint;
varying vec4 vP;
varying vec3 vWorld;
float rrect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float mode = floor(vP.z + 0.5);
  vec2 m = vUv * vSize;
  vec3 D = uBoard;
  vec3 E = vec3(0.0);
  float fl = flick(vP.y);
  vec2 e2 = min(vUv, 1.0 - vUv) * vSize;
  float edge = min(e2.x, e2.y);
  float few = max(fwidth(edge), 1e-5);
  float inkEdge = 0.0;
  if (mode < 0.5) {
    float pk = abs(fract(m.x / 0.19) - 0.5) * 0.19;
    float fpk = max(fwidth(m.x), 1e-5);
    float plank = 1.0 - smoothstep(0.003, 0.003 + fpk * 1.5, pk);
    float grime = vnoise(m * vec2(4.0, 28.0)) * 0.5 + vnoise(m * 1.7) * 0.5;
    D = uBoard * (0.7 + 0.6 * grime) * (1.0 - 0.6 * plank * (1.0 - smoothstep(0.006, 0.02, fpk)));
    D += vTint * uFrame.w * fl * (0.6 + 0.4 * grime);
    vec2 c = m - vSize * 0.5;
    float sd = rrect(c, vSize * 0.5 - uFrame.x, uFrame.z);
    float ad = abs(sd);
    float fw = max(fwidth(sd), 1e-5);
    float tw = uFrame.y;
    float tube = 1.0 - smoothstep(tw - fw, tw + fw, ad);
    float rim = smoothstep(tw * 0.25, tw, ad);
    vec3 core = mix(vTint, vec3(1.0), 0.5);
    E = mix(core, vTint * 0.85, rim) * tube * vP.x * fl;
    float glow = exp(-max(ad - tw, 0.0) / 0.04) * (1.0 - tube);
    E += vTint * glow * 0.07 * vP.x * fl;
    vec2 rv = abs(c) - (vSize * 0.5 - uFrame.x - 0.07);
    float rivet = 1.0 - smoothstep(0.012, 0.012 + fw, length(rv));
    D = mix(D, uBoard * 0.35, rivet);
    inkEdge = 1.0 - smoothstep(0.012, 0.012 + few * 1.5, edge);
  } else {
    D = uBoard * 0.7 + vTint * uFrame.w * 0.3 * fl;
  }
  D = mix(D, D * 0.4 + uPaperDeep * 0.6, uSutra);
  D = mix(D, mix(uBoard * 0.25, uGold * 1.2, uSutra), inkEdge);
  vec4 fg = silkFog(vWorld, 1.0);
  vec3 col = D * fg.a + fg.rgb + E * sqrt(max(fg.a, 1e-4));
  gl_FragColor = vec4(col, uNear / max(vViewZ, uNear));
}
`;

const VS_TUBE = /* glsl */ `
attribute vec2 aAtlas;
attribute vec2 aQ;
attribute vec3 aTint;
attribute vec4 aP;
varying vec2 vUv;
varying vec2 vQ;
varying vec3 vTint;
varying vec4 vP;
varying vec3 vWorld;
void main() {
  vUv = aAtlas; vQ = aQ; vTint = aTint; vP = aP;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_TUBE = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
${FLICKER}
uniform sampler2D uSdf;
uniform vec4 uAtlas;  // x: font px, y: fill spread px, z: skeleton spread px, w: cell px
uniform vec4 uTube;   // x: 0 brush fill … 1 monoline tube, y: tube radius (em), z: rim width (em), w: fill thicken (em)
uniform vec4 uTube2;  // x: seam darkness, y: seam width (em), z: halo reach (em), w: halo gain
varying vec2 vUv;
varying vec2 vQ;
varying vec3 vTint;
varying vec4 vP;
varying vec3 vWorld;
void main() {
  vec2 s = texture(uSdf, vUv).rg;
  float dFill = (s.r - 0.5) * 2.0 * uAtlas.y / uAtlas.x + uTube.w;
  float dSk = s.g * uAtlas.z / uAtlas.x;
  float d = mix(dFill, uTube.y - dSk, uTube.x);
  float w = max(fwidth(d), 1e-4) * 0.75;
  float fill = smoothstep(-w, w, d);
  float fk = sqrt(max(silkFog(vWorld, 1.0).a, 1e-4));
  float fl = flick(vP.y);
  float rim = fill * (1.0 - smoothstep(uTube.z - w, uTube.z + w, d));
  vec3 core = mix(vTint, vec3(1.0), 0.5);
  vec3 tube = mix(core, vTint * 0.62, rim);
  float seam = (1.0 - smoothstep(uTube2.y - w, uTube2.y + w, dSk)) * fill * (1.0 - rim);
  tube *= 1.0 - seam * uTube2.x;
  float out_ = max(-d, 0.0);
  float reach = min(uTube2.z, uAtlas.y / uAtlas.x * 0.9);
  float halo = exp(-out_ / (reach * 0.35)) * (1.0 - smoothstep(reach * 0.5, reach, out_)) * (1.0 - fill);
  halo *= 1.0 - smoothstep(0.82, 1.0, max(abs(vQ.x), abs(vQ.y)));
  vec3 E = (tube * fill + vTint * halo * uTube2.w) * vP.x * fl * fk;
  gl_FragColor = vec4(E, 0.0);
}
`;

export const NEON_LOOK = {
  mono: 0, tubeRadius: 0.05, rim: 0.024, thicken: 0.022, seam: 0.0, seamWidth: 0.008, haloReach: 0.12, haloGain: 0.22,
  frameInset: 0.075, frameRadius: 0.016, boardLift: 0.035, gain: 4.2,
} as const;

export class NeonSigns {
  private readonly boards = new Batch();
  private readonly tubes = new Batch();
  readonly emitters: Emitter[] = [];
  readonly boardMat: ShaderMaterial;
  readonly tubeMat: ShaderMaterial;

  constructor(shared: Shared, private readonly atlas: GlyphAtlas) {
    const u = shared.u;
    const L = NEON_LOOK;
    this.boardMat = new ShaderMaterial({
      uniforms: {
        ...u,
        uFrame: { value: [L.frameInset, L.frameRadius, 0.04, L.boardLift] },
        uBoard: { value: new Color(0x34333a) },
      },
      vertexShader: VS_BOARD, fragmentShader: FS_BOARD,
    });
    this.tubeMat = new ShaderMaterial({
      uniforms: {
        ...u,
        uSdf: { value: atlas.texture },
        uAtlas: { value: [GlyphAtlas.FONT_PX, GlyphAtlas.SPREAD, GlyphAtlas.SKEL_SPREAD, GlyphAtlas.CELL] },
        uTube: { value: [L.mono, L.tubeRadius, L.rim, L.thicken] },
        uTube2: { value: [L.seam, L.seamWidth, L.haloReach, L.haloGain] },
      },
      vertexShader: VS_TUBE, fragmentShader: FS_TUBE,
      transparent: true, depthWrite: false,
      ...ADD_KEEP_ALPHA,
    });
  }

  /** the board's outer size for a sign (so callers can hang brackets) */
  static size(text: string, em: number, vertical: boolean): { w: number; h: number } {
    const n = chars(text).length;
    return { w: vertical ? em * 1.42 : em * (n + 0.62), h: vertical ? em * (n + 0.58) : em * 1.42 };
  }

  add(def: NeonDef): { w: number; h: number } {
    const cs = chars(def.text);
    const em = def.em;
    const { w, h } = NeonSigns.size(def.text, em, def.vertical);
    const up = new Vector3(0, 1, 0);
    const f = def.facing.clone().setY(0).normalize();
    const right = new Vector3().crossVectors(up, f).normalize();
    const depth = 0.09;
    const at = def.at.clone();
    const tint = new Color(def.color);
    const gain = def.gain ?? NEON_LOOK.gain;
    const seed = def.flicker ?? 0;
    const two = def.twoSided === true;
    this.boards.box(at, right, up, f, w / 2, h / 2, depth / 2, tint, [gain, seed, MODE.face, 0], MODE.side, two);
    const cellEm = GlyphAtlas.CELL / GlyphAtlas.FONT_PX;
    for (const side of two ? [1, -1] : [1]) {
      const fn = f.clone().multiplyScalar(side);
      const r = new Vector3().crossVectors(up, fn).normalize();
      const c0 = at.clone().addScaledVector(fn, depth / 2 + 0.012);
      cs.forEach((ch, i) => {
        const g = this.atlas.rect(ch);
        const off = def.vertical ? new Vector3().addScaledVector(up, h / 2 - em * (0.79 + i)) : new Vector3().addScaledVector(r, -w / 2 + em * (0.81 + i));
        this.tubes.quad(c0.clone().add(off), r, up, (em * cellEm) / 2, (em * cellEm) / 2, [g.u0, g.v0, g.u1, g.v1], [0, 0], true, tint, [gain, seed, 0, 0]);
      });
    }
    // the neon owns the wet ground (the targets' streaks are cyan / jade / magenta, not the shops' amber)
    const k = (1.4 * gain) / NEON_LOOK.gain;
    this.emitters.push({ at: at.clone().addScaledVector(f, depth / 2), color: tint.clone(), w, h, power: k, spill: 0.3 * k });
    return { w, h };
  }

  build(): { boards: Mesh; tubes: Mesh } {
    const boards = new Mesh(this.boards.geometry(['aUv', 'aSize']), this.boardMat);
    const tubes = new Mesh(this.tubes.geometry(['aAtlas', 'aQ']), this.tubeMat);
    tubes.renderOrder = 5;
    return { boards, tubes };
  }
}
