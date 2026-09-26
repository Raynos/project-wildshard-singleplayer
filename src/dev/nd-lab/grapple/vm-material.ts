// Lab P9 "grapple" (E169): the Fei Zhua's hero program. One ShaderMaterial for every part of the Blender model
// (blender/fei_zhua.py), driven by the data the bake wrote into COLOR_0 (renamed aData on load):
//   r = Cycles AO · g = convexity (0.5 flat, > 0.5 a bevel = edge wear, < 0.5 a crease = grime) · b = class / 16 ·
//   a = emit group / 8.
// It is a painted-realistic metal, not the P4 toon bands (Jake's picked target, round-8 target-2, paints the gauntlet's
// brass as smooth antique metal with pale streaks): an analytic painted environment in WORLD space (sky-screen ceiling,
// a horizon band of warm windows + two neon smears, the dark drop below) so the reflections move when the camera turns
// or zips, a fixed view-space key (the sky screens), a warm fill from below, magenta / cyan neon rims, two point lights
// (the muzzle flash and the capacitor's glow on the housing) and per-class finishes:
//   brass (engraved cloud scrolls, polished edges, dark patina in the creases) · dark brass · carbon (twill tows with
//   an anisotropic sheen under a clear coat) · gunmetal · leather · glow (HDR, feeds the bloom) · red silk · cloth ·
//   blade brass (polished, bright edge).
// The Jiehua touch is the ink hull (inkHullMaterial): a back-face shell pushed out a constant pixel width, brushed on
// living parts (leather, cloth, silk), ruled on built ones, gold when `uHullGold` (the sutra flip) is up.
// Output alpha is 0: the post's depth silhouette skips the viewmodel (it carries its own ink).
import {
  BackSide, BufferAttribute, type BufferGeometry, CanvasTexture, Color, LinearMipmapLinearFilter, Matrix3, RepeatWrapping,
  ShaderMaterial, type Texture, Vector2, Vector3, Vector4,
} from 'three';

/** the material classes the Blender script writes (aData.b × 16) */
export const CLS = { brass: 0, dbrass: 1, carbon: 2, gun: 3, leather: 4, glow: 5, silk: 6, cloth: 7, blade: 8 } as const;

/** a 512² engraving sheet: 祥云 cloud scrolls and a 回纹 fret band, white lines on black (triplanar on the brass) */
export function engraveTexture(): CanvasTexture {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const cloud = (x: number, y: number, s: number): void => {
    g.beginPath();
    g.moveTo(x - s * 2.2, y + s * 0.6);
    g.lineTo(x - s * 0.6, y + s * 0.6);
    g.arc(x - s * 0.6, y, s * 0.6, Math.PI / 2, -Math.PI / 2, true);
    g.arc(x - s * 0.6, y - s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2, true);
    g.moveTo(x - s * 0.2, y + s * 0.6);
    g.arc(x + s * 0.4, y - s * 0.1, s * 0.8, Math.PI * 0.8, -Math.PI * 0.2, false);
    g.arc(x + s * 0.55, y - s * 0.25, s * 0.35, -Math.PI * 0.2, Math.PI * 0.8, false);
    g.moveTo(x + s, y + s * 0.6);
    g.arc(x + s * 1.35, y + s * 0.15, s * 0.45, Math.PI * 0.75, -Math.PI * 0.4, false);
    g.lineTo(x + s * 2.6, y + s * 0.6);
    g.stroke();
  };
  // three rows of scrolls (wrapping, so the tile repeats seamlessly)
  g.lineWidth = 5;
  for (let row = 0; row < 3; row++) {
    for (let i = -1; i < 4; i++) {
      const x = i * 170 + (row % 2) * 85 + 40, y = 70 + row * 150;
      cloud(x, y, 26);
    }
  }
  // a fret (回纹) band across the bottom
  g.lineWidth = 6;
  const y0 = 440, h = 44;
  g.beginPath();
  for (let x = 0; x < N; x += 64) {
    g.moveTo(x, y0 + h);
    g.lineTo(x, y0);
    g.lineTo(x + 48, y0);
    g.lineTo(x + 48, y0 + h - 12);
    g.lineTo(x + 16, y0 + h - 12);
    g.lineTo(x + 16, y0 + 14);
    g.lineTo(x + 34, y0 + 14);
  }
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, y0 - 14);
  g.lineTo(N, y0 - 14);
  g.moveTo(0, y0 + h + 12);
  g.lineTo(N, y0 + h + 12);
  g.stroke();
  const t = new CanvasTexture(cv);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

/** the painted environment + the shared lighting code (also used by the dragon hook's program) */
export const ENV_GLSL = /* glsl */ `
float eh11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float eh21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// the Well at blue hour, painted as an environment: a cool sky-screen ceiling with bright panel bars, a horizon band of
// warm lit windows and two neon smears (magenta, cyan), the dark wet drop below. rough 0 = sharp, 1 = the average
vec3 envMap(vec3 R, float rough) {
  float y = R.y;
  float az = atan(R.z, R.x);
  vec3 top = vec3(0.50, 0.56, 0.68);
  vec3 hor = vec3(0.26, 0.29, 0.37);
  vec3 bot = vec3(0.035, 0.04, 0.055);
  vec3 c = mix(hor, top, smoothstep(0.05, 0.55 + rough * 0.35, y));
  c = mix(c, bot, smoothstep(-0.02, -0.5 - rough * 0.3, y));
  float band = exp(-pow((y - 0.06) / (0.2 + rough * 0.3), 2.0));
  float cellA = floor(az * 22.0), cellB = floor(y * 16.0);
  float win = step(0.6, eh21(vec2(cellA, cellB)));
  c += band * vec3(1.0, 0.58, 0.26) * 0.32 * mix(win, 0.4, clamp(rough * 1.4, 0.0, 1.0));
  float m1 = exp(-pow((az - 2.3) / (0.07 + rough * 0.45), 2.0)) * band;
  float m2 = exp(-pow((az + 0.8) / (0.06 + rough * 0.45), 2.0)) * band;
  c += m1 * vec3(1.0, 0.22, 0.62) * 1.5 + m2 * vec3(0.22, 0.88, 1.0) * 1.5;
  // sky-screen panel bars overhead: the sharp pale streaks on polished brass
  float bars = smoothstep(0.9 - rough * 0.6, 1.0, abs(sin(az * 3.0 + 0.4))) * smoothstep(0.35, 0.8, y);
  c += bars * vec3(0.85, 0.92, 1.0) * (1.0 - rough) * 1.6;
  return c;
}
float ggxLobe(float ndh, float rough) {
  float a = max(rough * rough, 0.002);
  float a2 = a * a;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}
`;

const VS = /* glsl */ `
attribute vec4 aData;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec3 vObjN;
varying vec4 vData;
varying vec3 vTx;
varying vec3 vTz;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vObj = position;
  vObjN = normal;
  vData = aData;
  vTx = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
  vTz = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

const FS = /* glsl */ `
uniform mat3 uViewToWorld;
uniform vec3 uKey;
uniform vec3 uKeyCol;
uniform vec3 uFill;
uniform vec3 uFillCol;
uniform vec3 uRimL;
uniform vec3 uRimLCol;
uniform vec3 uRimR;
uniform vec3 uRimRCol;
uniform vec3 uFlashPos;
uniform vec3 uFlashCol;
uniform vec3 uCapPos;
uniform vec3 uCapCol;
uniform vec4 uEmitA;
uniform vec2 uEmitB;
uniform vec3 uGlow;
uniform vec3 uLed0;
uniform vec3 uLed1;
uniform vec3 uLed2;
uniform float uEnv;
uniform float uEngraveScale;
uniform sampler2D uSilk;
uniform sampler2D uEngrave;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying vec3 vObjN;
varying vec4 vData;
varying vec3 vTx;
varying vec3 vTz;
${ENV_GLSL}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(mix(mix(eh11(n), eh11(n + 1.0), f.x), mix(eh11(n + 57.0), eh11(n + 58.0), f.x), f.y),
             mix(mix(eh11(n + 113.0), eh11(n + 114.0), f.x), mix(eh11(n + 170.0), eh11(n + 171.0), f.x), f.y), f.z);
}
float triplanar(sampler2D t, vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  return texture2D(t, p.zy).r * w.x + texture2D(t, p.xz).r * w.y + texture2D(t, p.xy).r * w.z;
}
// a point light's contribution: diffuse colour, specular colour, a GGX lobe
vec3 pointL(vec3 lp, vec3 lc, float r, vec3 N, vec3 V, vec3 diff, vec3 spec, float rough) {
  vec3 L = lp - vV;
  float d = length(L);
  L /= max(d, 1e-4);
  float att = 1.0 / (1.0 + (d * d) / (r * r));
  float ndl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  return lc * att * ndl * (diff + spec * ggxLobe(max(dot(N, H), 0.0), max(rough, 0.25)) * 0.25);
}
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(-vV);
  vec3 R = reflect(-V, N);
  vec3 Rw = normalize(uViewToWorld * R);
  float ndv = max(dot(N, V), 1e-3);
  float ao = vData.r;
  float cvx = vData.g;
  float cls = floor(vData.b * 16.0 + 0.5);
  float eg = floor(vData.a * 8.0 + 0.5);
  float edge = smoothstep(0.53, 0.8, cvx);
  float crease = smoothstep(0.47, 0.25, cvx);
  float nz = vnoise3(vObj * 180.0) * 0.6 + vnoise3(vObj * 37.0) * 0.4;
  vec3 H = normalize(uKey + V);
  float ndh = max(dot(N, H), 0.0);
  float ndl = dot(N, uKey);
  float wrapL = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
  float fill = clamp(dot(N, uFill) * 0.5 + 0.5, 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  vec3 rimC = uRimLCol * max(dot(N, uRimL), 0.0) + uRimRCol * max(dot(N, uRimR), 0.0);
  vec3 col = vec3(0.0);
  vec3 emit = vec3(0.0);
  bool metal = cls == 0.0 || cls == 1.0 || cls == 3.0 || cls == 8.0;
  if (metal) {
    vec3 alb;
    float rough;
    float engr = 0.0;
    if (cls == 0.0 || cls == 8.0) {
      engr = triplanar(uEngrave, vObj * uEngraveScale, vObjN) * (cls == 0.0 ? 1.0 : 0.55);
      alb = cls == 8.0 ? vec3(0.62, 0.43, 0.15) : vec3(0.47, 0.31, 0.10);
      rough = (cls == 8.0 ? 0.2 : 0.3) + 0.14 * nz + 0.16 * engr - 0.14 * edge;
      alb *= mix(1.0, 0.42, engr);
      // patina + grime in the creases and the occluded bits, bright polished wear on the bevels
      alb = mix(alb, vec3(0.13, 0.10, 0.05), clamp(crease * 0.7 + (1.0 - ao) * 0.55, 0.0, 0.85));
      alb = mix(alb, vec3(0.86, 0.68, 0.36), edge * (cls == 8.0 ? 0.9 : 0.65));
    } else if (cls == 1.0) {
      alb = vec3(0.21, 0.14, 0.055) * (0.85 + 0.3 * nz);
      rough = 0.42 + 0.15 * nz - 0.1 * edge;
      alb = mix(alb, vec3(0.6, 0.45, 0.24), edge * 0.5);
    } else {
      alb = vec3(0.09, 0.095, 0.105) * (0.9 + 0.2 * nz);
      rough = 0.28 + 0.1 * nz;
      alb = mix(alb, vec3(0.34, 0.36, 0.4), edge * 0.6);
    }
    rough = clamp(rough, 0.08, 0.9);
    vec3 F = alb + (vec3(1.0) - alb) * pow(1.0 - ndv, 5.0) * (1.0 - rough) * 0.8;
    vec3 env = envMap(Rw, rough) * uEnv;
    float spec = ggxLobe(ndh, rough) * max(ndl, 0.0);
    col = env * F * mix(1.0, ao, 0.85);
    col += uKeyCol * F * spec * 0.55 * ao;
    col += alb * (uKeyCol * wrapL * 0.22 + uFillCol * fill * 0.25) * ao;
    col += F * rimC * rim * 1.4;
    col += pointL(uFlashPos, uFlashCol, 0.35, N, V, alb * 0.5, F, rough);
    col += pointL(uCapPos, uCapCol, 0.07, N, V, alb * 0.6, F, rough);
  } else if (cls == 5.0) {
    // glow: the LEDs, the capacitor core, the spool's filament, the eyelet — HDR so the bloom soaks them
    float k = eg < 0.5 ? 1.0 : eg < 1.5 ? uEmitA.x : eg < 2.5 ? uEmitA.y : eg < 3.5 ? uEmitA.z : eg < 4.5 ? uEmitA.w : eg < 5.5 ? uEmitB.x : uEmitB.y;
    vec3 gc = eg < 1.5 ? uLed0 : eg < 2.5 ? uLed1 : eg < 3.5 ? uLed2 : uGlow;
    float core = pow(ndv, 1.5);
    vec3 hot = mix(gc, vec3(1.0, 1.0, 1.0), core * 0.6);
    // the dark glass when off: a tinted, reflective body
    vec3 off = gc * 0.05 + envMap(Rw, 0.1) * 0.08 * uEnv;
    col = mix(off, hot * (0.6 + 0.6 * core), clamp(k, 0.0, 1.0));
    // the spool's windings: a crawling energy along the filament
    if (eg > 4.5 && eg < 5.5) col *= 0.75 + 0.5 * smoothstep(0.3, 1.0, sin(vObj.x * 900.0 + vObj.y * 300.0));
    emit = col * max(k, 0.0) * 2.5;
    col = off;
  } else if (cls == 2.0) {
    // carbon: 3 mm twill tows, alternating direction, with an anisotropic sheen under a clear coat
    vec3 w = abs(vObjN);
    vec2 uv = w.x > w.y && w.x > w.z ? vObj.zy : w.y > w.z ? vObj.xz : vObj.xy;
    uv /= 0.0032;
    vec2 cell = floor(uv);
    vec2 f = fract(uv);
    float dirSel = mod(cell.x + cell.y, 4.0) < 2.0 ? 1.0 : 0.0;
    float across = dirSel > 0.5 ? f.y : f.x;
    float tow = 1.0 - pow(abs(across - 0.5) * 2.0, 3.0);
    vec3 T = normalize(mix(vTz, vTx, dirSel));
    float th = dot(T, H);
    float aniso = pow(sqrt(max(1.0 - th * th, 0.0)), 60.0) * max(ndl, 0.0);
    vec3 base = vec3(0.016, 0.018, 0.022) * (0.7 + 0.6 * tow);
    col = base * (uKeyCol * wrapL * 0.8 + uFillCol * fill * 0.6) * ao;
    col += vec3(0.28, 0.3, 0.34) * aniso * tow * 0.5 * ao;
    float Fc = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    col += envMap(Rw, 0.12) * Fc * uEnv * mix(1.0, ao, 0.8);
    col += uKeyCol * ggxLobe(ndh, 0.12) * max(ndl, 0.0) * 0.04 * ao;
    col += vec3(0.2, 0.21, 0.24) * edge * 0.12;
    col += rimC * rim * 0.35;
    col += pointL(uFlashPos, uFlashCol, 0.35, N, V, base * 2.0, vec3(0.05), 0.15);
    col += pointL(uCapPos, uCapCol, 0.07, N, V, base * 2.0, vec3(0.05), 0.15);
  } else {
    // leather (4), red silk (6), cloth (7): dielectric, soft
    vec3 base = cls == 4.0 ? vec3(0.026, 0.02, 0.017) : cls == 6.0 ? vec3(0.3, 0.032, 0.02) : vec3(0.034, 0.036, 0.058);
    float rough = cls == 4.0 ? 0.5 : cls == 6.0 ? 0.42 : 0.8;
    base *= 0.82 + 0.36 * nz;
    if (cls == 6.0) {
      // a braided silk cord: twisted strands catching the light in stripes
      float tw = sin(dot(vObj, vec3(1400.0, 900.0, 1400.0)));
      base *= 0.7 + 0.45 * smoothstep(-0.3, 0.8, tw);
    }
    if (cls == 7.0) {
      // a fine twill weave on the sleeve
      float wv = sin((vObj.x + vObj.y) * 2400.0) * sin((vObj.y - vObj.z) * 2400.0);
      base *= 0.88 + 0.12 * wv;
    }
    float lit = smoothstep(-0.25, 0.35, ndl);
    col = base * (uKeyCol * mix(0.35, 1.0, lit) + uFillCol * fill * 0.7) * mix(1.0, ao, 0.9);
    float Fd = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    col += envMap(Rw, rough) * Fd * uEnv * (cls == 7.0 ? 0.12 : cls == 6.0 ? 0.35 : 0.7) * ao;
    col += uKeyCol * ggxLobe(ndh, rough) * max(ndl, 0.0) * (cls == 7.0 ? 0.01 : 0.05) * ao;
    // silk and cloth: a grazing sheen; leather: a worn highlight on the bevels
    col += base * rim * (cls == 6.0 ? 2.2 : cls == 7.0 ? 1.6 : 1.0) * (0.5 + 0.5 * lit);
    col += vec3(0.1, 0.09, 0.08) * edge * (cls == 4.0 ? 0.25 : 0.0);
    col += rimC * rim * (cls == 6.0 ? 0.3 : cls == 7.0 ? 0.12 : 0.35);
    col += pointL(uFlashPos, uFlashCol, 0.35, N, V, base * 2.5, vec3(0.04), rough);
    col += pointL(uCapPos, uCapCol, 0.07, N, V, base * 2.5, vec3(0.04), rough);
  }
  // silk grain over everything (the painting's ground)
  col *= 1.0 + (texture2D(uSilk, gl_FragCoord.xy / 260.0).r - 0.5) * 0.08;
  gl_FragColor = vec4(col + emit, 0.0);
}
`;

export interface VmUniforms {
  uViewToWorld: { value: Matrix3 };
  uKey: { value: Vector3 };
  uKeyCol: { value: Color };
  uFill: { value: Vector3 };
  uFillCol: { value: Color };
  uRimL: { value: Vector3 };
  uRimLCol: { value: Color };
  uRimR: { value: Vector3 };
  uRimRCol: { value: Color };
  uFlashPos: { value: Vector3 };
  uFlashCol: { value: Color };
  uCapPos: { value: Vector3 };
  uCapCol: { value: Color };
  uEmitA: { value: Vector4 };
  uEmitB: { value: Vector2 };
  uGlow: { value: Color };
  uLed0: { value: Color };
  uLed1: { value: Color };
  uLed2: { value: Color };
  uEnv: { value: number };
  uEngraveScale: { value: number };
  uSilk: { value: Texture };
  uEngrave: { value: Texture };
  // hull
  uRes: { value: Vector2 };
  uHullPx: { value: number };
  uInk: { value: Color };
  uHullGold: { value: number };
  uGold: { value: Color };
}

export function vmUniforms(silk: Texture, engrave: Texture): VmUniforms {
  return {
    uViewToWorld: { value: new Matrix3() },
    uKey: { value: new Vector3(-0.35, 0.8, 0.45).normalize() },
    uKeyCol: { value: new Color(0.95, 1.0, 1.12) },
    uFill: { value: new Vector3(0.2, -0.9, 0.3).normalize() },
    uFillCol: { value: new Color(0.55, 0.36, 0.22) },
    uRimL: { value: new Vector3(-0.9, 0.15, -0.35).normalize() },
    uRimLCol: { value: new Color(1.0, 0.25, 0.62) },
    uRimR: { value: new Vector3(0.9, 0.25, -0.3).normalize() },
    uRimRCol: { value: new Color(0.25, 0.85, 1.0) },
    uFlashPos: { value: new Vector3() },
    uFlashCol: { value: new Color(0, 0, 0) },
    uCapPos: { value: new Vector3() },
    uCapCol: { value: new Color(0, 0, 0) },
    uEmitA: { value: new Vector4(1, 1, 1, 1) },
    uEmitB: { value: new Vector2(1, 0) },
    uGlow: { value: new Color(0.25, 0.9, 1.0) },
    uLed0: { value: new Color(0.25, 0.9, 1.0) },
    uLed1: { value: new Color(0.25, 0.9, 1.0) },
    uLed2: { value: new Color(0.25, 0.9, 1.0) },
    uEnv: { value: 1.0 },
    uEngraveScale: { value: 22 },
    uSilk: { value: silk },
    uEngrave: { value: engrave },
    uRes: { value: new Vector2(1, 1) },
    uHullPx: { value: 2.2 },
    uInk: { value: new Color(0x0d0e10) },
    uHullGold: { value: 0 },
    uGold: { value: new Color(0xc9a24a) },
  };
}

export function vmMaterial(u: VmUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uViewToWorld: u.uViewToWorld, uKey: u.uKey, uKeyCol: u.uKeyCol, uFill: u.uFill, uFillCol: u.uFillCol, uRimL: u.uRimL,
      uRimLCol: u.uRimLCol, uRimR: u.uRimR, uRimRCol: u.uRimRCol, uFlashPos: u.uFlashPos, uFlashCol: u.uFlashCol,
      uCapPos: u.uCapPos, uCapCol: u.uCapCol, uEmitA: u.uEmitA, uEmitB: u.uEmitB, uGlow: u.uGlow, uLed0: u.uLed0,
      uLed1: u.uLed1, uLed2: u.uLed2, uEnv: u.uEnv, uEngraveScale: u.uEngraveScale, uSilk: u.uSilk, uEngrave: u.uEngrave,
    },
    vertexShader: VS,
    fragmentShader: FS,
  });
}

const VS_HULL = /* glsl */ `
attribute vec3 aHullN;
attribute vec4 aData;
uniform vec2 uRes;
uniform float uHullPx;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
void main() {
  float cls = floor(aData.b * 16.0 + 0.5);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 nv = normalize(normalMatrix * aHullN);
  vec2 dir = normalize(nv.xy + 1e-5);
  // living things are brushed (the width swells and thins along the stroke); built things are ruled
  float living = (cls == 4.0 || cls == 6.0 || cls == 7.0) ? 1.0 : 0.0;
  float s = dot(position, vec3(310.0, 470.0, 230.0));
  float brush = mix(1.0, 0.45 + 1.3 * vn1(s), living);
  float w = uHullPx * brush * mix(1.0, 1.45, living);
  if (cls == 5.0) w = 0.0;
  clip.xy += dir * w * 2.0 / uRes * clip.w;
  clip.z += 0.0003 * clip.w;
  gl_Position = clip;
}
`;
const FS_HULL = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uGold;
uniform float uHullGold;
void main() { gl_FragColor = vec4(mix(uInk, uGold * 1.2, uHullGold), 0.0); }
`;

export function inkHullMaterial(u: VmUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRes: u.uRes, uHullPx: u.uHullPx, uInk: u.uInk, uGold: u.uGold, uHullGold: u.uHullGold },
    vertexShader: VS_HULL,
    fragmentShader: FS_HULL,
    side: BackSide,
  });
}

/** meshopt quantises positions / normals / tangents / uvs into normalised shorts: make them plain floats before any
 *  applyMatrix4 (writing metres back into a normalised Int16 attribute clamps them to ±1) */
export function toFloat(g: BufferGeometry, keys: readonly string[] = ['position', 'normal', 'tangent', 'uv']): BufferGeometry {
  for (const k of keys) {
    const a = g.getAttribute(k) as BufferAttribute | undefined;
    if (a === undefined) continue;
    const n = a.count, sz = a.itemSize;
    const out = new Float32Array(n * sz);
    for (let i = 0; i < n; i++) {
      out[i * sz] = a.getX(i);
      if (sz > 1) out[i * sz + 1] = a.getY(i);
      if (sz > 2) out[i * sz + 2] = a.getZ(i);
      if (sz > 3) out[i * sz + 3] = a.getW(i);
    }
    g.setAttribute(k, new BufferAttribute(out, sz));
  }
  return g;
}

/** add aHullN: the normal averaged over every vertex at the same position (the hull never splits at a hard edge) */
export function addHullNormals(g: BufferGeometry, quant = 2e-5): BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const acc = new Map<string, Vector3>();
  const key = (i: number): string => `${Math.round(pos.getX(i) / quant)},${Math.round(pos.getY(i) / quant)},${Math.round(pos.getZ(i) / quant)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let v = acc.get(k);
    if (v === undefined) { v = new Vector3(); acc.set(k, v); }
    v.x += nor.getX(i);
    v.y += nor.getY(i);
    v.z += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i)) ?? new Vector3(0, 1, 0);
    const l = v.length() > 1e-6 ? v.length() : 1;
    out[i * 3] = v.x / l;
    out[i * 3 + 1] = v.y / l;
    out[i * 3 + 2] = v.z / l;
  }
  g.setAttribute('aHullN', new BufferAttribute(out, 3));
  return g;
}
