// Wet ground: dark wet granite flagstones with ruled ink joints, puddles, a silk sheen, drizzle rings, and three ways
// to make every sign and lantern fall into it as a long, saturated VERTICAL streak:
//   'cards'  — one additive card per emitter, lying on the ground where optics puts its reflection (between the
//              mirror-points of the emitter's top and bottom, c / (c + h) of the way from the eye), stretched along
//              the view ray by the gloss spread, broken on the same joints / stones / ripples as the ground. One
//              instanced draw, no extra scene render, and it works for emitters above the top of a portrait frame.
//   'planar' — the classic: a mirrored camera renders only the emissive layer at quarter res, two one-way vertical
//              smear passes stretch it, the ground samples it projectively with a ripple offset.
//   'screen' — no geometry at all: the composite mirrors the half-res emissive buffer about the horizon line for
//              ground pixels (flagged by negative alpha). Free, but it loses everything above the top of the frame.
import {
  AddEquation, BufferGeometry, CustomBlending, Float32BufferAttribute, HalfFloatType, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, Matrix4, Mesh, NoBlending, OneFactor, OrthographicCamera, PerspectiveCamera, type Scene, ShaderMaterial, type Texture,
  Uint16BufferAttribute, Vector2, Vector3, Vector4, type WebGLRenderer, WebGLRenderTarget, DataTexture,
} from 'three';
import { FOG, LIGHTS, NOISE, STONES } from './glsl';
import { type Emitter, type LabShared, lin } from './shared';

export type StreakMode = 'cards' | 'planar' | 'screen' | 'off';

// ── the ground program ──
const VS_GROUND = /* glsl */ `
uniform mat4 uMirrorMat;
varying vec3 vWorld;
varying vec4 vMir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vMir = uMirrorMat * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_GROUND = /* glsl */ `
${NOISE}
${FOG}
${LIGHTS}
${STONES}
uniform float uTime;
uniform vec3 uStone;
uniform vec3 uInk;
uniform vec3 uAmbient;
uniform vec4 uWet;      // x: wetness, y: sheen, z: darkening, w: flag alpha for 'screen' (1) or 0
uniform float uSpillOn;
uniform sampler2D uMirror;
uniform float uMirrorOn;
uniform vec3 uMirrorK;  // x: gain, y: ripple, z: per-stone jog
uniform vec4 uRings;    // x: density, y: speed, z: strength
varying vec3 vWorld;
varying vec4 vMir;
void main() {
  vec2 p = vWorld.xz;
  vec4 st = stone(p, 1.1);
  float joint = st.x, id = st.y, puddle = st.z;
  vec3 V = normalize(uCam - vWorld);
  float ndv = clamp(V.y, 0.0, 1.0);
  // granite: per-stone value, fine speckle, a little tone drift
  float speck = vnoise(p * 23.0) * 0.4 + vnoise(p * 61.0) * 0.35 + vnoise(p * 157.0) * 0.25;
  vec3 base = uStone * (0.82 + 0.3 * id) * (0.74 + 0.52 * speck);
  float wet = uWet.x * mix(0.55, 1.0, puddle);
  base *= 1.0 - uWet.z * wet;
  vec3 light = uAmbient;
  if (uSpillOn > 0.5) light += spill(vWorld, vec3(0.0, 1.0, 0.0)) * 0.8;
  vec3 col = base * light;
  // the silk sky in the water: a fresnel sheen of the fog colour (clamped base: no NaN through the bloom)
  float fres = 0.04 + 0.96 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
  col += fogCol(vWorld) * fres * wet * uWet.y;
  float bw = 0.0;
  // planar mirror of the emissive layer
  if (uMirrorOn > 0.5) {
    vec2 ruv = vMir.xy / vMir.w;
    float rip = vnoise(vec2(dot(p, vec2(0.3, 1.0)) * 7.0, uTime * 0.8)) - 0.5;
    ruv.x += rip * uMirrorK.y + st.w * uMirrorK.z;
    vec3 r = texture(uMirror, ruv).rgb;
    float dash = mix(1.0, smoothstep(0.2, 0.75, vnoise(vec2(dot(p - uCam.xz, normalize(p - uCam.xz)) * 8.0, id * 9.0))), 0.5);
    float k = wet * (0.35 + 0.65 * fres) * uMirrorK.x * (1.0 - joint) * (0.7 + 0.6 * id) * dash;
    col += r * k;
    bw = lum(r * k) / max(lum(col), 1e-3) * 0.5;
  }
  // drizzle rings: fine ruled circles, one per cell, expanding and fading
  vec2 rc = floor(p / uRings.x);
  float ph = fract(uTime * uRings.y + h12(rc + 5.0));
  vec2 ctr = (rc + 0.2 + 0.6 * vec2(h12(rc + 1.0), h12(rc + 2.0))) * uRings.x;
  float rd = abs(length(p - ctr) - ph * 0.3);
  float fwr = max(fwidth(rd), 1e-5);
  float ring = (1.0 - smoothstep(0.004, 0.004 + fwr * 1.2, rd)) * (1.0 - ph) * wet * smoothstep(0.03, 0.01, fwr);
  col += fogCol(vWorld) * ring * uRings.z;
  // ruled joints: ink, and they never reflect
  col = mix(col, uInk, joint * 0.85);
  float f = fogAmt(vWorld);
  col = mix(col, fogCol(vWorld), f);
  // 'screen' mode reads the wetness (× fresnel) from negative alpha in the composite
  float flag = uWet.w > 0.5 ? -wet * (0.35 + 0.65 * fres) * (1.0 - joint) * (1.0 - f) * (0.7 + 0.6 * id) : bw;
  gl_FragColor = vec4(col, flag);
}
`;

// ── the streak cards ──
const VS_CARD = /* glsl */ `
attribute vec2 aCorner;
attribute vec3 aE;
attribute vec3 aCol;
attribute vec3 aSize;
uniform vec3 uCam;
uniform float uGroundY;
uniform vec4 uSpread; // x: tail toward the eye, y: tail away, z: width scale, w: min distance
varying vec2 vC;
varying vec3 vWorld;
varying vec3 vCol;
varying float vS;
varying vec4 vSeg;
varying vec2 vDir;
void main() {
  float c = max(uCam.y - uGroundY, 0.05);
  float hB = max(aE.y - aSize.y * 0.5 - uGroundY, 0.05);
  float hT = max(aE.y + aSize.y * 0.5 - uGroundY, hB + 0.05);
  vec2 d = aE.xz - uCam.xz;
  float D = max(length(d), 0.1);
  vec2 dir = d / D;
  vec2 side = vec2(-dir.y, dir.x);
  // the mirror points of the emitter's top and bottom: c / (c + h) of the way from the eye
  float sN = D * c / (c + hT), sF = D * c / (c + hB);
  float s0 = mix(sN, uSpread.w, clamp(uSpread.x, 0.0, 1.0));
  float s1 = mix(sF, D, clamp(uSpread.y, 0.0, 1.0));
  // 4 corners → a strip of 2 quads: near tail | body+far tail, so the profile is linear per piece
  float s = mix(s0, s1, aCorner.y);
  float halfW = 0.5 * aSize.x * (s / D) * uSpread.z + 0.02;
  vec2 xz = uCam.xz + dir * s + side * aCorner.x * halfW;
  vWorld = vec3(xz.x, uGroundY + 0.004, xz.y);
  vC = aCorner;
  vCol = aCol * aSize.z;
  vS = s;
  vSeg = vec4(s0, sN, sF, s1);
  vDir = dir;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;
const FS_CARD = /* glsl */ `
${NOISE}
${FOG}
${STONES}
uniform float uTime;
uniform vec4 uCardK; // x: gain, y: dash contrast, z: jog, w: saturation keep
uniform float uWetK;
uniform float uFine;
uniform float uCount;
varying vec2 vC;
varying vec3 vWorld;
varying vec3 vCol;
varying float vS;
varying vec4 vSeg;
varying vec2 vDir;
void main() {
  vec2 p = vWorld.xz;
  // -1..0 the near tail, 0..1 the body, 1..2 the far tail
  float vBody = vS < vSeg.y ? (vS - vSeg.y) / max(vSeg.y - vSeg.x, 1e-3)
    : (vS < vSeg.z ? (vS - vSeg.y) / max(vSeg.z - vSeg.y, 1e-3) : 1.0 + (vS - vSeg.z) / max(vSeg.w - vSeg.z, 1e-3));
  vec4 st = stone(p, 1.1);
  // along the ray: the body is full, the tails fade (the far one short: gloss spreads toward the eye)
  float prof = vBody < 0.0 ? pow(clamp(1.0 + vBody, 0.0, 1.0), 1.4) : (vBody > 1.0 ? pow(clamp(2.0 - vBody, 0.0, 1.0), 2.0) : 1.0);
  float along = dot(p - uCam.xz, vDir);
  // each stone tilts a little: the streak jogs sideways stone by stone; ripples wobble it
  // the ripple: a fine, fast sideways shake along the ray gives the streak its jagged, wavy edge (faded where it
  // would alias), a slow wobble bends it, and each stone jogs it a little
  float fa = max(fwidth(along), 1e-5);
  // two octaves of ripple, each faded out before it would alias (fa = metres per pixel along the ray)
  float fine = (vnoise(vec2(along * 38.0, vC.x * 0.7 + uTime * 0.9)) - 0.5) * 2.0 * (1.0 - smoothstep(0.009, 0.022, fa))
             + (vnoise(vec2(along * 95.0, vC.x * 1.3 - uTime * 1.3)) - 0.5) * 1.4 * (1.0 - smoothstep(0.0035, 0.009, fa))
             + (vnoise(vec2(along * 14.0, vC.x * 0.5 + uTime * 0.6)) - 0.5) * 1.2 * smoothstep(0.012, 0.03, fa);
  float x = vC.x + st.w * uCardK.z * 0.5 + (vnoise(vec2(along * 2.5, uTime * 0.5)) - 0.5) * 0.3 + fine * uFine;
  float across = 1.0 - smoothstep(0.5, 1.0, abs(x));
  // fine vertical striation inside the streak (the brushed look of the targets)
  float stria = 0.7 + 0.3 * vnoise(vec2(vC.x * 11.0 + st.y * 5.0, along * 1.5));
  // broken into horizontal dashes: ripple bands across the ray
  float dash = mix(1.0, smoothstep(0.15, 0.75, vnoise(vec2(along * 17.0, x * 2.5 + st.y * 9.0))), uCardK.y) * stria;
  // the stone's grain shows through the reflection (it is painted on the ground, not floating over it)
  float grain = 0.72 + 0.28 * (vnoise(p * 61.0) * 0.5 + vnoise(p * 157.0) * 0.5);
  dash *= grain;
  float gloss = mix(0.45, 1.0, st.z) * (0.65 + 0.7 * st.y) * uWetK;
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.3 + 0.7 * pow(clamp(1.0 - V.y, 0.0, 1.0), 3.0);
  vec3 col = vCol * prof * across * dash * gloss * fres * (1.0 - st.x * 0.8) * uCardK.x;
  // keep the hue: never let a streak go pastel
  float m = max(col.r, max(col.g, col.b));
  col = mix(col, col / max(m, 1e-4) * min(m, 1.0), uCardK.w * step(1.0, m));
  float f = fogAmt(vWorld);
  col *= 1.0 - f;
  gl_FragColor = uCount > 0.5 ? vec4(1.0 / 255.0) : vec4(col, lum(col) * 0.3);
}
`;

// ── the planar mirror's one-way smear ──
const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FS_SMEAR = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int i = -2; i <= 6; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 18.0);
    acc += texture(tSrc, vUv + uStep * fi) * w;
    ws += w;
  }
  gl_FragColor = acc / ws;
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export interface GroundLook {
  wet: number;
  sheen: number;
  darken: number;
  mirrorGain: number;
  ripple: number;
  jog: number;
  ringDensity: number;
  ringSpeed: number;
  ringStrength: number;
  cardGain: number;
  cardDash: number;
  cardJog: number;
  tailNear: number;
  tailFar: number;
  cardWidth: number;
  fine: number;
}

export const DEFAULT_GROUND: GroundLook = {
  wet: 1, sheen: 0.3, darken: 0.55, mirrorGain: 1.6, ripple: 0.012, jog: 0.004, ringDensity: 1.1, ringSpeed: 0.7, ringStrength: 0.35,
  cardGain: 1.5, cardDash: 0.35, cardJog: 0.35, tailNear: 0.9, tailFar: 0.95, cardWidth: 0.6, fine: 0.32,
};

export class WetGround {
  readonly material: ShaderMaterial;
  readonly cardMat: ShaderMaterial;
  cards: Mesh | null = null;
  private readonly mirrorCam = new PerspectiveCamera();
  private mirrorRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
  private smearRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  private readonly smear: ShaderMaterial;
  private readonly quad: Mesh;
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly blank: DataTexture;
  mode: StreakMode = 'cards';
  /** the layer the planar mirror renders (emissive things only) */
  static readonly EMISSIVE_LAYER = 1;

  constructor(private readonly shared: LabShared) {
    const u = shared.u;
    this.blank = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    this.blank.needsUpdate = true;
    this.material = new ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog, uLPos: u.uLPos, uLCol: u.uLCol, uAmbient: u.uAmbient,
        uStone: { value: lin(0x6d717b) }, uInk: { value: lin(0x1a1b20) },
        uWet: { value: new Vector4(1, 0.55, 0.42, 0) }, uSpillOn: { value: 1 },
        uMirror: { value: this.blank as Texture }, uMirrorOn: { value: 0 }, uMirrorMat: { value: new Matrix4() },
        uMirrorK: { value: new Vector3(1.6, 0.012, 0.004) }, uRings: { value: new Vector4(1.1, 0.7, 0.35, 0) },
      },
      vertexShader: VS_GROUND, fragmentShader: FS_GROUND,
    });
    this.cardMat = new ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog, uGroundY: u.uGroundY,
        uSpread: { value: new Vector4(0.9, 0.95, 0.6, 0.6) }, uCardK: { value: new Vector4(1.4, 0.55, 0.35, 1) }, uWetK: { value: 1 }, uFine: { value: 0.32 }, uCount: shared.u.uCount,
      },
      vertexShader: VS_CARD, fragmentShader: FS_CARD,
      transparent: true, depthWrite: false,
      blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
      blendEquationAlpha: AddEquation, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor,
    });
    this.smear = new ShaderMaterial({
      uniforms: { tSrc: { value: null as Texture | null }, uStep: { value: new Vector2() } },
      vertexShader: VS_FULL, fragmentShader: FS_SMEAR, depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.quad = new Mesh(fullTri(), this.smear);
    this.quad.frustumCulled = false;
    this.mirrorCam.layers.set(WetGround.EMISSIVE_LAYER);
  }

  setLook(l: GroundLook): void {
    const g = this.material.uniforms;
    const c = this.cardMat.uniforms;
    (g['uWet']?.value as Vector4 | undefined)?.set(l.wet, l.sheen, l.darken, this.mode === 'screen' ? 1 : 0);
    (g['uMirrorK']?.value as Vector3 | undefined)?.set(l.mirrorGain, l.ripple, l.jog);
    (g['uRings']?.value as Vector4 | undefined)?.set(l.ringDensity, l.ringSpeed, l.ringStrength, 0);
    (c['uSpread']?.value as Vector4 | undefined)?.set(l.tailNear, l.tailFar, l.cardWidth, 0.6);
    (c['uCardK']?.value as Vector4 | undefined)?.set(l.cardGain, l.cardDash, l.cardJog, 1);
    const wk = c['uWetK'];
    if (wk !== undefined) wk.value = l.wet;
    const fn = c['uFine'];
    if (fn !== undefined) fn.value = l.fine;
  }

  /** the ground plane (x0..x1, z0..z1) at the shared ground height */
  plane(x0: number, x1: number, z0: number, z1: number): Mesh {
    const y = this.shared.u.uGroundY.value;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], 3));
    g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
    g.computeBoundingSphere();
    return new Mesh(g, this.material);
  }

  /** one streak card per emitter (instanced) */
  buildCards(emitters: readonly Emitter[]): Mesh {
    const g = new InstancedBufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute('aCorner', new Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
    g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
    const e = new Float32Array(emitters.length * 3), col = new Float32Array(emitters.length * 3), size = new Float32Array(emitters.length * 3);
    emitters.forEach((m, i) => {
      e.set([m.at.x, m.at.y, m.at.z], i * 3);
      col.set([m.color.r, m.color.g, m.color.b], i * 3);
      size.set([m.w, m.h, m.power], i * 3);
    });
    g.setAttribute('aE', new InstancedBufferAttribute(e, 3));
    g.setAttribute('aCol', new InstancedBufferAttribute(col, 3));
    g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
    g.instanceCount = emitters.length;
    const m = new Mesh(g, this.cardMat);
    m.frustumCulled = false;
    m.renderOrder = 4;
    this.cards = m;
    return m;
  }

  setMode(mode: StreakMode): void {
    this.mode = mode;
    if (this.cards !== null) this.cards.visible = mode === 'cards';
    const w = this.material.uniforms['uWet']?.value as Vector4 | undefined;
    if (w !== undefined) w.w = mode === 'screen' ? 1 : 0;
  }

  setSize(w: number, h: number): void {
    this.mirrorRT.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
    this.smearRT.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
  }

  /** 'planar' only: render the emissive layer from the mirrored camera, smear it one way (down the screen) twice */
  renderMirror(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    const on = this.mode === 'planar';
    const mu = this.material.uniforms;
    const mOn = mu['uMirrorOn'];
    if (mOn !== undefined) mOn.value = on ? 1 : 0;
    if (!on) return;
    const gy = this.shared.u.uGroundY.value;
    const cam = this.mirrorCam;
    const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rot = new Matrix4().extractRotation(camera.matrixWorld);
    const look = new Vector3(0, 0, -1).applyMatrix4(rot).add(eye);
    cam.position.set(eye.x, 2 * gy - eye.y, eye.z);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(new Vector3(0, 1, 0));
    cam.lookAt(look.x, 2 * gy - look.y, look.z);
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    // oblique near plane at the ground: nothing below it leaks into the mirror
    const plane = new Vector4(0, 1, 0, -gy);
    const clip = plane.applyMatrix4(new Matrix4().copy(cam.matrixWorldInverse).invert().transpose());
    const e = cam.projectionMatrix.elements;
    const q = new Vector4((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;
    const tm = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    (mu['uMirrorMat']?.value as Matrix4 | undefined)?.copy(tm);
    // the materials fog from uCam: the mirrored eye gives the right path length
    const camU = this.shared.u.uCam.value;
    const saved = camU.clone();
    camU.copy(cam.position);
    const mir = mu['uMirror'];
    if (mir !== undefined) mir.value = this.blank;
    renderer.setRenderTarget(this.mirrorRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);
    camU.copy(saved);
    // two one-way smears: in the mirror image "down the screen" is toward the eye, so bias the kernel that way
    const tex = this.mirrorRT;
    const uS = this.smear.uniforms;
    const src = uS['tSrc'], stp = uS['uStep'];
    if (src === undefined || stp === undefined) return;
    src.value = tex.texture;
    (stp.value as Vector2).set(0, 1.6 / tex.height);
    renderer.setRenderTarget(this.smearRT);
    renderer.render(this.quad, this.ortho);
    src.value = this.smearRT.texture;
    (stp.value as Vector2).set(0, 9.0 / tex.height);
    renderer.setRenderTarget(this.mirrorRT);
    renderer.render(this.quad, this.ortho);
    if (mir !== undefined) mir.value = this.mirrorRT.texture;
    this.mirrorRT.texture.minFilter = LinearFilter;
  }
}
