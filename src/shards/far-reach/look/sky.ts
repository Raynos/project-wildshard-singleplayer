import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, type ShaderMaterial, SphereGeometry, SRGBColorSpace, UnsignedByteType, type Texture } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { PANO_URL } from '../boot/files';
import { SKY_DOME_PROGRAMS } from '../data/skyDomeLook';
import { loadPainted } from './image';
import { PANO_FOG_SRGB, PANO_PAD_PX } from './panoramaData';

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
  // the strip carries PANO_PAD_PX columns of wrap either side: the heading maps inside them
  // the strip's width: its bitmap's, or the size the Memory saver keeps once the bitmap went at its upload
  const image: unknown = pano.image, width: unknown = typeof image === 'object' && image !== null ? Reflect.get(image, 'width') : undefined;
  const total = typeof width === 'number' && width > 1 ? width : PANO_PAD_PX * 2 + 1;
  const padU = PANO_PAD_PX / total, scaleU = (total - PANO_PAD_PX * 2) / total;
  // the direction from the CAMERA (E399 round 6, the seats: 'a hollow ring and a separate glow that drift apart as the
  // camera pitches'): the dome sits at the world origin, so sampling by its own vertex put the painted sun degrees off the
  // glow at the true sun direction wherever the camera stood away from the origin (the crown is 176 m out); data/skyDomeLook.ts
  const geometry = new SphereGeometry(900, 64, 32);
  return new Mesh(geometry, new ShaderFamily({}, SKY_DOME_PROGRAMS).material('dome', {}, { uniforms: { pano: { value: pano }, haze: { value: haze }, padU: { value: padU }, scaleU: { value: scaleU } } }));
}
