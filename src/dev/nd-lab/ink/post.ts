// Lab P1 "ink" (E169): the frame. The world renders into an MSAA ×4 half-float target whose ALPHA carries the
// normalised inverse view depth (near / z, written by jiehuaMaterial); the MSAA resolve averages it by coverage, so the
// silhouette pass below reads an antialiased depth for free (no MRT, no second scene pass, no normal buffer).
// One composite then: the silhouette (heavier near, fogged like the surface it sits on), the silk over the whole
// frame, a soft shoulder, sRGB, dither.
import {
  BufferGeometry, type Camera, Color, DepthTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix4, Mesh,
  NearestFilter, NoBlending, OrthographicCamera, type PerspectiveCamera, type Scene, ShaderMaterial, type Texture,
  type TextureDataType, UnsignedByteType, UnsignedIntType, Vector2, type WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { FOG_GLSL, NOISE_GLSL, type Shared } from './jiehua';

const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS_COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uDpr;
uniform float uTime;
uniform float uSilMode;   // 0 none · 1 alpha (MSAA-resolved inverse depth) · 2 depth texture · 3 depth texture + normal-hash creases
uniform vec2 uSilPx;      // width near, width at 60 m (px at 3×)
uniform vec2 uSilFade;    // silhouettes gone between these distances (m)
uniform float uSilGain;
uniform float uInkMid;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uLineFog;
uniform float uPaperWeave;
uniform vec3 uShadowTint;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec2 vUv;
${NOISE_GLSL}
${FOG_GLSL}
float ldTex(vec2 uv) {
  float z = texture(tDepth, uv).r;
  return 2.0 * uNear * uFar / (uFar + uNear - (2.0 * z - 1.0) * (uFar - uNear));
}
// inverse depth (1/m): linear across a plane in screen space, so its Laplacian is 0 on every flat face and only
// folds (silhouettes, convex creases) survive
float wAt(vec2 uv) {
  if (uSilMode < 1.5) return texture(tColor, uv).a / uNear;
  return 1.0 / ldTex(uv);
}
float fold(vec2 uv, float wc, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (wAt(uv + o1) + wAt(uv - o1) - 2.0 * wc) / wc;
  float l2 = (wAt(uv + o2) + wAt(uv - o2) - 2.0 * wc) / wc;
  float l3 = (wAt(uv + o3) + wAt(uv - o3) - 2.0 * wc) / wc;
  float l4 = (wAt(uv + o4) + wAt(uv - o4) - 2.0 * wc) / wc;
  return -min(min(l1, l2), min(l3, l4));
}
float crease(vec2 uv, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel;
  float a = texture(tColor, uv).a;
  float d = abs(texture(tColor, uv + o1).a - a) + abs(texture(tColor, uv - o1).a - a) + abs(texture(tColor, uv + o2).a - a) + abs(texture(tColor, uv - o2).a - a);
  return smoothstep(0.02, 0.08, d);
}
vec3 shoulder(vec3 x) {
  vec3 k = 0.78 + 0.22 * (1.0 - exp(-(x - 0.78) / 0.22));
  return mix(x, k, step(0.78, x));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec4 src = texture(tColor, vUv);
  vec3 c = src.rgb;
  if (uSilMode > 0.5) {
    float wc = wAt(vUv);
    if (wc > 1e-5) {
      float z = 1.0 / wc;
      float r = mix(uSilPx.x, uSilPx.y, smoothstep(4.0, 60.0, z)) * uDpr;
      // two radii, half a pixel apart, averaged: the line's outer border gets a one-pixel ramp instead of a stair
      float e = 0.5 * (clamp(fold(vUv, wc, r - 0.5) / uSilGain, 0.0, 1.0) + clamp(fold(vUv, wc, r + 0.5) / uSilGain, 0.0, 1.0));
      e = max(e, clamp(fold(vUv, wc, max(r * 0.5, 1.0)) / uSilGain, 0.0, 1.0));
      if (uSilMode > 2.5) e = max(e, crease(vUv, max(r * 0.5, 1.0)));
      e *= 1.0 - smoothstep(uSilFade.x, uSilFade.y, z);
      if (e > 0.002) {
        // the line sits on the near surface: fog it like that surface (lines dissolve before the wash)
        vec4 vr = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 pv = vr.xyz / vr.w;
        pv *= z / max(-pv.z, 1e-4);
        vec3 wp = (uCamWorld * vec4(pv, 1.0)).xyz;
        vec4 fg = silkFog(wp);
        vec3 ink = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, z));
        vec3 lineC = ink * fg.a + fg.rgb;
        c = mix(c, lineC, e * pow(fg.a, uLineFog - 1.0));
      }
    }
  }
  // the whole picture is on silk: a faint weave over everything, the ink shadows a little bluer
  float weave = texture(uSilk, gl_FragCoord.xy / (240.0 * uDpr)).r;
  c *= 1.0 + (weave - 0.5) * uPaperWeave;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, c * uShadowTint, (1.0 - smoothstep(0.02, 0.25, l)) * 0.5);
  c = shoulder(c);
  vec3 o = toSRGB(c);
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export type SilMode = 'none' | 'alpha' | 'depth' | 'sobel';
const SIL: Record<SilMode, number> = { none: 0, alpha: 1, depth: 2, sobel: 3 };

export class InkPost {
  private readonly quad: Mesh;
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rt: WebGLRenderTarget;
  private readonly type: TextureDataType;
  readonly mat: ShaderMaterial;
  readonly u;
  private w = 1;
  private h = 1;

  constructor(private readonly renderer: WebGLRenderer, private readonly shared: Shared) {
    const ext = renderer.extensions;
    this.type = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? HalfFloatType : UnsignedByteType;
    this.quad = new Mesh(fullTri());
    this.quad.frustumCulled = false;
    this.rt = this.makeTarget(1, 1);
    const s = shared.u;
    this.u = {
      tColor: { value: null as Texture | null }, tDepth: { value: null as Texture | null },
      uSilk: s.uSilk, uTexel: { value: new Vector2() }, uNear: { value: 0.1 }, uFar: s.uFar, uDpr: s.uDpr, uTime: s.uTime,
      uSilMode: { value: 1 }, uSilPx: { value: new Vector2(2.1, 1.2) }, uSilFade: { value: new Vector2(60, 170) }, uSilGain: { value: 0.35 },
      uInkMid: s.uInkMid, uInk0: s.uInk0, uInk1: s.uInk1, uLineFog: s.uLineFog, uPaperWeave: { value: 0 },
      uShadowTint: { value: new Color(0.92, 0.97, 1.08) },
      uInvProj: { value: new Matrix4() }, uCamWorld: { value: new Matrix4() },
      uCam: s.uCam, uFogBase: s.uFogBase, uFogStart: s.uFogStart, uFogBaseCol: s.uFogBaseCol, uBands: s.uBands, uBandCols: s.uBandCols,
    };
    this.mat = new ShaderMaterial({ vertexShader: VS_FULL, fragmentShader: FS_COMPOSITE, uniforms: this.u, depthTest: false, depthWrite: false, blending: NoBlending });
  }

  setSilhouette(m: SilMode): void { this.u.uSilMode.value = SIL[m]; }

  private makeTarget(w: number, h: number): WebGLRenderTarget {
    const depth = new DepthTexture(w, h, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    const rt = new WebGLRenderTarget(w, h, { type: this.type, samples: 4, depthBuffer: true, depthTexture: depth });
    rt.texture.minFilter = LinearFilter;
    rt.texture.magFilter = LinearFilter;
    return rt;
  }

  setSize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rt.dispose();
    this.rt = this.makeTarget(w, h);
    this.shared.u.uRes.value.set(w, h);
  }

  render(scene: Scene, camera: PerspectiveCamera, overlay?: { scene: Scene; camera: Camera }): void {
    this.renderWorld(scene, camera, overlay);
    this.composite(camera);
  }

  /** the world (+ an overlay such as the viewmodel) into the MSAA target; alpha = inverse depth for both */
  renderWorld(scene: Scene, camera: PerspectiveCamera, overlay?: { scene: Scene; camera: Camera }): void {
    const r = this.renderer;
    r.autoClear = false;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0); // alpha 0 = inverse depth 0 = infinitely far
    r.clear(true, true, false);
    r.render(scene, camera);
    // the viewmodel may clear depth: the silhouette reads alpha, which the viewmodel's own jiehua pixels overwrite
    // with their own inverse depth, so world and weapon both keep their outlines (no depth-slice trick needed)
    if (overlay !== undefined) { r.clearDepth(); r.render(overlay.scene, overlay.camera); }
  }

  /** the one full-screen pass: silhouette, silk, grade → the canvas */
  composite(camera: PerspectiveCamera): void {
    const r = this.renderer;
    const u = this.u;
    u.tColor.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    u.uTexel.value.set(1 / this.w, 1 / this.h);
    u.uNear.value = camera.near;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    this.quad.material = this.mat;
    r.setRenderTarget(null);
    r.render(this.quad, this.ortho);
  }
}
