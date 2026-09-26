// Lab P9 "grapple" (E169): the dragon hook — a cast-brass dragon head on a riveted wall plate with a ring in its jaws,
// the only gold-leaf thing in reach (the style bible's rule: gold is reserved for the grapple).
// The mesh is TRELLIS.2 (codex ref → 1024_cascade) through scripts/img2mesh/driftwood_post.py --keep-texture: 18 k tris,
// a 1024² base colour + a 1024² normal map baked from the 60 k generation. Here it gets the same painted-metal lighting
// as the gauntlet, in world space (sky-screen key, warm fill from the city below, the nearby neon as spill), the Well's
// silk fog, and the HOOKABLE outline: a gold back-face hull 3 px wide at 3× that glows (HDR, the bloom soaks it) and
// flares when the reticle locks on.
import {
  BackSide, Color, type Material, Matrix4, Mesh, type BufferGeometry, ShaderMaterial, type Texture, Vector2, Vector3, type Vector4,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { addHullNormals, ENV_GLSL, toFloat } from './vm-material';

const FOG_GLSL = /* glsl */ `
uniform vec3 uCam;
uniform float uFogDensity;
uniform vec4 uFogBand;
uniform vec3 uFogCol;
uniform vec3 uFogLow;
vec4 silkFog(vec3 wp) {
  vec3 d = wp - uCam;
  float L = length(d);
  float dy = d.y;
  float H = uFogBand.y;
  float e0 = exp(-(uCam.y - uFogBand.x) / H), e1 = exp(-(wp.y - uFogBand.x) / H);
  float band = abs(dy) > 0.05 ? H * abs(e1 - e0) / abs(dy) : exp(-(0.5 * (uCam.y + wp.y) - uFogBand.x) / H);
  float tauB = uFogBand.z * min(band, 60.0) * L;
  float tau = uFogDensity * L;
  float T = exp(-(tau + tauB));
  vec3 fc = mix(uFogCol, uFogLow, clamp(tauB / max(tau + tauB, 1e-4), 0.0, 1.0));
  return vec4(fc * (1.0 - T), T);
}
`;

const VS = /* glsl */ `
attribute vec4 tangent;
varying vec3 vW;
varying vec3 vNw;
varying vec3 vTw;
varying float vTs;
varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  mat3 nm = mat3(modelMatrix);
  vNw = normalize(nm * normal);
  vTw = normalize(nm * tangent.xyz);
  vTs = tangent.w;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FS = /* glsl */ `
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uKeyW;
uniform vec3 uKeyCol;
uniform vec3 uFillCol;
uniform vec3 uSpillPos;
uniform vec3 uSpillCol;
uniform vec3 uSpill2Pos;
uniform vec3 uSpill2Col;
uniform float uEnvI;
uniform float uLock;
uniform vec3 uGold;
uniform vec3 uBitePos;
uniform float uBite;
varying vec3 vW;
varying vec3 vNw;
varying vec3 vTw;
varying float vTs;
varying vec2 vUv;
${ENV_GLSL}
${FOG_GLSL}
void main() {
  vec3 n0 = normalize(vNw);
  if (!gl_FrontFacing) n0 = -n0;
  vec3 t = normalize(vTw - n0 * dot(n0, vTw));
  vec3 b = cross(n0, t) * vTs;
  vec3 tn = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  vec3 N = normalize(t * tn.x + b * tn.y + n0 * tn.z);
  vec3 V = normalize(uCam - vW);
  vec3 R = reflect(-V, N);
  float ndv = max(dot(N, V), 1e-3);
  vec3 tex = texture2D(uAlbedo, vUv).rgb;
  float lum = dot(tex, vec3(0.3, 0.55, 0.15));
  // the generation's brass: its luminance keeps the sculpt's crevices; the wash is ours (antique cast brass)
  float cav = smoothstep(0.0, 0.2, lum);
  vec3 alb = mix(vec3(0.1, 0.066, 0.028), vec3(0.8, 0.56, 0.2), cav);
  float rough = mix(0.6, 0.24, cav);
  vec3 F = alb + (vec3(1.0) - alb) * pow(1.0 - ndv, 5.0) * 0.6;
  vec3 H = normalize(uKeyW + V);
  float ndl = dot(N, uKeyW);
  vec3 col = envMap(R, rough) * F * uEnvI * 1.35 * mix(0.3, 1.0, cav);
  col += uKeyCol * F * ggxLobe(max(dot(N, H), 0.0), rough) * max(ndl, 0.0) * 0.9;
  col += alb * (uKeyCol * clamp(ndl * 0.6 + 0.4, 0.0, 1.0) * 0.25 + uFillCol * clamp(-N.y * 0.5 + 0.5, 0.0, 1.0) * 0.3);
  // neon spill from the nearby signs (two point lights)
  for (int i = 0; i < 2; i++) {
    vec3 lp = i == 0 ? uSpillPos : uSpill2Pos;
    vec3 lc = i == 0 ? uSpillCol : uSpill2Col;
    vec3 L = lp - vW;
    float d = length(L);
    L /= d;
    float att = 1.0 / (1.0 + d * d * 0.35);
    col += lc * att * (alb * max(dot(N, L), 0.0) + F * ggxLobe(max(dot(N, normalize(L + V)), 0.0), max(rough, 0.3)) * 0.3);
  }
  // hookable: the whole casting warms toward bright gold leaf when locked
  col += uGold * uLock * 0.35 * (0.4 + 0.6 * pow(1.0 - ndv, 2.0)) * cav;
  // the bite: a hot flash of the talons' sparks on the ring
  vec3 Lb = uBitePos - vW;
  float db = length(Lb);
  col += vec3(1.0, 0.85, 0.55) * uBite * 4.0 / (1.0 + db * db * 40.0) * max(dot(N, Lb / max(db, 1e-4)), 0.0);
  // the only gold-leaf thing in reach: lifted so it stays the brightest brass through the blue-hour grade
  col *= 1.6;
  vec4 fg = silkFog(vW);
  gl_FragColor = vec4(col * fg.a + fg.rgb, fg.a);
}
`;

const VS_HULL = /* glsl */ `
attribute vec3 aHullN;
uniform vec2 uRes;
uniform float uPx;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 nv = normalize(normalMatrix * aHullN);
  clip.xy += normalize(nv.xy + 1e-5) * uPx * 2.0 / uRes * clip.w;
  clip.z += 0.0002 * clip.w;
  gl_Position = clip;
}
`;
const FS_HULL = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uInk;
uniform float uLock;
uniform float uPulse;
void main() {
  // idle: a ruled 泥金 gold line with a faint glow (hookable in range); locked: brighter, pulsing
  vec3 c = mix(uGold * 0.9, uGold * (1.45 + 0.5 * uPulse), uLock);
  gl_FragColor = vec4(c, 0.0);
}
`;

export interface HookUniforms {
  uCam: { value: Vector3 }; uFogDensity: { value: number }; uFogBand: { value: Vector4 }; uFogCol: { value: Color }; uFogLow: { value: Color };
}

export class DragonHook {
  readonly body: Mesh;
  readonly hull: Mesh;
  /** the ring's centre (world), where the claw bites */
  readonly anchor = new Vector3();
  /** the way the head points (world, unit): the approach side */
  readonly facing = new Vector3();
  readonly u;
  readonly uHull;
  /** the casting in its own frame (before the mount): the gauntlet reuses its head as an ornament */
  raw: BufferGeometry | null = null;

  private constructor(geo: BufferGeometry, albedo: Texture, normal: Texture, world: HookUniforms) {
    this.u = {
      uAlbedo: { value: albedo }, uNormal: { value: normal },
      uKeyW: { value: new Vector3(-0.25, 0.9, 0.35).normalize() }, uKeyCol: { value: new Color(0.95, 1.0, 1.1) },
      uFillCol: { value: new Color(0.6, 0.38, 0.22) },
      uSpillPos: { value: new Vector3() }, uSpillCol: { value: new Color(0, 0, 0) },
      uSpill2Pos: { value: new Vector3() }, uSpill2Col: { value: new Color(0, 0, 0) },
      uEnvI: { value: 1.0 }, uLock: { value: 0 }, uGold: { value: new Color(0xc9a24a) },
      uBitePos: { value: new Vector3() }, uBite: { value: 0 },
      uCam: world.uCam, uFogDensity: world.uFogDensity, uFogBand: world.uFogBand, uFogCol: world.uFogCol, uFogLow: world.uFogLow,
    };
    this.uHull = {
      uRes: { value: new Vector2(1, 1) }, uPx: { value: 1.5 }, uGold: this.u.uGold, uInk: { value: new Color(0x111214) },
      uLock: this.u.uLock, uPulse: { value: 0 },
    };
    this.body = new Mesh(geo, new ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS }));
    this.hull = new Mesh(geo, new ShaderMaterial({ uniforms: this.uHull, vertexShader: VS_HULL, fragmentShader: FS_HULL, side: BackSide }));
    this.hull.renderOrder = 1;
  }

  /** load the TRELLIS casting and mount it: `at` = the wall point behind the plate, `face` = the wall's normal */
  static async load(url: string, world: HookUniforms, at: Vector3, face: Vector3, scale: number): Promise<DragonHook> {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((o) => { if (o instanceof Mesh) meshes.push(o as Mesh); });
    const m = meshes[0];
    if (m === undefined) throw new Error('dragon hook: no mesh');
    const geo = toFloat(m.geometry.clone());
    geo.applyMatrix4(m.matrixWorld);
    const mat = m.material as Material & { map?: Texture | null; normalMap?: Texture | null };
    const albedo = mat.map ?? null, normal = mat.normalMap ?? null;
    if (albedo === null || normal === null) throw new Error('dragon hook: textures missing');
    if (!geo.hasAttribute('tangent')) geo.computeTangents();
    // the casting's own frame (post output): plate back at z ≈ −0.21, the head out along +z, the ring below the jaw
    const raw = geo.clone();
    const ring = new Vector3(-0.02, 0.26, 0.73);
    const plateBack = -0.211;
    const yaw = Math.atan2(face.x, face.z);
    const M = new Matrix4().makeTranslation(at.x, at.y, at.z)
      .multiply(new Matrix4().makeRotationY(yaw))
      .multiply(new Matrix4().makeScale(scale, scale, scale))
      .multiply(new Matrix4().makeTranslation(0, -0.5, -plateBack));
    geo.applyMatrix4(M);
    geo.computeBoundingSphere();
    addHullNormals(geo, 1e-4);
    const h = new DragonHook(geo, albedo, normal, world);
    h.raw = raw;
    h.anchor.copy(ring).applyMatrix4(M);
    h.facing.copy(face).normalize();
    return h;
  }

  setLock(k: number, pulse: number): void {
    this.u.uLock.value = k;
    this.uHull.uPulse.value = pulse;
    this.uHull.uPx.value = 1.5 + 1.2 * k;
  }
}
