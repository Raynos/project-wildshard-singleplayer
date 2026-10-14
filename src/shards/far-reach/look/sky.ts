import { BackSide, ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, MeshBasicMaterial, RGBAFormat, SphereGeometry, SRGBColorSpace, UnsignedByteType, type Texture } from 'three';
import type { GraphIr } from '@wildshard/format/materialGraph';
import { TIER } from '@wildshard/engine/core/tier';
import { PANO_URL } from '../data/files';
import { skyDomeGraph } from '../data/skyDomeLook';
import { loadPainted } from './image';
import { PANO_FOG_SRGB, PANO_PAD_PX } from './panoramaData';
import { SKY } from '../data/skyLook';

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
  // decoded flipped already (an ImageBitmap): unflagged, so the dome's graph samples it the same with or without the
  // decoded bitmap (a flagged ImageBitmap is flipped again by the node sampler, until the Memory saver drops it)
  tex.flipY = false; tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false; tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}

/** The dome: a 900 m sphere in the fog's colour until its graph (`skyDomeGraph`) compiles with the backdrop. */
export const skyDome = (): Mesh<SphereGeometry, MeshBasicMaterial> => new Mesh(new SphereGeometry(900, 64, 32), new MeshBasicMaterial({ color: SKY.fog, side: BackSide, depthWrite: false, fog: false }));

/** The dome's graph over the painted strip (its zenith above, its nadir below) and `haze`, the look's heading strip. */
export function skyDomeMaterial(pano: Texture, haze: Texture): { readonly ir: GraphIr; readonly textures: (ref: string) => Texture } {
  // the strip carries PANO_PAD_PX columns of wrap either side: the heading maps inside them
  // the strip's width: its bitmap's, or the size the Memory saver keeps once the bitmap went at its upload
  const image: unknown = pano.image, width: unknown = typeof image === 'object' && image !== null ? Reflect.get(image, 'width') : undefined;
  const total = typeof width === 'number' && width > 1 ? width : PANO_PAD_PX * 2 + 1;
  // sampled by the direction from the CAMERA (E399 round 6, the seats: 'a hollow ring and a separate glow that drift apart
  // as the camera pitches'): the dome sits at the world origin, so sampling by its own vertex put the painted sun degrees
  // off the glow at the true sun direction wherever the camera stood away from the origin (the crown is 176 m out)
  return { ir: skyDomeGraph(PANO_PAD_PX / total, (total - PANO_PAD_PX * 2) / total), textures: (ref) => (ref === 'haze' ? haze : pano) };
}
