import { ClampToEdgeWrapping, LinearFilter, RepeatWrapping, ShaderMaterial, BackSide, SRGBColorSpace, Texture } from 'three';
import { SKY_VERTEX } from './sky';
import { PAINTED_STAGES, paintedUrl, type PaintedStage } from '../boot/files';

/**
 * E407 row 5: the painted dusk sky at infinity, one seamless 360° strip per dusk stage (art/sunscar-dunes/round-25-sky:
 * pano.py outpaints them with codex image_gen from the mockups' skies, prep.py crops and sizes them). x = heading (0 =
 * the spawn's forward view, -z; 90 = +x), the strip spans ELEV_TOP down to ELEV_BOTTOM degrees; above it the top row
 * carries on, darkening a little to the zenith. The dome blends the stages by the dusk (look/dusk.ts duskOf: Sefa 0.50,
 * the waymarks 0.62 / 0.74 / 0.86), so the sky deepens with the quest as the procedural dome did.
 */
// round 18: two stages. Sampled at the five mock cameras, the late painting fits every mockup's sky bands best (the first
// early and mid paintings painted the afterglow too tall); early is the late painting re-coloured twenty minutes earlier
// (art/sunscar-dunes/round-25-sky early_fix.py). Early up to Sefa's dusk, late from just past the logbook's (B prefers it).
export const PAINTED = { dusk: [0.5, 0.54] as const, elevTop: 45, elevBottom: -8 } as const;

/** A painted strip as an sRGB texture, decoded off the main thread; null when it cannot be had (offline, a test page). */
async function loadStrip(stage: PaintedStage): Promise<Texture | null> {
  try {
    const response = await fetch(paintedUrl(stage));
    if (!response.ok) throw new Error(`${response.status} ${paintedUrl(stage)}`);
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
    const tex = new Texture(bitmap); tex.colorSpace = SRGBColorSpace; tex.name = `sunscar.sky.${stage}`;
    // the heading wraps (no seam at heading 0); the sky is magnified, so no mips
    tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.generateMipmaps = false;
    tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`[sunscar-dunes] painted sky ${stage} not loaded:`, error);
    return null;
  }
}

/** The painted stages, or null if any is missing (the procedural dome then stays). */
export async function loadPaintedSky(): Promise<readonly [Texture, Texture] | null> {
  const [early, late] = await Promise.all(PAINTED_STAGES.map(loadStrip));
  if (early && late) return [early, late];
  for (const t of [early, late]) t?.dispose();
  return null;
}

const SKY_PAINTED_FRAGMENT = /* glsl */ `
uniform sampler2D uEarly;
uniform sampler2D uLate;
uniform float uDusk;
varying vec3 vDir;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 strip(sampler2D t, vec2 uv) { return texture2D(t, uv).rgb; }
void main() {
  vec3 d = normalize(vDir);
  float heading = fract(atan(d.x, -d.z) / 6.2831853 + 1.0);
  float elev = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float v = clamp((elev - ${PAINTED.elevBottom.toFixed(1)}) / ${(PAINTED.elevTop - PAINTED.elevBottom).toFixed(1)}, 0.002, 0.998);
  vec2 uv = vec2(heading, v);
  // the stages by the dusk: early up to its own dusk, late past its own
  // round 18b (the lead: A's sky 1.4-1.9x the mockup's, 134 against 97 at the band, 76 against 40 at the top): the early
  // stage at 0.64
  vec3 c = mix(strip(uEarly, uv) * 0.64, strip(uLate, uv), smoothstep(${PAINTED.dusk[0].toFixed(2)}, ${PAINTED.dusk[1].toFixed(2)}, uDusk));
  // above the strip its top row carries on to the zenith, a little darker
  c *= 1.0 - 0.3 * smoothstep(${PAINTED.elevTop.toFixed(1)}, 90.0, elev);
  // crisp stars where the painted sky is dark (the mockups' stars are sharp white points; the strip is magnified ~3x)
  vec3 cellP = d * 300.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.08, 0.4, length(cellP - spot));
  float dark = 1.0 - smoothstep(0.02, 0.08, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  float star = step(0.9955, starHash(cell)) * starDot * dark * smoothstep(8.0, 20.0, elev) * smoothstep(0.45, 0.7, uDusk);
  c += vec3(0.75, 0.78, 0.85) * star * (0.5 + 0.6 * starHash(cell + 3.1));
  // dithered: a smooth dark gradient crossed one 8-bit step in a visible line
  c += (starHash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) * 0.004;
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}`;

/** The painted dome's material (the stages already linear: the strips are sRGB textures). */
export function paintedSkyMaterial(stages: readonly [Texture, Texture], dusk: { value: number }): ShaderMaterial {
  const [early, late] = stages;
  return new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uEarly: { value: early }, uLate: { value: late }, uDusk: dusk },
    vertexShader: SKY_VERTEX, fragmentShader: SKY_PAINTED_FRAGMENT });
}
