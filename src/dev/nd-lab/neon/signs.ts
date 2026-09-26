// Neon calligraphy signs: vertical blade signs on iron brackets projecting from a wall, and horizontal shop signs.
// Two draws for every sign in the scene:
//   boards — opaque: the dark board (planks, ink edge line, lit by its own tubes), the procedural neon FRAME tube (a
//            rounded-rect distance in metres, so it is crisp at any size), the brackets and the gold-on-lacquer plaques;
//   tubes  — additive: one quad per character, sampling the GlyphAtlas distance fields; the stroke is a glowing tube
//            (pastel core, saturated glass rim, optional darker seam along the skeleton) with a short saturated halo
//            that stays inside the quad. The long halo is the bleed bloom's job.
// Both write their glow into alpha (the bloom weight), so only light blooms. `emitters` feeds the reflections + spill.
import {
  BufferGeometry, Color, CustomBlending, Float32BufferAttribute, Mesh, OneFactor, ShaderMaterial, Uint32BufferAttribute, Vector3, AddEquation,
} from 'three';
import { FLICKER, FOG, NOISE } from './glsl';
import { GlyphAtlas } from './glyphs';
import { type Emitter, type LabShared, lin } from './shared';

export interface SignDef {
  text: string;
  /** neon hue, sRGB hex */
  color: number;
  vertical: boolean;
  /** character height, metres */
  em: number;
  /** board centre (for a bracketed blade sign: ignored, computed from `wall`) */
  at?: Vector3;
  /** the front face's normal */
  facing: Vector3;
  /** a blade sign on a bracket: the point on the wall face at the board's mid height, and the wall's normal */
  wall?: { at: Vector3; normal: Vector3; gap?: number };
  twoSided?: boolean;
  gain?: number;
  flicker?: number;
  /** 'neon' (default) or 'plaque' (gold paint on black lacquer, no glow) */
  style?: 'neon' | 'plaque';
}

const MODE = { face: 0, side: 1, iron: 2, plaque: 3 } as const;

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

  /** an oriented box; the ±n faces get the face uv (0..1) and `mode`, the rest `sideMode` */
  box(c: Vector3, x: Vector3, y: Vector3, n: Vector3, hx: number, hy: number, hz: number, tint: Color, p: readonly [number, number, number, number], sideMode: number): void {
    const full = [0, 0, 1, 1] as const;
    const sideP = [p[0], p[1], sideMode, p[3]] as const;
    this.quad(c.clone().addScaledVector(n, hz), x, y, hx, hy, full, [hx * 2, hy * 2], false, tint, p);
    this.quad(c.clone().addScaledVector(n, -hz), x.clone().negate(), y, hx, hy, full, [hx * 2, hy * 2], false, tint, p);
    this.quad(c.clone().addScaledVector(x, hx), n.clone().negate(), y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(x, -hx), n, y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, hy), x, n.clone().negate(), hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, -hy), x, n, hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
  }

  /** a bar between two points (square section `t`) */
  bar(a: Vector3, b: Vector3, t: number, tint: Color): void {
    const d = new Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return;
    d.divideScalar(len);
    const ref = Math.abs(d.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const s = new Vector3().crossVectors(d, ref).normalize();
    const u = new Vector3().crossVectors(s, d).normalize();
    const c = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    this.box(c, d, u, s, len / 2, t / 2, t / 2, tint, [0, 0, MODE.iron, 0], MODE.iron);
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

// ── the board program ──
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
void main() {
  vUv = aUv; vSize = aSize; vTint = aTint; vP = aP;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_BOARD = /* glsl */ `
${NOISE}
${FOG}
${FLICKER}
uniform vec4 uFrame;   // x: inset m, y: tube radius m, z: corner radius m, w: board lift (own-light tint)
uniform vec3 uBoard;   // board ink
uniform vec3 uGoldPaint;
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
  float bw = 0.0;
  float fl = flick(vP.y);
  vec2 e2 = min(vUv, 1.0 - vUv) * vSize;
  float edge = min(e2.x, e2.y);
  float few = max(fwidth(edge), 1e-5);
  if (mode < 0.5) {
    // planks + grime, lit by the sign's own tubes (a tint that follows the flicker)
    float pk = abs(fract(m.x / 0.19) - 0.5) * 0.19;
    float fpk = max(fwidth(m.x), 1e-5);
    float plank = 1.0 - smoothstep(0.003, 0.003 + fpk * 1.5, pk);
    float grime = vnoise(m * vec2(4.0, 28.0)) * 0.5 + vnoise(m * 1.7) * 0.5;
    D = uBoard * (0.7 + 0.6 * grime) * (1.0 - 0.6 * plank * smoothstep(0.02, 0.006, fpk));
    D += vTint * uFrame.w * fl * (0.6 + 0.4 * grime);
    // the frame: one bent tube around the board
    vec2 c = m - vSize * 0.5;
    float sd = rrect(c, vSize * 0.5 - uFrame.x, uFrame.z);
    float ad = abs(sd);
    float fw = max(fwidth(sd), 1e-5);
    float tw = uFrame.y;
    float tube = 1.0 - smoothstep(tw - fw, tw + fw, ad);
    float rim = smoothstep(tw * 0.25, tw, ad);
    vec3 core = mix(vTint, vec3(1.0), 0.5);
    E = mix(core, vTint * 0.85, rim) * tube * vP.x * fl;
    // its light on the board, both sides of the tube
    float glow = exp(-max(ad - tw, 0.0) / 0.04) * (1.0 - tube);
    E += vTint * glow * 0.07 * vP.x * fl;
    // four rivets just inside the frame's corners
    vec2 rv = abs(c) - (vSize * 0.5 - uFrame.x - 0.07);
    float rivet = 1.0 - smoothstep(0.012, 0.012 + fw, length(rv));
    D = mix(D, uBoard * 0.35, rivet);
    bw = tube * fl + glow * 0.25 * fl;
    // the ruled ink edge of the board
    D = mix(D, uBoard * 0.25, 1.0 - smoothstep(0.012, 0.012 + few * 1.5, edge));
  } else if (mode < 1.5) {
    D = uBoard * 0.7 + vTint * uFrame.w * 0.3 * fl;
  } else if (mode < 2.5) {
    D = uBoard * 0.45;
  } else {
    // plaque: black lacquer with a gold double frame
    D = vec3(0.011, 0.008, 0.007);
    float f1 = 1.0 - smoothstep(0.025, 0.025 + few * 1.5, abs(edge - 0.06));
    float f2 = 1.0 - smoothstep(0.008, 0.008 + few * 1.5, abs(edge - 0.13));
    D = mix(D, uGoldPaint, max(f1, f2));
  }
  float f = fogAmt(vWorld);
  vec3 col = mix(D, fogCol(vWorld), f) + E * (1.0 - f * 0.5);
  gl_FragColor = vec4(col, bw * (1.0 - f * 0.5));
}
`;

// ── the tube program (additive) ──
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
${NOISE}
${FOG}
${FLICKER}
uniform sampler2D uSdf;
uniform float uCount;
uniform vec4 uAtlas;  // x: font px, y: fill spread px, z: skeleton spread px, w: cell px
uniform vec4 uTube;   // x: 0 brush fill … 1 monoline tube, y: tube radius (em, monoline), z: rim width (em), w: fill thicken (em)
uniform vec4 uTube2;  // x: seam darkness, y: seam width (em), z: halo reach (em), w: halo gain
uniform vec3 uGoldPaint;
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
  float f = fogAmt(vWorld);
  if (uCount > 0.5) { gl_FragColor = vec4(1.0 / 255.0); return; }
  if (vP.z > 0.5) {
    // gold paint on a lacquer plaque: no glow
    vec3 g = uGoldPaint * (0.85 + 0.3 * vnoise(vWorld.xy * 40.0));
    gl_FragColor = vec4(g * fill * (1.0 - f), 0.0);
    return;
  }
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
  vec3 E = (tube * fill + vTint * halo * uTube2.w) * vP.x * fl * (1.0 - f * 0.5);
  gl_FragColor = vec4(E, (fill + halo * 0.35) * fl * (1.0 - f * 0.5));
}
`;

export interface SignLook {
  /** 0 = the brush-shaped fill (the mockups), 1 = monoline hand-bent tubes along the skeleton */
  mono: number;
  tubeRadius: number;
  rim: number;
  thicken: number;
  seam: number;
  seamWidth: number;
  haloReach: number;
  haloGain: number;
  frameInset: number;
  frameRadius: number;
  boardLift: number;
  gain: number;
}

export const DEFAULT_LOOK: SignLook = {
  mono: 0, tubeRadius: 0.05, rim: 0.024, thicken: 0.022, seam: 0.0, seamWidth: 0.008, haloReach: 0.12, haloGain: 0.22,
  frameInset: 0.075, frameRadius: 0.016, boardLift: 0.035, gain: 4.2,
};

export class NeonSigns {
  readonly boards = new Batch();
  readonly tubes = new Batch();
  readonly emitters: Emitter[] = [];
  readonly boardMat: ShaderMaterial;
  readonly tubeMat: ShaderMaterial;
  private readonly iron = new Color(0.02, 0.02, 0.022);

  constructor(private readonly shared: LabShared, private readonly atlas: GlyphAtlas) {
    const u = shared.u;
    this.boardMat = new ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog,
        uFrame: { value: [DEFAULT_LOOK.frameInset, DEFAULT_LOOK.frameRadius, 0.04, DEFAULT_LOOK.boardLift] },
        uBoard: { value: lin(0x34333a) }, uGoldPaint: { value: lin(0xd9b35c) },
      },
      vertexShader: VS_BOARD, fragmentShader: FS_BOARD,
    });
    this.tubeMat = new ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog,
        uSdf: { value: atlas.texture }, uCount: u.uCount,
        uAtlas: { value: [GlyphAtlas.FONT_PX, GlyphAtlas.SPREAD, GlyphAtlas.SKEL_SPREAD, GlyphAtlas.CELL] },
        uTube: { value: [0, 0.05, 0.018, 0.004] },
        uTube2: { value: [0, 0.008, 0.16, 0.5] },
        uGoldPaint: { value: lin(0xe0bb62) },
      },
      vertexShader: VS_TUBE, fragmentShader: FS_TUBE,
      transparent: true, depthWrite: false,
      blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
      blendEquationAlpha: AddEquation, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor,
    });
    this.setLook(DEFAULT_LOOK);
  }

  setLook(l: SignLook): void {
    const t = this.tubeMat.uniforms;
    const b = this.boardMat.uniforms;
    const set = (u: { value: unknown } | undefined, v: number[]): void => { if (u !== undefined) u.value = v; };
    set(t['uTube'], [l.mono, l.tubeRadius, l.rim, l.thicken]);
    set(t['uTube2'], [l.seam, l.seamWidth, l.haloReach, l.haloGain]);
    set(b['uFrame'], [l.frameInset, l.frameRadius, 0.04, l.boardLift]);
    this.gainScale = l.gain / DEFAULT_LOOK.gain;
  }

  private gainScale = 1;

  add(def: SignDef): void {
    const chars = Array.from(def.text);
    const n = chars.length;
    const em = def.em;
    const w = def.vertical ? em * 1.42 : em * (n + 0.62);
    const h = def.vertical ? em * (n + 0.58) : em * 1.42;
    const up = new Vector3(0, 1, 0);
    const f = def.facing.clone().normalize();
    const right = new Vector3().crossVectors(up, f).normalize();
    const depth = 0.09;
    let at: Vector3;
    if (def.wall !== undefined) {
      const gap = def.wall.gap ?? 0.35;
      at = def.wall.at.clone().addScaledVector(def.wall.normal, gap + w / 2);
    } else if (def.at !== undefined) at = def.at.clone();
    else throw new Error('sign needs at or wall');
    const plaque = def.style === 'plaque';
    const tint = plaque ? new Color(1, 1, 1) : lin(def.color);
    const gain = (def.gain ?? DEFAULT_LOOK.gain) * this.gainScale;
    const seed = def.flicker ?? 0;
    // the board
    this.boards.box(at, right, up, f, w / 2, h / 2, depth / 2, tint, [gain, seed, plaque ? MODE.plaque : MODE.face, 0], MODE.side);
    // the characters, on each lit face
    const faces = def.twoSided === true ? [1, -1] : [1];
    const cellEm = GlyphAtlas.CELL / GlyphAtlas.FONT_PX;
    for (const side of faces) {
      const fn = f.clone().multiplyScalar(side);
      const r = new Vector3().crossVectors(up, fn).normalize();
      const c0 = at.clone().addScaledVector(fn, depth / 2 + 0.012);
      chars.forEach((ch, i) => {
        const g = this.atlas.rect(ch);
        const off = def.vertical ? new Vector3().addScaledVector(up, h / 2 - em * (0.79 + i)) : new Vector3().addScaledVector(r, -w / 2 + em * (0.81 + i));
        const c = c0.clone().add(off);
        this.tubes.quad(c, r, up, (em * cellEm) / 2, (em * cellEm) / 2, [g.u0, g.v0, g.u1, g.v1], [0, 0], true, tint, [gain, seed, plaque ? 1 : 0, 0]);
      });
    }
    // the bracket: a top arm from the wall past the board, a diagonal strut, two hangers, a bottom tie
    if (def.wall !== undefined) {
      const wn = def.wall.normal;
      const gap = def.wall.gap ?? 0.35;
      const top = at.y + h / 2 + 0.14;
      const wallTop = new Vector3(def.wall.at.x, top, def.wall.at.z);
      const armEnd = wallTop.clone().addScaledVector(wn, gap + w + 0.12);
      this.boards.bar(wallTop, armEnd, 0.05, this.iron);
      const strutBase = new Vector3(def.wall.at.x, top - Math.min(1.1, h * 0.45), def.wall.at.z);
      this.boards.bar(strutBase, wallTop.clone().addScaledVector(wn, (gap + w) * 0.62), 0.035, this.iron);
      for (const k of [0.12, 0.88]) {
        const hx = def.wall.at.clone().addScaledVector(wn, gap + w * k);
        this.boards.bar(new Vector3(hx.x, top, hx.z), new Vector3(hx.x, at.y + h / 2, hx.z), 0.02, this.iron);
      }
      const bot = new Vector3(def.wall.at.x, at.y - h / 2 + 0.1, def.wall.at.z);
      this.boards.bar(bot, bot.clone().addScaledVector(wn, gap), 0.03, this.iron);
    }
    if (!plaque) {
      this.emitters.push({ at: at.clone().addScaledVector(f, depth / 2), color: tint.clone(), w, h, power: gain / DEFAULT_LOOK.gain, spill: 0.3 * (gain / DEFAULT_LOOK.gain) });
    }
  }

  build(): { boards: Mesh; tubes: Mesh } {
    const boards = new Mesh(this.boards.geometry(['aUv', 'aSize']), this.boardMat);
    const tubes = new Mesh(this.tubes.geometry(['aAtlas', 'aQ']), this.tubeMat);
    tubes.renderOrder = 5;
    void this.shared;
    return { boards, tubes };
  }
}
