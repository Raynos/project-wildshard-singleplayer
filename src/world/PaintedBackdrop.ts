/**
 * The painted 360° matte backdrop (Nalati look pass — painted-asset agent): the real Nalati round the horizon as one
 * hand-painted panorama (codex image gen in the style of art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png,
 * eight 45° panels stitched and seam-blended into one strip), so the far distance carries the same painted
 * high-frequency detail as the mockups instead of flat procedural colour:
 *
 *   S        the jagged snow-laden Nalati / Tian Shan range, blue-shadowed faces, glaciers, layered in aerial haze
 *   SE / SW  the Sky Grassland rolling away as gold-green hills under the range
 *   W        the valley opening flat toward the Ili, the braided river dissolving in warm haze (the sunset side)
 *   N        across the valley, the brown-green Avral range with spruce streaks
 *   E        the gorge, the thread of the Duku switchbacks
 *   (docs/design/nalati/geography-and-map.md §3 "Horizon ring")
 *
 *   const bd = await PaintedBackdrop.load();          // null when the file is missing / the GPU cannot hold it
 *   sky.clouds.add(bd.mesh);                          // centred on the camera by Game.ts, like the clouds
 *   bd.update(weather.look, w.overcast, w.rain, w.flash);   // every frame (or when the look changes)
 *
 * The file (public/assets/nalati/backdrop.webp, 8192 px wide = 360°, phone `.phone.webp` at half) is a sky-transparent
 * strip: u = compass azimuth (0 = north = +Z, 0.25 = east = −X, the Horizon / DayNight convention), v = elevation
 * EL_LO … EL_HI. One sphere band (one draw call, one texture fetch per pixel) at BACKDROP_R: in front of the painterly
 * cumulus bank (2520) and PainterlyRange (2485, which it replaces — the wiring hides it), behind the geometric horizon
 * rings (800 / 1500 / 2450), which stay the near / mid ridges and occlude the painting's lower edge.
 *
 * Live light (the painting carries its own late-afternoon light; this only re-grades it): × the key light's colour
 * relative to the painted key (dusk goes rose, noon neutral), toward a blue monochrome under the moon, × the sky rig's
 * cloud light (night and a storm's gloom), then into the live fog colour — more at the feet (valley haze) and with
 * overcast / rain (a storm swallows the range), + the lightning flash. Transparent, fogless, no depth write.
 */
import * as THREE from 'three';
import { fetchImage } from '../boot/bytes';
import { nalatiUrl, isPhoneTier } from './nalatiTextures';
import type { SkyLook } from './DayNight';

export const BACKDROP_R = 2470;
/**
 * Elevation mapping. The strip is 8192 × 564 (22.8 px per degree of azimuth); the flat western horizon sits on row 171
 * from the top (v = BACKDROP_V_HORIZON) and the highest peak on row 32. Two linear segments meet at the horizon: the
 * land below it (the far valley seen from above, mostly hidden by the near horizon rings) is squeezed into EL_LO … 0°,
 * the ranges above it are stretched to 0° … EL_HI, so the Nalati range towers ~13° over the horizon as in the mockups
 * (the painting itself sees it from higher and farther). Live: `__backdrop.uElHi.value = 14 * Math.PI / 180`.
 */
export const BACKDROP_EL_LO = -20;
export const BACKDROP_EL_HI = 15;
export const BACKDROP_V_HORIZON = 1 - 171 / 564;

/** the key the painting was painted under (the def's late-afternoon sun); the live key is taken relative to it */
const PAINTED_KEY = new THREE.Color(1.0, 0.85, 0.64);
const WHITE = new THREE.Color(1, 1, 1);

const FRAG = /* glsl */`
  uniform sampler2D tPaint;
  uniform vec3 uHaze; uniform vec3 uLight; uniform vec3 uKeyTint;
  uniform float uMoon; uniform float uHazeBase; uniform float uFeet; uniform float uVeil; uniform float uFlash;
  uniform float uElLo; uniform float uElMid; uniform float uElHi; uniform float uVMid;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float el = asin(clamp(d.y, -1.0, 1.0));
    float az = atan(-d.x, d.z) * 0.15915494;               // compass turns: 0 north, 0.25 east
    // two linear segments meeting at the painted horizon (uElMid ↔ uVMid)
    float up = step(uElMid, el);
    float gv = mix(uVMid / (uElMid - uElLo), (1.0 - uVMid) / (uElHi - uElMid), up);   // dv / d(el)
    vec2 uv = vec2(fract(az), mix(uVMid - (uElMid - el) * gv, uVMid + (el - uElMid) * gv, up));
    // the u seam at north: take the derivatives of whichever of the two azimuth branches is continuous here
    float azB = fract(az + 0.5) - 0.5;
    vec2 gA = vec2(dFdx(az), dFdy(az)), gB = vec2(dFdx(azB), dFdy(azB));
    vec2 g = dot(gA, gA) < dot(gB, gB) ? gA : gB;
    vec4 t = textureGrad(tPaint, uv, vec2(g.x, dFdx(el) * gv), vec2(g.y, dFdy(el) * gv));
    if (t.a < 0.004) discard;
    vec3 c = t.rgb * uKeyTint;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, l * vec3(0.5, 0.62, 1.0), uMoon * 0.8);    // moonlight: a cool blue monochrome
    c *= uLight;
    float feet = 1.0 - smoothstep(-0.03, 0.06, el);        // the valley haze the ranges stand in
    c = mix(c, uHaze, clamp(uHazeBase + feet * uFeet + uVeil, 0.0, 1.0));
    c += uFlash * l * vec3(0.8, 0.85, 1.0);
    gl_FragColor = vec4(c, t.a);
  }`;

export class PaintedBackdrop {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    tPaint: { value: null as THREE.Texture | null },
    uHaze: { value: new THREE.Color(0.62, 0.72, 0.86) },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uKeyTint: { value: new THREE.Color(1, 1, 1) },
    uMoon: { value: 0 },
    /** always-on mix into the live fog colour (the painting already carries its own aerial perspective) */
    uHazeBase: { value: 0.1 },
    /** extra haze at the ranges' feet */
    uFeet: { value: 0.22 },
    /** a storm's veil: overcast / rain swallow the range */
    uVeil: { value: 0 },
    uFlash: { value: 0 },
    uElLo: { value: BACKDROP_EL_LO * THREE.MathUtils.DEG2RAD },
    uElMid: { value: 0 },
    uElHi: { value: BACKDROP_EL_HI * THREE.MathUtils.DEG2RAD },
    uVMid: { value: BACKDROP_V_HORIZON },
  };

  private constructor(tex: THREE.Texture) {
    this.uniforms.tPaint.value = tex;
    const d2r = THREE.MathUtils.DEG2RAD;
    const geo = new THREE.SphereGeometry(BACKDROP_R, 96, 6, 0, Math.PI * 2, (90 - BACKDROP_EL_HI) * d2r, (BACKDROP_EL_HI - BACKDROP_EL_LO) * d2r);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FRAG,
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    });
    mat.name = 'painted-backdrop';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'painted-backdrop';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -8; // after the planet (−12 / −11), the cloud dome (−10) and the cumulus bank (−9): they are behind it
    // live tuning: `__backdrop.uElHi.value = 14 * Math.PI / 180` (the geometry spans EL_LO … EL_HI: raise those to go past), `__backdrop.uHazeBase.value = 0.1`
    if (typeof window !== 'undefined') Object.assign(window, { __backdrop: this.uniforms });
  }

  /** Fetch the tier's strip and build the band; null when the file is missing or wider than the GPU's texture limit. */
  static async load(renderer: THREE.WebGLRenderer): Promise<PaintedBackdrop | null> {
    let url = nalatiUrl('backdrop');
    // a desktop GPU that cannot hold 8192 px takes the phone strip (4096)
    if (!isPhoneTier() && renderer.capabilities.maxTextureSize < 8192) url = url.replace(/\.webp$/, '.phone.webp');
    let image: ImageBitmap | HTMLImageElement;
    try { image = await fetchImage(url, Infinity, true); } catch { return null; }
    const tex = new THREE.Texture(image);
    tex.flipY = !(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap); // bitmaps are flipped at decode
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.name = 'nalati-backdrop';
    tex.needsUpdate = true;
    return new PaintedBackdrop(tex);
  }

  /**
   * Re-grade the painting to the live sky: `look` = the sky rig's look this frame (DayNight SkyLook: the key light, the
   * moon, the fog colour, the cloud light), `overcast` / `rain` 0..1 (Weather) veil it, `flash` 0..1 (lightning) lifts it.
   * No allocation.
   */
  update(look: SkyLook, overcast = 0, rain = 0, flash = 0): void {
    const u = this.uniforms;
    const k = look.keyColor, m = look.moon;
    // the live key relative to the painted one, half strength, normalised so it tints without dimming (uLight dims)
    const r = k.r / PAINTED_KEY.r, g = k.g / PAINTED_KEY.g, b = k.b / PAINTED_KEY.b;
    const mx = Math.max(r, g, b, 1e-3);
    u.uKeyTint.value.setRGB(0.5 + 0.5 * (r / mx), 0.5 + 0.5 * (g / mx), 0.5 + 0.5 * (b / mx));
    if (m > 0) u.uKeyTint.value.lerp(WHITE, m);
    u.uMoon.value = m;
    u.uLight.value.copy(look.cloudLight);
    u.uHaze.value.copy(look.fogColor);
    u.uVeil.value = Math.min(0.85, overcast * 0.45 + rain * 0.4);
    u.uFlash.value = flash;
  }
}

