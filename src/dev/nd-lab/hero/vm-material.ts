// The hero viewmodel's look (lab P4 "hero", E169): a toon program that reads the Kit's attributes (aFace / aPat / aMisc)
// but shades by MATERIAL CLASS instead of by architecture pattern, plus an inverted-hull ink outline.
//
// - Class lives in aPat.x (the Kit's `kind`): VM.brass, VM.steel, VM.lacquer, VM.matte (cloth, leather, glove, skin),
//   VM.silk (the tassel / cord), VM.paper (the talisman, a decal cell), VM.glow (the neon edge; emit in aMisc.x).
// - Metal is toon: 3 antialiased bands of a fixed view-space key light (the sky screens above) + ONE narrow specular
//   band (a studio window) + a lit rim on the upper side. Loop 1 used a whole painted studio in the reflection and it
//   blew brass and lacquer out to white; the targets' brass is mostly mid gold with thin pale streaks, the blade black.
// - Matte is 3 hard bands of a key light from the upper left + a thin rim on the lit side (a painter's reflected light).
// - Built parts keep the Kit's ruled face edges (aMisc.y weight, aMisc.w edge bits) in 焦墨; living parts (matte, silk)
//   get none — their outline is the hull's brush line.
// - The hull (inkHullMaterial) pushes back faces out along a smoothed normal by a constant pixel width in clip space;
//   living parts vary that width along their length with a dry-brush noise (the style bible's 6–9 px brush at 3×),
//   built parts keep a steady ruled 2–3 px. One extra draw for the whole viewmodel.
import {
  BackSide, BufferAttribute, type BufferGeometry, CanvasTexture, Color, DataTexture, LinearMipmapLinearFilter, RedFormat, RepeatWrapping,
  SRGBColorSpace, ShaderMaterial, type Texture, UnsignedByteType, Vector2, Vector3,
} from 'three';

/** material classes (the Kit's `kind` slot, aPat.x); values clear of the architecture kinds 0–8 */
export const VM = { brass: 20, steel: 21, lacquer: 22, matte: 23, silk: 24, paper: 25, glow: 26, darkBrass: 27 } as const;

/** a 256² silk weave (the same idea as the world's), for the overlay */
export function weaveTexture(): DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N);
  let s = 77;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const warp = Array.from({ length: N / 4 }, () => rnd() * 2 - 1);
  const weft = Array.from({ length: N / 4 }, () => rnd() * 2 - 1);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const tx = x >> 2, ty = y >> 2;
      const over = ((tx + ty) & 1) === 0;
      const px = 1 - Math.abs(((x & 3) + 0.5) / 4 - 0.5) * 2, py = 1 - Math.abs(((y & 3) + 0.5) / 4 - 0.5) * 2;
      const thread = over ? (warp[tx] ?? 0) * 0.4 + px * 0.6 - 0.3 : (weft[ty] ?? 0) * 0.4 + py * 0.6 - 0.3;
      data[y * N + x] = Math.max(0, Math.min(255, Math.round(128 + thread * 60 + (rnd() - 0.5) * 20)));
    }
  }
  const t = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** the decal atlas: the blade's etched cloud scrolls (top half) and the fu talisman (bottom-left cell) */
export interface Decals { tex: Texture; etch: readonly [number, number, number, number]; fu: readonly [number, number, number, number] }

const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';

function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // a 祥云 scroll: three curls on a flat tail, drawn as one stroke
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
}

export function decalAtlas(): Decals {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  // etch strip (y 0..128): pale engraved lines on transparent black; the shader lightens the steel by its red channel
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 2.2;
  for (let i = 0; i < 6; i++) cloud(g, 90 + i * 150 + (i % 2) * 30, 64 + (i % 2 === 0 ? -14 : 16), 15 + (i % 3) * 4);
  // circuit ruling: the "neon" jian's engraved traces along the fuller
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(10, 60); g.lineTo(300, 60); g.lineTo(320, 44); g.lineTo(520, 44);
  g.moveTo(560, 80); g.lineTo(760, 80); g.lineTo(780, 64); g.lineTo(1010, 64);
  g.stroke();
  // the 卍-knot medallion near the guard end (x ≈ 980)
  g.lineWidth = 3;
  g.beginPath(); g.arc(975, 64, 34, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(975, 64, 24, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5;
  g.strokeRect(962, 51, 26, 26);
  // the talisman (x 0..256, y 128..512 as one tall cell): gamboge paper, a red border, red kai characters, a seal
  const fx = 0, fy = 128, fw = 192, fh = 384;
  g.fillStyle = '#ecc766';
  g.fillRect(fx, fy, fw, fh);
  g.fillStyle = 'rgba(255,240,190,0.35)';
  for (let i = 0; i < 90; i++) g.fillRect(fx + ((i * 53) % fw), fy + ((i * 97) % fh), 2 + (i % 4), 1 + (i % 3));
  g.strokeStyle = '#a3241a';
  g.lineWidth = 3;
  g.strokeRect(fx + 12, fy + 12, fw - 24, fh - 24);
  g.lineWidth = 2;
  g.strokeRect(fx + 22, fy + 22, fw - 44, fh - 44);
  g.fillStyle = '#b3261a';
  g.font = `700 92px ${KAI}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('鎮', fx + fw / 2, fy + 108);
  g.fillText('邪', fx + fw / 2, fy + 214);
  g.fillRect(fx + fw / 2 - 26, fy + 280, 52, 52);
  g.fillStyle = '#ecc766';
  g.font = `700 34px ${KAI}`;
  g.fillText('敕', fx + fw / 2, fy + 306);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, etch: [0, 1 - 128 / H, 1, 1], fu: [fx / W, 1 - (fy + fh) / H, (fx + fw) / W, 1 - fy / H] };
}

const VS = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec4 aMisc;
varying vec3 vN;
varying vec3 vView;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vColor = color;
  vFace = aFace;
  vPat = aPat;
  vMisc = aMisc;
  gl_Position = projectionMatrix * mv;
}
`;

const FS = /* glsl */ `
uniform sampler2D uSilk;
uniform sampler2D uDecal;
uniform vec4 uEtch;
uniform vec4 uFu;
uniform vec3 uKey;
uniform vec3 uInk;
uniform float uLinePx;
uniform float uSutra;
uniform vec3 uGold;
varying vec3 vN;
varying vec3 vView;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
float band(float x, float e) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(e - w, e + w, x); }
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(-vView);
  float cls = floor(vPat.x + 0.5);
  vec3 base = vColor;
  vec3 col;
  float ndl = dot(n, uKey);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  float lines = 0.0;
  vec2 ff = max(fwidth(vFace.xy), vec2(1e-6));
  float fl = floor(vMisc.w + 0.5);
  float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
  float lw = uLinePx * vMisc.y;
  if (vMisc.y > 0.0) {
    lines = max(lines, eU0 * lineAt(vFace.x, ff.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - vFace.x, ff.x, lw));
    lines = max(lines, eV0 * lineAt(vFace.y, ff.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - vFace.y, ff.y, lw));
  }
  vec3 R = reflect(-V, n);
  // key-light bands (the sky screens above) + one narrow studio highlight: toon metal the way the targets paint it
  float lit = band(ndl, 0.08);
  float half1 = band(ndl, -0.3);
  float spec = pow(max(dot(R, normalize(uKey + vec3(0.1, 0.25, 0.3))), 0.0), 24.0);
  float rimL = band(rim * max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 0.22);
  if (cls == 20.0 || cls == 27.0) {
    // brass: umber shadow, a mid brass, gold light, pale-gold highlight streaks
    vec3 dark = base * vec3(0.34, 0.27, 0.18);
    vec3 midc = base * vec3(0.72, 0.64, 0.5);
    vec3 hi = mix(base, vec3(1.0, 0.9, 0.6), 0.35) * 1.12;
    col = mix(dark, midc, half1);
    col = mix(col, base, lit);
    col = mix(col, hi, band(spec, 0.35) * lit);
    col = mix(col, vec3(1.25, 1.15, 0.85), band(spec, 0.8));
    col += base * 0.4 * rimL;
  } else if (cls == 21.0) {
    // steel: near black, the lit flat a shade lighter, one cool streak; the etch lightens the flats
    float along = vFace.y / max(vFace.w, 1e-4);
    col = mix(base * 0.5, base, half1);
    col = mix(col, base * 1.2, lit);
    col = mix(col, vec3(0.42, 0.48, 0.56), band(spec, 0.6) * 0.6);
    col *= 0.8 + 0.35 * along;
    if (vPat.y > 0.5 && vPat.y < 1.5) {
      vec2 uv = vec2(mix(uEtch.x, uEtch.z, 1.0 - along), mix(uEtch.y, uEtch.w, vFace.x / max(vFace.z, 1e-4)));
      float e = texture2D(uDecal, uv).r * smoothstep(0.02, 0.2, along) * (1.0 - smoothstep(0.75, 0.95, along));
      col = mix(col, vec3(0.36, 0.41, 0.47), e * 0.3);
    }
  } else if (cls == 22.0) {
    // black lacquer: a dark body, a narrow white highlight, a diamond silk wrap ruled over it (vPat.z = pitch)
    col = mix(base * 0.8, base * 1.8 + 0.012, lit);
    col = mix(col, vec3(0.62, 0.64, 0.7), band(spec, 0.55) * 0.8);
    if (vPat.z > 0.0 && vPat.z < 0.1) {
      vec2 q = vFace.xy;
      vec2 rq = vec2(q.x + q.y, q.x - q.y) * 0.7071 / vPat.z;
      vec2 fr = max(fwidth(rq), vec2(1e-5));
      vec2 dd = abs(fract(rq + 0.5) - 0.5);
      float w = max(lineAt(dd.x, fr.x, 1.2), lineAt(dd.y, fr.y, 1.2));
      col = mix(col, col * 0.3, w);
    }
  } else if (cls == 26.0) {
    col = base;
  } else if (cls == 25.0) {
    // paper: the talisman cell from the decal atlas, lit flat with a soft shade
    vec2 uv = vec2(mix(uFu.x, uFu.z, vFace.x / max(vFace.z, 1e-4)), mix(uFu.y, uFu.w, vFace.y / max(vFace.w, 1e-4)));
    vec3 t = texture2D(uDecal, uv).rgb;
    col = t * mix(0.72, 1.0, band(abs(ndl), 0.15));
  } else {
    // matte (cloth, leather, glove, skin) and silk: 3 hard bands, never black, a lit rim
    float l = mix(0.5, 0.74, band(ndl, -0.25));
    l = mix(l, 1.0, band(ndl, 0.25));
    col = base * l;
    if (cls == 24.0) {
      // silk: a sheen band where the view grazes
      col += base * 0.45 * band(rim, 0.35) * band(ndl, 0.0);
    } else {
      col += base * 0.28 * band(rim, 0.55) * band(ndl, -0.1);
    }
    // cloth wraps: ruled bands across the length (vPat.y = band pitch in metres)
    if (vPat.y > 0.0 && vPat.y < 1.0) {
      float q = vFace.y / vPat.y;
      float fw2 = max(fwidth(q), 1e-5);
      float d = abs(fract(q + 0.5) - 0.5);
      col = mix(col, col * 0.55, lineAt(d * vPat.y, fw2 * vPat.y, 1.3));
    }
  }
  // gold-on-indigo: lines turn gold, washes dim toward the indigo paper (the sutra look)
  vec3 lineC = mix(uInk, uGold * 1.3, uSutra);
  col = mix(col, col * vec3(0.55, 0.6, 0.85), uSutra * 0.35);
  // silk grain on the viewmodel too (codex's edit of the lab frame puts paper grain on every surface)
  col *= 1.0 + (texture2D(uSilk, gl_FragCoord.xy / 220.0).r - 0.5) * 0.12;
  col = mix(col, lineC, clamp(lines, 0.0, 1.0));
  col += base * vMisc.x;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface VmUniforms {
  uSilk: { value: Texture };
  uDecal: { value: Texture };
  uEtch: { value: [number, number, number, number] };
  uFu: { value: [number, number, number, number] };
  uKey: { value: Vector3 };
  uInk: { value: Color };
  uLinePx: { value: number };
  uSutra: { value: number };
  uGold: { value: Color };
  uRes: { value: Vector2 };
  uHullPx: { value: number };
  uTime: { value: number };
}

export function vmUniforms(silk: Texture, decals: Decals): VmUniforms {
  return {
    uSilk: { value: silk },
    uDecal: { value: decals.tex },
    uEtch: { value: [...decals.etch] },
    uFu: { value: [...decals.fu] },
    uKey: { value: new Vector3(-0.45, 0.75, 0.5).normalize() },
    uInk: { value: new Color(0x111214) },
    uLinePx: { value: 1.6 },
    uSutra: { value: 0 },
    uGold: { value: new Color(0xc9a24a) },
    uRes: { value: new Vector2(1, 1) },
    uHullPx: { value: 2.6 },
    uTime: { value: 0 },
  };
}

export function vmMaterial(u: VmUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uSilk: u.uSilk, uDecal: u.uDecal, uEtch: u.uEtch, uFu: u.uFu, uKey: u.uKey, uInk: u.uInk, uLinePx: u.uLinePx, uSutra: u.uSutra, uGold: u.uGold },
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
  });
}

const VS_HULL = /* glsl */ `
attribute vec3 aHullN;
attribute vec4 aPat;
attribute vec4 aMisc;
uniform vec2 uRes;
uniform float uHullPx;
varying float vA;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
void main() {
  float cls = floor(aPat.x + 0.5);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 nv = normalize(normalMatrix * aHullN);
  vec2 dir = normalize(nv.xy + 1e-5);
  // living things (matte, silk) are brushed: the width swells and thins along the stroke; built things are ruled
  float living = (cls == 23.0 || cls == 24.0) ? 1.0 : 0.0;
  float s = dot(position, vec3(31.0, 47.0, 23.0));
  float brush = mix(1.0, 0.45 + 1.25 * vn1(s), living);
  float w = uHullPx * brush * mix(1.0, 1.5, living) * (aMisc.y > 0.0 ? 1.0 : 0.0);
  if (cls == 26.0) w = 0.0;
  clip.xy += dir * w * 2.0 / uRes * clip.w;
  // push the hull a hair back so it never z-fights the front faces
  clip.z += 0.0004 * clip.w;
  vA = 1.0;
  gl_Position = clip;
}
`;
const FS_HULL = /* glsl */ `
uniform vec3 uInk;
uniform float uSutra;
uniform vec3 uGold;
void main() { gl_FragColor = vec4(mix(uInk, uGold * 1.3, uSutra), 1.0); }
`;

export function inkHullMaterial(u: VmUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRes: u.uRes, uHullPx: u.uHullPx, uInk: u.uInk, uSutra: u.uSutra, uGold: u.uGold },
    vertexShader: VS_HULL,
    fragmentShader: FS_HULL,
    side: BackSide,
  });
}

/** add aHullN: the normal averaged over every vertex at the same position (so the hull never splits at a hard edge) */
export function addHullNormals(g: BufferGeometry, quant = 1e-4): BufferGeometry {
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
