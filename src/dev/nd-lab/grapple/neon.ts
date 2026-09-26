// Lab P9 "grapple" (E169): neon calligraphy for the demo's Well — hand-bent tube glyphs on a dark sign box. Each sign's
// glyphs are drawn once into a canvas as TUBES (a soft coloured stroke with a halo, then a white-hot core stroke), and
// shown on a quad in front of a ruled ink box. HDR ×uI, fogged at half strength (neon glows through the silk), so the
// bloom soaks the halo into the silk. The Well's one "hookable" landmark, the jade 旅館 blade sign, sits beside the hook
// the way comp-B paints it.
import { CanvasTexture, Color, DoubleSide, LinearMipmapLinearFilter, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Uniforms } from './world/material';

const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';

export async function fontsReady(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load(`700 120px ${KAI}`, '旅館麵牙科火鍋茶藥房九龍麻雀按摩'),
      new Promise((resolve) => { setTimeout(resolve, 4000); }),
    ]);
  } catch {
    // fall back to whatever serif the page has
  }
}

function glyphTexture(text: string, vertical: boolean, color: string): { tex: CanvasTexture; aspect: number } {
  const cell = 256;
  const n = Array.from(text).length;
  const W = vertical ? cell : cell * n, H = vertical ? cell * n : cell;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(cell * 0.78)}px ${KAI}`;
  g.lineJoin = 'round';
  const chars = Array.from(text);
  const at = (i: number): [number, number] => (vertical ? [W / 2, cell * (i + 0.5)] : [cell * (i + 0.5), H / 2]);
  // the tube's halo, the tube, the white-hot core; a thin tube frame round the box
  for (const [lw, blur, col] of [[16, 30, color], [9, 8, color], [3.2, 0, '#ffffff']] as const) {
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.shadowColor = col;
    g.shadowBlur = blur;
    chars.forEach((c, i) => { const [x, y] = at(i); g.strokeText(c, x, y); });
    g.lineWidth = lw * 0.5;
    g.beginPath();
    g.roundRect(14, 14, W - 28, H - 28, 18);
    g.stroke();
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, aspect: W / H };
}

const VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const FS = /* glsl */ `
uniform sampler2D uTex;
uniform float uI;
uniform vec3 uBack;
uniform vec3 uCam;
uniform float uFogDensity;
uniform vec4 uFogBand;
uniform vec3 uFogCol;
uniform vec3 uFogLow;
varying vec2 vUv;
varying vec3 vW;
vec4 silkFog(vec3 wp) {
  vec3 d = wp - uCam;
  float L = length(d);
  float dy = d.y;
  float H = uFogBand.y;
  float e0 = exp(-(uCam.y - uFogBand.x) / H), e1 = exp(-(wp.y - uFogBand.x) / H);
  float band = abs(dy) > 0.05 ? H * abs(e1 - e0) / abs(dy) : exp(-(0.5 * (uCam.y + wp.y) - uFogBand.x) / H);
  float tauB = uFogBand.z * min(band, 60.0) * L;
  float T = exp(-(uFogDensity * L + tauB));
  vec3 fc = mix(uFogCol, uFogLow, clamp(tauB / max(uFogDensity * L + tauB, 1e-4), 0.0, 1.0));
  return vec4(fc * (1.0 - T), T);
}
void main() {
  vec3 t = texture2D(uTex, vUv).rgb;
  vec4 fg = silkFog(vW);
  // neon is fogged at half strength: it glows through the silk
  float Tn = sqrt(fg.a);
  gl_FragColor = vec4(uBack * fg.a + fg.rgb + t * uI * Tn, fg.a);
}
`;

export interface NeonSign { mesh: Mesh; light: Vector3; color: Color }

/** a neon sign facing `normal`, centred at `at`; `h` = the glyph column / row height (m) */
export function neonSign(text: string, vertical: boolean, hex: number, at: Vector3, normal: Vector3, h: number, shared: Uniforms, intensity = 3.2): NeonSign {
  const col = new Color(hex);
  const { tex, aspect } = glyphTexture(text, vertical, `#${col.getHexString()}`);
  const w = vertical ? h * aspect : h;
  const hh = vertical ? h : h / aspect;
  const geo = new PlaneGeometry(vertical ? w : h, vertical ? hh : hh);
  const m = new ShaderMaterial({
    uniforms: {
      uTex: { value: tex }, uI: { value: intensity }, uBack: { value: new Color(0x0c0d10) },
      uCam: shared['uCam'] ?? { value: new Vector3() }, uFogDensity: shared['uFogDensity'] ?? { value: 0 },
      uFogBand: shared['uFogBand'] ?? { value: null }, uFogCol: shared['uFogCol'] ?? { value: new Color() },
      uFogLow: shared['uFogLow'] ?? { value: new Color() },
    },
    vertexShader: VS, fragmentShader: FS, side: DoubleSide,
  });
  const mesh = new Mesh(geo, m);
  mesh.position.copy(at);
  mesh.lookAt(at.clone().add(normal));
  return { mesh, light: at.clone().addScaledVector(normal, 0.6), color: col.clone().multiplyScalar(intensity * 0.5) };
}
