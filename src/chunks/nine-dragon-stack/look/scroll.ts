// Copied from the organic lab (src/dev/nd-lab/organic/scroll.ts, round-9-lab-organic: the sky scroll only) into the clean room.
// Lab P7 "organic" (E169): the LED sky screens show a real 青绿山水 handscroll. The clean room paints procedural
// ridges; the targets show a detailed 千里江山图 (azurite crests, malachite bodies, ochre feet, scalloped cloud bands,
// dotted pines) behind a visible LED grid. The painting is three codex image_gen panels joined into one seamless
// 3348×1024 scroll (image-quilting min-error seams; scratch `panorama2.py`, 850 KB WebP). It pans slowly west → east,
// and every LED shows ONE colour: the scroll is sampled at the dot's centre at the mip of the dot's footprint.
// Seen from below a ceiling, "up" in the eye is toward the viewer: the painting's sky sits at the screen's near
// (south) edge. The targets' visible "pixels" are LED MODULES: fine 0.06 m dots (they fade to their average below a
// few px, so no moiré), a 1.2 m module seam grid, the 8 m steel frame; a faint row scan, a rolling refresh band, a few
// dead diodes, and the bright clouds pushed over the bloom threshold (the post's Karis prefilter at 1.0 picks them up).
import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, ShaderMaterial, type Texture, TextureLoader, Vector2, Vector4 } from 'three';
import { FOG_GLSL, NOISE_GLSL, type Shared } from './style';

const VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS = /* glsl */ `
uniform float uTime;
uniform float uSutra;
uniform float uNear;
uniform float uLinePx;
uniform sampler2D uScroll;
uniform vec2 uSize;      // the screen, metres (u across, v along)
uniform vec2 uTexSize;   // the scroll, texels
uniform float uPitch;    // LED pitch, metres
uniform vec4 uPan;       // x: metres per painting height, y: pan speed (m/s), z: start offset (m), w: painting v at uv.y = 0
uniform vec4 uLed;       // x: dot fill (share of the pitch), y: gap brightness, z: scan strength, w: bloom gain
uniform vec4 uGrade;     // x: brightness, y: saturation, z: bloom threshold (luminance), w: fog scale
uniform vec2 uModule;    // x: LED module tile (m), y: its seam darkness
varying vec2 vUv;
varying vec3 vWorld;
varying float vViewZ;
${NOISE_GLSL}
${FOG_GLSL}
void main() {
  vec2 m = vUv * uSize;
  vec2 g = m / uPitch;
  vec2 cell = floor(g);
  vec2 fw = max(fwidth(g), vec2(1e-5));
  float cellPx = 1.0 / max(fw.x, fw.y);                 // how many screen pixels one LED spans
  // the painting in scroll texels: its height spans uPan.x metres of the screen; it pans along u and wraps
  float tpm = uTexSize.y / uPan.x;                       // texels per metre
  float along = uTime * uPan.y + uPan.z;
  vec2 P = (cell + 0.5) * uPitch;                        // the LED's centre, metres
  // v: seen from below a ceiling, "up" in the eye is TOWARD the viewer, so the painting's sky sits at the screen's
  // near (south, uv.y = 1) edge and its water runs away north: the peaks then point up in every view from the square
  vec2 tuvLed = vec2((P.x + along) * tpm / uTexSize.x, uPan.w + P.y / uPan.x);
  vec2 tuvPix = vec2((m.x + along) * tpm / uTexSize.x, uPan.w + m.y / uPan.x);
  float lod = log2(max(uPitch * tpm, 1.0));
  vec3 led = textureLod(uScroll, vec2(tuvLed.x, clamp(tuvLed.y, 0.015, 0.985)), lod).rgb;
  vec3 smoothC = texture(uScroll, vec2(tuvPix.x, clamp(tuvPix.y, 0.015, 0.985))).rgb;
  // past the painting's edges the screen keeps going: its sky (the top rows' average) toward the viewer, its misty
  // water (the bottom rows' average) away north
  vec3 skyAvg = textureLod(uScroll, vec2(tuvLed.x, 0.95), 7.0).rgb;
  vec3 lowAvg = textureLod(uScroll, vec2(tuvLed.x, 0.06), 7.0).rgb;
  float pastTop = smoothstep(0.96, 1.12, tuvLed.y), pastLow = 1.0 - smoothstep(-0.12, 0.04, tuvLed.y);
  led = mix(mix(led, skyAvg, pastTop), lowAvg, pastLow);
  smoothC = mix(mix(smoothC, skyAvg, pastTop), lowAvg, pastLow);
  // below ~1.5 px an LED, show the painting's filtered average (the dots are too small to count)
  float tiny = 1.0 - smoothstep(1.0, 2.2, cellPx);
  vec3 c = mix(led, smoothC, tiny);
  float l0 = lum(c);
  c = mix(vec3(l0), c, uGrade.y) * uGrade.x * vec3(0.95, 1.0, 1.05);   // a touch of the diodes' cool cast
  // the diode grid: square dots, dark gaps; box-filtered, fading to its average as the dots shrink
  vec2 f = g - cell;
  float lo = 0.5 - uLed.x * 0.5, hi = 0.5 + uLed.x * 0.5;
  float dotm = cover1(f.x, lo, hi, fw.x) * cover1(f.y, lo, hi, fw.y);
  float avg = uLed.x * uLed.x;
  float show = smoothstep(2.5, 5.0, cellPx);
  float grid = mix(mix(uLed.y, 1.0, avg), mix(uLed.y, 1.0, dotm), show);
  // row scan: every other diode row a touch dimmer, and a slow rolling refresh band
  float row = 1.0 - uLed.z * 0.5 * step(0.5, fract(cell.y * 0.5)) * show;
  float band = 1.0 + uLed.z * (1.0 - smoothstep(0.0, 0.04, abs(fract(vUv.y * 0.8 - uTime * 0.05) - 0.5)));
  float dead = step(0.9985, h12(cell + 17.0));
  c *= grid * row * band * (1.0 - dead * 0.7);
  // the bright clouds and mist burn past the bloom threshold: a soft LED glow in the post
  c *= 1.0 + uLed.w * smoothstep(uGrade.z, uGrade.z + 0.2, l0);
  // the LED module tiles (a fine dark grid, the targets' visible "pixels") and the steel panel frame every 8 m; both
  // fade with distance like every ruling
  vec2 fm = max(fwidth(m), vec2(1e-5));
  // (round 14, dome C2: seen from the stair-street the far screen read as a flat green grid) the module grid and the
  // panel frame dissolve by 90 m, not 200
  float far = 1.0 - smoothstep(30.0, 90.0, length(vWorld - uCam));
  vec2 tile = abs(fract(m / uModule.x + 0.5) - 0.5) * uModule.x;
  float tiles = max(lineAt(tile.x, fm.x, uLinePx * 0.55), lineAt(tile.y, fm.y, uLinePx * 0.55)) * uModule.y * far;
  c *= 1.0 - tiles;
  vec2 panel = abs(fract(m / 8.0 + 0.5) - 0.5) * 8.0;
  float seam = max(lineAt(panel.x, fm.x, uLinePx * 1.2), lineAt(panel.y, fm.y, uLinePx * 1.2)) * far;
  c = mix(c, c * vec3(0.55, 0.62, 0.95) * 0.75, uSutra);
  c = mix(c, vec3(0.05, 0.06, 0.08), seam * 0.7);
  vec4 fg = silkFog(vWorld, uGrade.w);
  gl_FragColor = vec4(c * sqrt(max(fg.a, 1e-4)) + fg.rgb, uNear / max(vViewZ, uNear));
}
`;

export interface ScrollOpt {
  /** LED pitch (m) */
  pitch: number;
  /** metres of screen per painting height (the painting's vertical span) */
  span: number;
  /** pan speed (m/s along the screen's u) and start offset (m) */
  speed: number;
  offset: number;
  /** the painting's height (0 = its bottom, the water; 1 = its top, the sky) shown at the screen's NEAR (south) edge;
   *  from there the painting runs down toward the north. From the square only the nearest ~25 m of the screen show
   *  between the decks, so sky / peaks / hills must fall there (the targets) */
  near: number;
  led: Vector4;
  grade: Vector4;
  /** the LED module tiles: size (m), seam darkness */
  module: [number, number];
}
export const SCROLL: ScrollOpt = {
  pitch: 0.06, span: 32, speed: 0.35, offset: 0, near: 0.74,
  led: new Vector4(0.8, 0.5, 0.08, 0.9),
  // (round 14) fog scale 0.22 → 0.45: the screens sit 30–90 m up in the rain; the far rows take the silk like the towers
  grade: new Vector4(1.15, 1.1, 0.62, 0.45),
  module: [1.2, 0.35],
};

export function loadScroll(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url).then((t) => {
    t.colorSpace = SRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  });
}

/** the knobs of one screen's program (typed handles, so a tuning write never goes through `any`) */
export interface ScrollKnobs { pitch: { value: number }; pan: Vector4; led: Vector4; grade: Vector4; module: Vector2; h: number; near: number }

/** the LED sky-screen program: `w` × `h` metres (the PlaneGeometry's size), the scroll texture, the options */
export function scrollMaterial(shared: Shared, tex: Texture, w: number, h: number, o: ScrollOpt = SCROLL): { mat: ShaderMaterial; knobs: ScrollKnobs } {
  const img = tex.image as { width?: number; height?: number } | null;
  const tw = img?.width ?? 3348, th = img?.height ?? 1024;
  const knobs: ScrollKnobs = {
    pitch: { value: o.pitch }, pan: new Vector4(o.span, o.speed, o.offset, o.near - h / o.span), led: o.led.clone(), grade: o.grade.clone(), module: new Vector2(...o.module), h, near: o.near,
  };
  const mat = new ShaderMaterial({
    uniforms: {
      ...shared.u,
      uScroll: { value: tex },
      uSize: { value: new Vector2(w, h) },
      uTexSize: { value: new Vector2(tw, th) },
      uPitch: knobs.pitch,
      uPan: { value: knobs.pan },
      uLed: { value: knobs.led },
      uGrade: { value: knobs.grade },
      uModule: { value: knobs.module },
    },
    vertexShader: VS, fragmentShader: FS,
  });
  return { mat, knobs };
}
