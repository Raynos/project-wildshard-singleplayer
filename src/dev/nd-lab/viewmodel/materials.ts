// The viewmodel's look (lab P8 "viewmodel", E169): ONE toon program for every held / worn thing, shading by material
// class (geo.ts CLS) from baked maps, plus an inverted-hull ink outline.
//
// - Maps come as data, per vertex (`color`: a procedural piece or a vertex-baked GLB such as the TRELLIS guard) or from
//   a texture pair (a Blender GLB: `<name>-maps.webp` r AO · g curvature · b detail, `<name>-nrm.webp` object-space
//   normals in Blender axes). AO darkens crevices toward umber, curvature < 0.3 draws a crease in ink (the gongbi
//   line inside a form), > 0.65 lights a worn edge, detail modulates the wash (stitches, engraving, weave, grime).
// - Metal (brass / dark brass / gold thread): 3 antialiased bands of a fixed view-space key light (the sky screens,
//   upper left), ONE narrow studio highlight band, a worn-edge light, and a faint two-tone street reflection (cool sky
//   above, warm neon wet street below) — lab P4's lesson: a full environment blows brass out to plastic.
// - Steel (the blade): near black; a long cool reflection band slides along the flat as the blade turns; the etch
//   decal (cloud scrolls, circuit rulings, the 卍 medallion) is pale engraved steel.
// - Lacquer: black with one sharp white highlight. Matte (leather, glove, cloth, sleeve, trim, silk, carbon, skin): 3
//   hard bands, never black, a painter's rim on the lit side; leather gets a cool narrow sheen, silk a grazing sheen.
// - The neon spill: the blade's cyan edge lights what is near it (the guard, the glove, the tassel) with an inverse-
//   square falloff from the blade's line (uBladeA → uBladeB, view space) — cheap, and it makes the blade a light.
// - Built parts keep ruled lines (aFace/aMat.w edge bits); living parts get their outline from the hull's brush.
// - The hull (inkHullMaterial): back faces pushed out a constant pixel width along an averaged normal; living classes
//   swell and thin along the stroke (a dry brush), built classes stay ruled. The glow gets none.
import {
  BackSide, BufferAttribute, type BufferGeometry, CanvasTexture, Color, DataTexture, LinearMipmapLinearFilter, RedFormat, RepeatWrapping,
  SRGBColorSpace, ShaderMaterial, type Texture, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three';
import { CLS } from './geo';

/** the class palette (sRGB hex), index = CLS value; tuned against round-6 style A / target-1 */
export const PALETTE: Readonly<Record<number, number>> = {
  0: 0x808080,
  [CLS.brass]: 0xa8834a,
  [CLS.brassDark]: 0x6f5427,
  [CLS.steel]: 0x13161c,
  [CLS.lacquer]: 0x131418,
  [CLS.leather]: 0x25201f,
  [CLS.glove]: 0x332d2b,
  [CLS.cloth]: 0xd9c6a4,
  [CLS.sleeve]: 0x262b3a,
  [CLS.trim]: 0xa3261b,
  [CLS.silk]: 0xc42e1f,
  [CLS.carbon]: 0x18191e,
  [CLS.glow]: 0xd9fbff,
  [CLS.gold]: 0xd6a84c,
  [CLS.paper]: 0xffffff,
  [CLS.bevel]: 0x262c36,
  [CLS.skin]: 0xc99a7c,
};
export const NPAL = 17;

/** a 256² silk weave, for the grain overlay */
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

const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';
const SEAL = '"Noto Serif TC", "Songti TC", serif';

/** a 祥云 scroll: three curls on a flat tail, one stroke */
function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, flip: boolean): void {
  g.save();
  g.translate(x, y);
  if (flip) g.scale(-1, 1);
  g.beginPath();
  g.moveTo(-s * 2.6, s * 0.6);
  g.lineTo(-s * 0.6, s * 0.6);
  g.arc(-s * 0.6, 0, s * 0.6, Math.PI / 2, -Math.PI / 2, true);
  g.arc(-s * 0.6, -s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2, true);
  g.moveTo(-s * 0.2, s * 0.6);
  g.arc(s * 0.4, -s * 0.1, s * 0.8, Math.PI * 0.8, -Math.PI * 0.2, false);
  g.arc(s * 0.55, -s * 0.25, s * 0.35, -Math.PI * 0.2, Math.PI * 0.8, false);
  g.moveTo(s, s * 0.6);
  g.arc(s * 1.35, s * 0.15, s * 0.45, Math.PI * 0.75, -Math.PI * 0.4, false);
  g.lineTo(s * 3.0, s * 0.6);
  g.stroke();
  // the inner echo line (engravers double the scroll)
  g.globalAlpha = 0.55;
  g.beginPath();
  g.arc(s * 0.4, -s * 0.1, s * 0.55, Math.PI * 0.85, -Math.PI * 0.1, false);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

/** the decal atlas: the blade etch strip (top 256 px of 2048) and the fu talisman cell */
export interface Decals { tex: Texture; etch: Vector4; fu: Vector4 }

export function decalAtlas(): Decals {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // ── the etch strip (x 0..2048 = blade root → tip, y 0..256 = across one flat, the ridge at y 128) ──
  const EH = 256;
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the fuller rulings: two engraved lines either side of the ridge, fading out toward the tip
  g.lineWidth = 2.2;
  for (const y of [104, 152]) {
    g.beginPath();
    g.moveTo(40, y);
    g.lineTo(1500, y + (y < 128 ? 10 : -10));
    g.stroke();
  }
  // clouds along the fuller, alternating sides, shrinking toward the tip
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = 330 + i * 150 + (i % 2) * 30;
    const s = 17 - i * 1.1;
    cloud(g, x, i % 2 === 0 ? 70 : 190, s, i % 2 === 1);
  }
  // circuit rulings (the neon jian's traces): stepped lines toward the tip
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(1450, 118); g.lineTo(1640, 118); g.lineTo(1662, 100); g.lineTo(1860, 100);
  g.moveTo(1500, 140); g.lineTo(1700, 140); g.lineTo(1720, 156); g.lineTo(1900, 156);
  g.stroke();
  for (const [x, y] of [[1860, 100], [1900, 156], [1640, 118]] as const) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.stroke();
  }
  // the 卍-knot medallion near the guard (x ≈ 150) and two seal characters under it
  g.lineWidth = 4;
  g.beginPath(); g.arc(150, 128, 58, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(150, 128, 44, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3.5;
  g.strokeRect(128, 106, 44, 44);
  g.beginPath();
  g.moveTo(150, 90); g.lineTo(150, 166); g.moveTo(112, 128); g.lineTo(188, 128);
  g.stroke();
  g.fillStyle = '#fff';
  g.font = `900 38px ${SEAL}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(268, 128);
  g.rotate(Math.PI / 2);
  g.fillText('九龍', 0, 0);
  g.restore();
  // ── the talisman cell (x 0..384, y 256..1024): gamboge paper, red borders, red kai 鎮邪, a seal ──
  const fx = 0, fy = EH, fw = 384, fh = 768;
  g.fillStyle = '#e8c261';
  g.fillRect(fx, fy, fw, fh);
  let s = 11;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,190,0.35)' : 'rgba(150,100,30,0.12)';
    g.fillRect(fx + rnd() * fw, fy + rnd() * fh, 1 + rnd() * 5, 1 + rnd() * 2);
  }
  // age: a darker rim, a water stain
  const grd = g.createRadialGradient(fx + fw / 2, fy + fh / 2, fw * 0.2, fx + fw / 2, fy + fh / 2, fh * 0.62);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(120,70,20,0.35)');
  g.fillStyle = grd;
  g.fillRect(fx, fy, fw, fh);
  g.strokeStyle = '#9f2217';
  g.lineWidth = 6;
  g.strokeRect(fx + 22, fy + 22, fw - 44, fh - 44);
  g.lineWidth = 3;
  g.strokeRect(fx + 38, fy + 38, fw - 76, fh - 76);
  g.fillStyle = '#ad2418';
  g.font = `700 150px ${KAI}`;
  g.fillText('鎮', fx + fw / 2, fy + 190);
  g.fillText('邪', fx + fw / 2, fy + 360);
  g.font = `700 64px ${KAI}`;
  g.fillText('敕令', fx + fw / 2, fy + 490);
  g.fillRect(fx + fw / 2 - 48, fy + 560, 96, 96);
  g.fillStyle = '#e8c261';
  g.font = `700 56px ${SEAL}`;
  g.fillText('印', fx + fw / 2, fy + 610);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, etch: new Vector4(0, 1 - EH / H, 1, 1), fu: new Vector4(fx / W, 1 - (fy + fh) / H, (fx + fw) / W, 1 - fy / H) };
}

const VS = /* glsl */ `
attribute vec4 aMat;
attribute vec4 aFace;
attribute vec3 aNs;
varying vec3 vN;
varying vec3 vNs;
varying vec3 vView;
varying vec3 vMaps;
varying vec2 vUv;
varying vec4 vFace;
flat varying vec4 vMat;
varying vec3 vOX;
varying vec3 vOY;
varying vec3 vOZ;
varying vec3 vObj;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vNs = normalize(normalMatrix * aNs);
  vOX = normalMatrix * vec3(1.0, 0.0, 0.0);
  vOY = normalMatrix * vec3(0.0, 1.0, 0.0);
  vOZ = normalMatrix * vec3(0.0, 0.0, 1.0);
  vMaps = color;
  vUv = uv;
  vFace = aFace;
  vMat = aMat;
  gl_Position = projectionMatrix * mv;
}
`;

const FS = /* glsl */ `
uniform vec3 uPal[${NPAL}];
uniform sampler2D uSilk;
uniform sampler2D uDecal;
uniform sampler2D uMapsTex;
uniform sampler2D uNrmTex;
uniform float uTexOn;
uniform vec4 uEtch;
uniform vec4 uFu;
uniform vec3 uKey;
uniform vec3 uInk;
uniform float uLinePx;
uniform float uSutra;
uniform vec3 uGold;
uniform vec3 uEnvHi;
uniform vec3 uEnvLo;
uniform vec3 uBladeA;
uniform vec3 uBladeB;
uniform vec4 uSpill;
uniform vec4 uTune;   // x crease ink, y edge wear, z AO strength, w env tint
uniform float uExposure;
uniform float uDetail;
varying vec3 vN;
varying vec3 vNs;
varying vec3 vView;
varying vec3 vMaps;
varying vec2 vUv;
varying vec4 vFace;
flat varying vec4 vMat;
varying vec3 vOX;
varying vec3 vOY;
varying vec3 vOZ;
varying vec3 vObj;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
float band(float x, float e) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(e - w, e + w, x); }
void main() {
  int ci = int(floor(vMat.x + 0.5));
  float cls = float(ci);
  vec3 n = normalize(vN);
  vec3 nm = normalize(vNs);
  vec3 maps = vMaps;
  if (uTexOn > 0.5) {
    maps = texture2D(uMapsTex, vUv).rgb;
    vec3 nb = texture2D(uNrmTex, vUv).rgb * 2.0 - 1.0;
    // Blender object axes → glTF / three local (x, z, -y) → view
    vec3 nl = vec3(nb.x, nb.z, -nb.y);
    vec3 nv = vOX * nl.x + vOY * nl.y + vOZ * nl.z;
    // a baked normal that disagrees wildly with the surface is a bake miss (contacts, tiny caps): keep the surface's
    if (dot(nv, nv) > 0.01) {
      nv = normalize(nv);
      float agree = dot(nv, n);
      n = normalize(mix(n, nv, 0.8 * smoothstep(0.2, 0.55, agree)));
    }
  }
  if (!gl_FrontFacing) { n = -n; nm = -nm; }
  float ao = maps.r, curv = maps.g, det = maps.b;
  vec3 V = normalize(-vView);
  vec3 base = uPal[ci] * clamp(1.0 + (det - 0.5) * uDetail, 0.35, 1.6);
  // big value shapes from the macro normal, glints / rims / ink from the detail normal
  float ndl = dot(nm, uKey);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 R = reflect(-V, n);
  vec3 Hk = normalize(uKey + vec3(0.1, 0.25, 0.3));
  float lit = band(ndl, 0.06);
  float half1 = band(ndl, -0.32);
  float aoK = mix(1.0, ao, uTune.z);
  float wear = smoothstep(0.62, 0.86, curv) * uTune.y;
  float crease = smoothstep(0.3, 0.1, curv) * uTune.x;
  float env = smoothstep(-0.35, 0.45, R.y);
  vec3 envC = mix(uEnvLo, uEnvHi, env);
  vec3 col;
  bool metal = ci == ${CLS.brass} || ci == ${CLS.brassDark} || ci == ${CLS.gold};
  if (metal) {
    // the painter's three values from the macro normal; AO sinks the crevices, harder on the shadow side
    vec3 shadowC = base * vec3(0.2, 0.13, 0.08);
    vec3 midC = base * vec3(0.6, 0.48, 0.34);
    vec3 lightC = base * 1.1;
    float v1 = band(ndl, -0.22), v2 = band(ndl, 0.32);
    col = mix(shadowC, midC, v1);
    col = mix(col, lightC, v2);
    col *= mix(mix(0.2, 0.42, v2), 1.0, aoK);
    // glints from the detail normal, only where lit: sparse and sharp
    float spec = pow(max(dot(R, Hk), 0.0), 48.0);
    col = mix(col, vec3(1.18, 1.02, 0.72), band(spec, 0.8) * v1);
    // raised ridges of the engraving catch light
    col = mix(col, base * 1.3 + 0.015, wear * 0.35 * v1);
    // a faint brushed / patinated grain (object space, metres): antique, not polished plastic
    col *= 0.92 + 0.16 * vn3(vObj * vec3(900.0, 260.0, 900.0));
    col = mix(col, col * envC * 1.8, uTune.w);
    col += base * 0.3 * band(rim * max(n.y, 0.0), 0.25);
  } else if (ci == ${CLS.steel} || ci == ${CLS.bevel}) {
    float along = vFace.y / max(vFace.w, 1e-4);
    col = mix(base * 0.6, base, half1);
    col = mix(col, base * 1.18, lit);
    // the sky screens slide along the flat: one long cool band, one faint warm one from the street
    float sky = smoothstep(0.78, 0.97, dot(R, normalize(vec3(-0.25, 0.85, 0.45))));
    float street = smoothstep(0.6, 0.92, dot(R, normalize(vec3(0.3, -0.7, 0.6))));
    col = mix(col, vec3(0.3, 0.36, 0.46), sky * 0.5);
    col += vec3(0.22, 0.08, 0.1) * street * 0.5;
    if (ci == ${CLS.bevel}) col = mix(col, vec3(0.45, 0.66, 0.74), 0.12 + 0.3 * sky);
    col *= 0.9 + 0.12 * along;
    if (vMat.z < -0.5) {
      // etched flat: the decal strip along the blade (u = across the flat, v = root → tip)
      vec2 uv = vec2(mix(uEtch.x, uEtch.z, vUv.y), mix(uEtch.y, uEtch.w, vUv.x));
      float e = texture2D(uDecal, uv).r * (1.0 - smoothstep(0.8, 0.97, vUv.y));
      col = mix(col, vec3(0.42, 0.5, 0.58) + sky * 0.2, e * 0.42);
    }
  } else if (ci == ${CLS.lacquer}) {
    col = mix(base * 0.8, base * 1.9 + 0.012, lit);
    float spec = pow(max(dot(R, Hk), 0.0), 40.0);
    col = mix(col, vec3(0.66, 0.68, 0.74), band(spec, 0.5) * 0.85);
    col += envC * 0.05 * rim;
    col *= mix(0.4, 1.0, aoK);
  } else if (ci == ${CLS.glow}) {
    col = base;
  } else if (ci == ${CLS.paper}) {
    vec2 uv = vec2(mix(uFu.x, uFu.z, vUv.x), mix(uFu.y, uFu.w, vUv.y));
    vec3 t = texture2D(uDecal, uv).rgb;
    col = t * mix(0.62, 1.0, band(abs(ndl), 0.12));
    col += t * 0.15 * rim;
  } else {
    // matte: 3 hard bands, never black, a painter's rim
    float l = mix(0.46, 0.72, band(ndl, -0.28));
    l = mix(l, 1.0, band(ndl, 0.24));
    col = base * l;
    if (ci == ${CLS.glove} || ci == ${CLS.leather}) {
      // leather: a soft sheen band and a cool wet rim (codex's edits light the knuckles and the finger backs)
      // pebbled leather: ~1 mm grain in object space; the sheen breaks up on it
      float grain = vn3(vObj * 1100.0) * 0.6 + vn3(vObj * 2600.0) * 0.4;
      col *= 0.8 + 0.4 * grain;
      float spec = pow(max(dot(R, Hk), 0.0), 10.0);
      col += vec3(0.44, 0.44, 0.46) * smoothstep(0.1, 0.9, spec) * 0.1 * (0.4 + grain);
      col += envC * 0.1 * rim;
    } else if (ci == ${CLS.silk} || ci == ${CLS.trim}) {
      col += base * 0.4 * band(rim, 0.35) * band(ndl, -0.05);
    } else if (ci == ${CLS.cloth} || ci == ${CLS.sleeve}) {
      // linen: a fine thread fleck and a slow tonal drift (the wraps are hand-dyed cloth, not paint)
      float fleck = vn3(vObj * vec3(1800.0, 700.0, 1800.0));
      col *= 0.86 + 0.24 * fleck;
      col *= 0.94 + 0.12 * vn3(vObj * 60.0);
    } else if (ci == ${CLS.carbon}) {
      float spec = pow(max(dot(R, Hk), 0.0), 30.0);
      col += vec3(0.4, 0.44, 0.5) * band(spec, 0.4) * (0.4 + 0.6 * det);
    }
    col += base * 0.3 * band(rim, 0.55) * band(ndl, -0.1);
    col = mix(col, col * 1.12 + 0.02, wear * 0.4);
    col *= mix(0.42, 1.0, aoK);
  }
  // the neon spill: the blade's cyan edge lights what is near it
  if (ci != ${CLS.glow} && ci != ${CLS.steel} && ci != ${CLS.bevel} && uSpill.w > 0.0) {
    vec3 pa = vView - uBladeA, ba = uBladeB - uBladeA;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    vec3 d = pa - ba * h;
    float dist = length(d);
    float facing = clamp(dot(n, -d / max(dist, 1e-5)) * 0.7 + 0.3, 0.0, 1.0);
    float sp = uSpill.w / (1.0 + dist * dist / (0.03 * 0.03)) * facing;
    col += (metal ? base * 1.4 + 0.1 : vec3(0.35) + base) * uSpill.rgb * sp;
  }
  // the street's wet neon from below (down-facing surfaces)
  col += base * uEnvLo * 0.35 * max(-n.y, 0.0) * (1.0 - uSutra);
  // ruled lines on built procedural faces
  float lines = 0.0;
  if (vMat.z > 0.0) {
    vec2 ff = max(fwidth(vFace.xy), vec2(1e-6));
    float fl = floor(vMat.w + 0.5);
    float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
    float lw = uLinePx * vMat.z;
    lines = max(lines, eU0 * lineAt(vFace.x, ff.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - vFace.x, ff.x, lw));
    lines = max(lines, eV0 * lineAt(vFace.y, ff.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - vFace.y, ff.y, lw));
  }
  vec3 lineC = mix(uInk, uGold * 1.3, uSutra);
  col = mix(col, col * vec3(0.55, 0.6, 0.85), uSutra * 0.35);
  col *= 1.0 + (texture2D(uSilk, gl_FragCoord.xy / 220.0).r - 0.5) * 0.1;
  if (ci != ${CLS.glow}) col = mix(col, lineC, clamp(max(lines, crease * 0.85), 0.0, 1.0));
  col += base * vMat.y;
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

export interface VmUniforms {
  uPal: { value: Color[] };
  uSilk: { value: Texture };
  uDecal: { value: Texture };
  uEtch: { value: Vector4 };
  uFu: { value: Vector4 };
  uKey: { value: Vector3 };
  uInk: { value: Color };
  uLinePx: { value: number };
  uSutra: { value: number };
  uGold: { value: Color };
  uEnvHi: { value: Color };
  uEnvLo: { value: Color };
  uBladeA: { value: Vector3 };
  uBladeB: { value: Vector3 };
  uSpill: { value: Vector4 };
  uTune: { value: Vector4 };
  uExposure: { value: number };
  uDetail: { value: number };
  uRes: { value: Vector2 };
  uHullPx: { value: number };
  uTime: { value: number };
}

export function vmUniforms(silk: Texture, decals: Decals): VmUniforms {
  const pal: Color[] = [];
  for (let i = 0; i < NPAL; i++) pal.push(new Color(PALETTE[i] ?? 0x808080));
  return {
    uPal: { value: pal },
    uSilk: { value: silk },
    uDecal: { value: decals.tex },
    uEtch: { value: decals.etch },
    uFu: { value: decals.fu },
    uKey: { value: new Vector3(-0.55, 0.8, 0.22).normalize() },
    uInk: { value: new Color(0x111214) },
    uLinePx: { value: 1.6 },
    uSutra: { value: 0 },
    uGold: { value: new Color(0xc9a24a) },
    uEnvHi: { value: new Color(0x8fa4c4) },
    uEnvLo: { value: new Color(0xb0584e) },
    uBladeA: { value: new Vector3() },
    uBladeB: { value: new Vector3(0, 0, -1) },
    uSpill: { value: new Vector4(0.55, 0.95, 1.0, 0.9) },
    uTune: { value: new Vector4(0.8, 1.0, 0.85, 0.22) },
    uExposure: { value: 1 },
    uDetail: { value: 1.8 },
    uRes: { value: new Vector2(1, 1) },
    uHullPx: { value: 2.6 },
    uTime: { value: 0 },
  };
}

const BLACK = new DataTexture(new Uint8Array([255, 128, 128, 255]), 1, 1);
BLACK.needsUpdate = true;

/** the program; `maps` / `nrm` given = a textured asset (its own material instance sharing every other uniform) */
export function vmMaterial(u: VmUniforms, maps: Texture | null = null, nrm: Texture | null = null): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uPal: u.uPal, uSilk: u.uSilk, uDecal: u.uDecal, uEtch: u.uEtch, uFu: u.uFu, uKey: u.uKey, uInk: u.uInk, uLinePx: u.uLinePx,
      uSutra: u.uSutra, uGold: u.uGold, uEnvHi: u.uEnvHi, uEnvLo: u.uEnvLo, uBladeA: u.uBladeA, uBladeB: u.uBladeB, uSpill: u.uSpill,
      uTune: u.uTune, uExposure: u.uExposure, uDetail: u.uDetail,
      uMapsTex: { value: maps ?? BLACK }, uNrmTex: { value: nrm ?? BLACK }, uTexOn: { value: maps === null ? 0 : 1 },
    },
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
  });
}

const VS_HULL = /* glsl */ `
attribute vec3 aHullN;
attribute vec4 aMat;
uniform vec2 uRes;
uniform float uHullPx;
uniform float uHullK;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
void main() {
  int ci = int(floor(aMat.x + 0.5));
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 nv = normalize(normalMatrix * aHullN);
  vec2 dir = normalize(nv.xy + 1e-5);
  bool built = ci == ${CLS.brass} || ci == ${CLS.brassDark} || ci == ${CLS.steel} || ci == ${CLS.lacquer} || ci == ${CLS.bevel} || ci == ${CLS.gold} || ci == ${CLS.carbon};
  float s = dot(position, vec3(311.0, 473.0, 231.0));
  float brush = built ? 1.0 : 0.5 + 1.2 * vn1(s);
  float w = uHullPx * uHullK * brush * (built ? 1.0 : 1.35);
  if (ci == ${CLS.glow} || ci == ${CLS.bevel}) w = 0.0;
  clip.xy += dir * w * 2.0 / uRes * clip.w;
  clip.z += 0.0004 * clip.w;
  gl_Position = clip;
}
`;
const FS_HULL = /* glsl */ `
uniform vec3 uInk;
uniform float uSutra;
uniform vec3 uGold;
void main() { gl_FragColor = vec4(mix(uInk, uGold * 1.3, uSutra), 1.0); }
`;

/** the ink hull; `k` scales the width for one group (a fine part such as the tassel wants a thinner line) */
export function inkHullMaterial(u: VmUniforms, k = 1): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRes: u.uRes, uHullPx: u.uHullPx, uInk: u.uInk, uSutra: u.uSutra, uGold: u.uGold, uHullK: { value: k } },
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
