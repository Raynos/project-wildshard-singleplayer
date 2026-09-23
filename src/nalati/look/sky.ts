/**
 * Look v2 — the sky dome (port-v2.md step 1; the user's rule 2: painted imagery only at true infinity, ONE seamless 360°
 * panorama, no plates, no seams, no visible transition anywhere — up, down, or while turning).
 *
 * A full sphere round the camera (BackSide, no depth write, at the far plane so it never covers anything) carrying the
 * round-6 panorama (`public/assets/nalati/panorama(.phone).webp`, made by scripts/nalati-panorama.py, which also repairs
 * the slice seams and writes the horizon / ridge / fog data in panoramaData.ts):
 *
 *   u = compass azimuth `atan(-d.x, d.z)` (0 = north = +z, 0.25 = east = −x — the PaintedBackdrop convention), sampled
 *       with textureGrad on whichever azimuth branch is continuous, so the u = 0 / 1 wrap has no mip seam;
 *   v = the painted horizon row at elevation `uElShift`, linear in elevation at the strip's own 15.36 px / degree;
 *   up:   from +30° the painting eases into its own top rows blurred per azimuth (textureLod), and those converge on one
 *         zenith colour straight up — a 20° + 40° band, colour-matched, so there is no line anywhere;
 *   down: under the painted land (−16°) it fades into the fog LUT colour — the same colour the 3D fog uses.
 *
 * The painting displays as painted: the colour is taken back through the grade's inverse (grade.ts) and re-tinted by
 * the hour / weather (tint.ts, shared with the fog). The painted sun (250°, 26°) dims as the clock moves the real sun
 * away from it. At night the painted SKY (above the ridge line) fades out and the day/night rig's dome — stars, moon glow
 * — shows through; the painted ranges stay, dark and moonlit.
 */
import * as THREE from 'three';
import { fetchImage } from '../../boot/bytes';
import { nalatiUrl } from '../../world/nalatiTextures';
import { V2_GRADE_GLSL, gradeUniforms } from './grade';
import { V2_TINT_GLSL, tintUniforms } from './tint';
import { PANO_HORIZON_V, PANO_DEG_PER_V, PANO_RIDGE_V } from './panoramaData';

/** inside the camera's far plane (2600) with room; the vertex shader puts it at the far plane anyway */
const R = 2300;
const D2R = Math.PI / 180;
/** the painted sun (compass 250°, 26° up — the def's own sun, README of round-6) */
const PAINTED_SUN = new THREE.Vector3(-Math.sin(250 * D2R) * Math.cos(26 * D2R), Math.sin(26 * D2R), Math.cos(250 * D2R) * Math.cos(26 * D2R));

const VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
  }`;

const FRAG = /* glsl */`
  ${V2_GRADE_GLSL}
  ${V2_TINT_GLSL}
  uniform sampler2D tPano;
  uniform sampler2D tRidge;
  uniform sampler2D tFogLut;
  uniform float uHorizonV;
  uniform float uVPerDeg;
  uniform float uElShift;
  uniform vec3 uZenith;
  uniform vec3 uSunNow;
  uniform vec3 uSunPainted;
  uniform float uNight;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
    float az = atan(-d.x, d.z) * 0.15915494;                 // compass turns
    float v = uHorizonV + (el - uElShift) * uVPerDeg;
    // the u seam at north: the derivatives of whichever azimuth branch is continuous here
    float azB = fract(az + 0.5) - 0.5;
    vec2 gA = vec2(dFdx(az), dFdy(az)), gB = vec2(dFdx(azB), dFdy(azB));
    vec2 g = dot(gA, gA) < dot(gB, gB) ? gA : gB;
    float u = fract(az);
    vec2 dv = vec2(dFdx(el), dFdy(el)) * uVPerDeg;
    vec3 c = textureGrad(tPano, vec2(u, clamp(v, 0.002, 0.998)), vec2(g.x, dv.x), vec2(g.y, dv.y)).rgb;
    // up: into the strip's own top rows, blurred per azimuth, then one zenith colour
    float elTop = (1.0 - uHorizonV) / uVPerDeg + uElShift;     // where the painting ends (~ +52°)
    vec3 top = textureLod(tPano, vec2(u, 0.985), 9.0).rgb;
    c = mix(c, top, smoothstep(elTop - 22.0, elTop - 1.0, el));
    c = mix(c, uZenith, smoothstep(elTop - 10.0, 80.0, el));
    c = v2Ungrade(c);
    // down: under the painted land, the fog colour (the same LUT the 3D fog reads)
    float elBot = -uHorizonV / uVPerDeg + uElShift;
    vec3 fogC = texture2D(tFogLut, vec2(az, 0.5)).rgb;
    c = mix(c, fogC, smoothstep(elBot + 7.0, elBot + 0.5, el));
    // the painted sun dims as the clock moves the real one away from it
    float away = smoothstep(0.9986, 0.975, dot(uSunNow, uSunPainted));
    float disc = smoothstep(0.975, 0.997, dot(d, uSunPainted));
    c *= 1.0 - 0.6 * disc * away;
    c = v2Regrade(c);
    // night: the painted sky above the ridge line fades out, the rig's star dome shows through
    float ridge = texture2D(tRidge, vec2(az, 0.5)).r;
    float sky = smoothstep(ridge - 0.004, ridge + 0.03, v);
    gl_FragColor = vec4(c, 1.0 - uNight * sky);
  }`;

/** the ridge line + fog LUT as tiny textures (RepeatWrapping on u: the azimuth wraps) */
function ridgeTexture(): THREE.DataTexture {
  const n = PANO_RIDGE_V.length;
  const data = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) { const h = THREE.DataUtils.toHalfFloat(PANO_RIDGE_V[i] ?? 0.5); data[i * 4] = h; data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1); }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export class SkyDomeV2 {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    tPano: { value: THREE.Texture }; tRidge: { value: THREE.Texture }; tFogLut: { value: THREE.Texture };
    uHorizonV: { value: number }; uVPerDeg: { value: number }; uElShift: { value: number };
    uZenith: { value: THREE.Color }; uSunNow: { value: THREE.Vector3 }; uSunPainted: { value: THREE.Vector3 }; uNight: { value: number };
  };

  private constructor(tex: THREE.Texture, fogLut: THREE.Texture, zenith: THREE.Color) {
    this.uniforms = {
      tPano: { value: tex }, tRidge: { value: ridgeTexture() }, tFogLut: { value: fogLut },
      uHorizonV: { value: PANO_HORIZON_V }, uVPerDeg: { value: 1 / PANO_DEG_PER_V }, uElShift: { value: 0 },
      uZenith: { value: zenith }, uSunNow: { value: PAINTED_SUN.clone() }, uSunPainted: { value: PAINTED_SUN.clone() }, uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, ...gradeUniforms, ...tintUniforms },
      vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    });
    mat.name = 'sky-dome-v2';
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), mat);
    this.mesh.name = 'sky-dome-v2';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -90; // first of the transparents; after the rig's star dome (−100), which it covers by day
    if (typeof window !== 'undefined') Object.assign(window, { __skyV2: this.uniforms });
  }

  /** fetch the tier's strip and build the dome (null when the file is missing) */
  static async load(renderer: THREE.WebGLRenderer, fogLut: THREE.Texture): Promise<SkyDomeV2 | null> {
    let image: ImageBitmap | HTMLImageElement;
    try { image = await fetchImage(nalatiUrl('panorama'), Infinity, true); } catch { return null; }
    const tex = new THREE.Texture(image);
    tex.flipY = !(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap); // bitmaps are flipped at decode
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.name = 'nalati-panorama';
    tex.needsUpdate = true;
    // the zenith: the strip's top rows averaged all the way round (linear), for the pole every azimuth converges on
    const zenith = new THREE.Color(0.1, 0.25, 0.62);
    try {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 12;
      const g = cv.getContext('2d', { willReadFrequently: true });
      if (g) {
        g.drawImage(image, 0, 0, 64, 12);
        // the painting's top two rows (a bitmap was flipped at decode: its top is the canvas's bottom)
        const flipped = typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;
        const rows = g.getImageData(0, flipped ? 10 : 0, 64, 2).data;
        let r = 0, gg = 0, b = 0;
        for (let i = 0; i < rows.length; i += 4) { r += rows[i] ?? 0; gg += rows[i + 1] ?? 0; b += rows[i + 2] ?? 0; }
        const n = rows.length / 4;
        zenith.setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
      }
    } catch { /* keep the default */ }
    return new SkyDomeV2(tex, fogLut, zenith);
  }
}
