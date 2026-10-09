import { BackSide, ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, SRGBColorSpace, UnsignedByteType, type Texture } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { PANO_URL } from '../boot/files';
import { loadPainted } from './image';
import { SUN_DIR } from './sun';
import { PANO_DEG_PER_V, PANO_FOG_SRGB, PANO_HORIZON_V, PANO_NADIR_SRGB, PANO_PAD_PX, PANO_ZENITH_SRGB } from './panoramaData';

/**
 * The golden-hour sky at infinity (loop 4): ONE seamless painted 360° panorama (art/far-reach/round-14-loop-4/pano/:
 * codex image_gen slices outpainted from a sun-centred seed, stitched; `prep.py` there writes the shipped WebP strips and
 * panoramaData.ts). It carries the sky, the towering gold-rimmed cumulus, the low sun, the far floating islands with
 * their waterfalls and the cloud sea out to the horizon; nothing in it is in the playable space (Jake's rule: painted only
 * at infinity, one panorama). The strip's x is the heading (0 = the spawn's forward view, −z; 90 = +x), its rows the
 * elevation; above and below the painted band the dome fades to the painting's own zenith and nadir colours.
 *
 * No mipmaps: the strip is drawn near 1:1 (15 px a degree) and a mip chain would put a seam column where the heading wraps.
 */
export const panoUrl = (): string => (TIER === 'phone' ? PANO_URL.phone : PANO_URL.desktop);

const SUN_GLSL = `vec3(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)})`;
const srgb = (r: number, g: number, b: number): string => { const c = new Color().setRGB(r, g, b, SRGBColorSpace); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };

export async function loadPanorama(): Promise<Texture> {
  // offline or a test page: a one-texel strip of the painted haze, so the dome still draws its zenith, haze and nadir
  const tex = await loadPainted(panoUrl(), 'far.panorama') ?? (() => {
    const [r, g, b] = PANO_FOG_SRGB, c = new Color().setRGB(r ?? 0, g ?? 0, b ?? 0, SRGBColorSpace);
    return new DataTexture(new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]), 1, 1, RGBAFormat, UnsignedByteType);
  })();
  tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false; tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}

/** The painted haze just above the horizon, per heading (64 texels round the compass, linear): the 3-D fog fades into it. */
export function fogLut(): DataTexture {
  const n = PANO_FOG_SRGB.length / 3, data = new Uint8Array(n * 4), c = new Color();
  for (let i = 0; i < n; i++) {
    c.setRGB(PANO_FOG_SRGB[i * 3] ?? 0, PANO_FOG_SRGB[i * 3 + 1] ?? 0, PANO_FOG_SRGB[i * 3 + 2] ?? 0, SRGBColorSpace);
    // gold haze, not rose (E392: the targets sink far islands into warm gold)
    c.multiply(new Color(1.04, 0.98, 0.84));
    data[i * 4] = Math.round(Math.min(1, c.r) * 255); data[i * 4 + 1] = Math.round(Math.min(1, c.g) * 255); data[i * 4 + 2] = Math.round(Math.min(1, c.b) * 255); data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, n, 1, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}
/** GLSL: the heading (0..1, 0 = −z, a quarter = +x) of a direction, as the panorama and the fog LUT read it. */
export const HEADING_GLSL = 'float farHeading(vec3 v){ return fract(atan(v.x, -v.z) / 6.2831853 + 1.0); }';

/** The dome: the painted strip, its zenith above and its nadir below. */
export function skyDome(pano: Texture, haze: Texture): Mesh<SphereGeometry, ShaderMaterial> {
  const [zr, zg, zb] = PANO_ZENITH_SRGB, [nr, ng, nb] = PANO_NADIR_SRGB;
  // the strip carries PANO_PAD_PX columns of wrap either side: the heading maps inside them
  // the strip's width: its bitmap's, or the size the Memory saver keeps once the bitmap went at its upload
  const image: unknown = pano.image, width: unknown = typeof image === 'object' && image !== null ? Reflect.get(image, 'width') : undefined;
  const total = typeof width === 'number' && width > 1 ? width : PANO_PAD_PX * 2 + 1;
  const padU = PANO_PAD_PX / total, scaleU = (total - PANO_PAD_PX * 2) / total;
  return new Mesh(new SphereGeometry(900, 64, 32), new ShaderMaterial({ side: BackSide, depthWrite: false, fog: false,
    uniforms: { pano: { value: pano }, haze: { value: haze }, padU: { value: padU }, scaleU: { value: scaleU } },
    // the direction from the CAMERA (E399 round 6, the seats: 'a hollow ring and a separate glow that drift apart as the
    // camera pitches'): the dome sits at the world origin, so sampling by its own vertex put the painted sun degrees off the
    // glow at the true sun direction wherever the camera stood away from the origin (the crown is 176 m out)
    vertexShader: 'varying vec3 d; void main(){ vec4 w=modelMatrix*vec4(position,1.0); d=w.xyz-cameraPosition; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */`
      uniform sampler2D pano; uniform sampler2D haze; uniform float padU; uniform float scaleU; varying vec3 d;
      ${HEADING_GLSL}
      void main(){
        vec3 n = normalize(d);
        float elev = degrees(asin(clamp(n.y, -1.0, 1.0)));
        float vTop = ${PANO_HORIZON_V.toFixed(4)} - elev / ${PANO_DEG_PER_V.toFixed(3)};
        vec3 c = texture2D(pano, vec2(padU + farHeading(n) * scaleU, 1.0 - clamp(vTop, 0.002, 0.998))).rgb;
        // a veil of the painted haze over the far-island band just above the horizon (council R1C-12: the matte's
        // islands must stay simpler than the playable ones in front of them)
        float band = smoothstep(-1.5, 1.0, elev) * (1.0 - smoothstep(9.0, 22.0, elev));
        c = mix(c, texture2D(haze, vec2(farHeading(n), 0.5)).rgb, band * 0.15);
        // less magenta (E392 judge: the mockups' sky is gold low and lavender-blue high, ours pink-magenta)
        float mag = max(0.0, min(c.r, c.b) - c.g);
        c.g += mag * 0.55; c.b -= mag * 0.25 * (1.0 - smoothstep(4.0, 30.0, elev));
        c = mix(c, c * vec3(0.92, 0.97, 1.08), smoothstep(14.0, 40.0, elev) * 0.6);
        // round 7 (measured on the views' upper sky, x 0.25-0.75, y 0.1-0.35: proposal B chroma 84 vs the mockup's 25, B 61
        // vs 40; C's higher sky cool, 44 vs 59): the band up to ~22 deg toward its own grey, the sky above it warmer
        float farL = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(farL) * vec3(1.04, 1.0, 0.95), (1.0 - smoothstep(16.0, 26.0, elev)) * smoothstep(-2.0, 2.0, elev) * 0.22);
        // (round 8, seats B and C: the upper sky 11-13 darker than the mockups': C 140 vs 205) warmer and lighter
        c = mix(c, c * vec3(1.28, 1.14, 0.98), smoothstep(18.0, 40.0, elev) * 0.6);
        // (round 9: C's upper sky 141 against the mockup's 205, still lavender) toward a warm peach of a higher luminance
        float farHi = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(1.22, 0.98, 0.8) * max(farHi * 1.35, 0.42), smoothstep(16.0, 34.0, elev) * 0.5);
        // the painted glow round the sun rolled off (round 7, seat B: D's middle band 13.6 % over 230 against the mockup's
        // 5.2 %, the hot blob ~0.35 of the frame wide): the glow card (look/sunGlow.ts) carries the hot core
        float farToSun = degrees(acos(clamp(dot(n, ${SUN_GLSL}), -1.0, 1.0)));
        float farHot = smoothstep(0.55, 0.95, dot(c, vec3(0.2126, 0.7152, 0.0722)));
        c *= 1.0 - 0.42 * farHot * exp(-pow(farToSun / 18.0, 2.0)) * smoothstep(1.2, 3.0, farToSun);
        c = mix(c, ${srgb(zr, zg, zb)}, smoothstep(0.05, -0.12, vTop));
        c = mix(c, ${srgb(nr, ng, nb)}, smoothstep(0.95, 1.1, vTop));
        gl_FragColor = vec4(c, 1.0);
      }` }));
}
