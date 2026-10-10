/**
 * Look v2 — the sky dome (port-v2.md step 1; the user's rule 2: painted imagery only at true infinity, ONE seamless 360°
 * panorama, no plates, no seams, no visible transition anywhere — up, down, or while turning).
 *
 * A full sphere round the camera (BackSide, no depth write, at the far plane so it never covers anything) carrying the
 * round-6 panorama (`public/assets/nalati/panorama(.phone).webp`, made by scripts/nalati-panorama.py, which also repairs
 * the slice seams and writes the horizon / ridge / fog data in panoramaData.ts):
 *
 *   u = compass azimuth `atan(-d.x, d.z)` (0 = north = +z, 0.25 = east = −x — the Horizon / DayNight convention), sampled
 *       with textureGrad on whichever azimuth branch is continuous, so the u = 0 / 1 wrap has no mip seam. The strip
 *       carries PANO_PAD_PX columns of the other end on either side (the lossy codec encodes an image's edge columns
 *       on their own: the bare wrap showed a 1-px seam due north, NALATI-MERGE L4), so the crisp tap reads the inner
 *       strip only, and over the pad's width either side of north every tap cross-fades into the other copy (half-and-half
 *       at north itself, so both sides of the jump read the very same texels, at every mip);
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
import type { Scope } from '@wildshard/engine/app/scope';
import * as THREE from 'three';
import { releaseOnUpload } from '@wildshard/engine/render/memorySaver';
import { fetchImage } from '@wildshard/engine/boot/bytes';
import { ktx2Texture, readTexturePixels, prepareCompressedTexture } from '@wildshard/engine/core/ktx2';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { nalatiUrl } from './nalatiTextures';
import { V2_GRADE_GLSL, gradeUniforms } from './grade';
import { V2_TINT_GLSL, tintUniforms } from './tint';
import { PANO_HORIZON_V, PANO_DEG_PER_V, PANO_RIDGE_V } from './panoramaData';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { SKY_GLSL } from '../data/skyGlsl';

/** the GLSL below is data (data/skyGlsl.ts); `@{name}` splices the fragments this module passes */
const SKY_GLSL_FAMILY = new ShaderFamily(SKY_GLSL, {});

/** inside the camera's far plane (2600) with room; the vertex shader puts it at the far plane anyway */
const R = 2300;
/** the columns of wrap each strip carries on either side (scripts/nalati-panorama.py PANO_PAD) */
const PANO_PAD_PX = 16;
const D2R = Math.PI / 180;
/** the painted sun (compass 250°, 26° up — the def's own sun, README of round-6) */
const PAINTED_SUN = new THREE.Vector3(-Math.sin(250 * D2R) * Math.cos(26 * D2R), Math.sin(26 * D2R), Math.cos(250 * D2R) * Math.cos(26 * D2R));

const VERT = SKY_GLSL_FAMILY.glsl(SKY_GLSL.VERT);

const FRAG = SKY_GLSL_FAMILY.glsl(SKY_GLSL.FRAG, { V2_GRADE_GLSL, V2_TINT_GLSL });

/** the ridge line + fog LUT as tiny textures (RepeatWrapping on u: the azimuth wraps) */
function ridgeTexture(): THREE.DataTexture {
  const n = PANO_RIDGE_V.length;
  const data = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) { const h = THREE.DataUtils.toHalfFloat(PANO_RIDGE_V[i] ?? 0.5); data[i * 4] = h; data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1); }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

interface SkyImagePorts { image: typeof fetchImage; compressed: typeof ktx2Texture }
const skyImages: SkyImagePorts = { image: fetchImage, compressed: ktx2Texture };
// Async decodes may complete after their captured owner retires.
function cancelled(scope: Scope): boolean { return scope.disposed; }

export class SkyDomeV2 {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    tPano: { value: THREE.Texture }; tRidge: { value: THREE.Texture }; tFogLut: { value: THREE.Texture };
    uHorizonV: { value: number }; uPad: { value: number }; uVPerDeg: { value: number }; uElShift: { value: number };
    uZenith: { value: THREE.Color }; uSunNow: { value: THREE.Vector3 }; uSunPainted: { value: THREE.Vector3 }; uNight: { value: number };
  };

  private constructor(tex: THREE.Texture, width: number, fogLut: THREE.Texture, zenith: THREE.Color, scope: Scope) {
    this.uniforms = {
      tPano: { value: tex }, tRidge: { value: ridgeTexture() }, tFogLut: { value: fogLut },
      uHorizonV: { value: PANO_HORIZON_V }, uPad: { value: PANO_PAD_PX / Math.max(1, width) }, uVPerDeg: { value: 1 / PANO_DEG_PER_V }, uElShift: { value: 0 },
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
    if (typeof window !== 'undefined') scope.expose(window, '__skyV2', this.uniforms);
  }

  /** fetch the tier's strip and build the dome (null when the file is missing) */
  static async load(renderer: Renderer, fogLut: THREE.Texture, scope: Scope, ports: SkyImagePorts = skyImages): Promise<SkyDomeV2 | null> {
    const k = await SkyDomeV2.loadKtx2(renderer, fogLut, scope, ports);
    if (k) return k;
    if (cancelled(scope)) return null;
    let image: ImageBitmap | HTMLImageElement;
    try { image = await ports.image(nalatiUrl('panorama'), Infinity, true); } catch { return null; }
    if (cancelled(scope)) { if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); return null; }
    const tex = new THREE.Texture(image);
    tex.flipY = !(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap); // bitmaps are flipped at decode
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.name = 'nalati-panorama';
    tex.needsUpdate = true;
    await prepareCompressedTexture(tex, renderer, () => !cancelled(scope));
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
    // This decode is private to the dome. Memory saver can retire it after upload;
    // ordinary mode keeps it until this owner retires, including an unload before first draw.
    let released = false;
    const releaseImage = (): void => {
      if (released) return;
      released = true;
      if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
      else if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) image.removeAttribute('src');
    };
    releaseOnUpload(tex.source, releaseImage);
    scope.onDispose(releaseImage);
    return new SkyDomeV2(tex, image.width, fogLut, zenith, scope);
  }

  /**
   * E157: the panorama's KTX2 stand-in (Y-flipped at encode, like the bitmap above), or null. A compressed texture has no
   * pixels to draw on a canvas, so the zenith's top rows are read back through the GPU (the same 64×12 average).
   */
  private static async loadKtx2(renderer: Renderer, fogLut: THREE.Texture, scope: Scope, ports: SkyImagePorts = skyImages): Promise<SkyDomeV2 | null> {
    let tex: THREE.CompressedTexture | null;
    try { tex = await ports.compressed(nalatiUrl('panorama')); } catch { return null; }
    if (!tex) return null;
    if (cancelled(scope)) { tex.dispose(); return null; }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.name = 'nalati-panorama';
    tex.needsUpdate = true;
    await prepareCompressedTexture(tex, renderer, () => !cancelled(scope));
    const zenith = new THREE.Color(0.1, 0.25, 0.62);
    try {
      const rows = readTexturePixels(tex, 64, 12, renderer)?.subarray(0, 64 * 2 * 4) ?? new Uint8Array(0); // the painting's top two rows
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < rows.length; i += 4) { r += rows[i] ?? 0; g += rows[i + 1] ?? 0; b += rows[i + 2] ?? 0; }
      const n = rows.length / 4;
      if (n > 0) zenith.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    } catch { /* keep the default */ }
    return new SkyDomeV2(tex, tex.image.width, fogLut, zenith, scope);
  }
}
