import { PANO_URL, TEX_URL } from './files';
import { SKY, SKY_DAY, SKY_FOG, SKY_HAZE, SKY_KEY, SKY_PAINTER_LIGHT, SKY_RAYS, SKY_SUN } from './skyLook';
import { PANO_FOG_SRGB } from '../look/panoramaData';
import DRESSING from './skyDressing.generated.json' with { type: 'json' };

const [sunX, sunY, sunZ] = SKY_SUN;

/**
 * The painted images the look loads up front (look/render.ts, the game's `loadPaintedTexture`), as rows: the panorama per
 * tier (look/sky.ts's strip: clamped, unmipped, magnified near 1:1, so no mip chain puts a seam column where the heading
 * wraps), the cumulus atlas, the cloud sea (tiled: repeating, trilinear mips, 4x anisotropy) and the maelstrom. Memory
 * saver: every decoded copy goes at its upload (nothing reads these pixels on the CPU). Samplers are three's constants
 * (1000 repeat, 1001 clamp, 1006 linear, 1008 linear-mipmap-linear).
 */
const painted = (url: string, name: string) => ({ url, name, warn: `[far-reach] ${name} not loaded:`, sampler: { release: true } }) as const;
const PANO_SAMPLER = { release: true, wrapS: 1001, wrapT: 1001, mips: false, minFilter: 1006, magFilter: 1006 } as const;
const SKY_LOOK_TEXTURES = {
  pano: { phone: { ...painted(PANO_URL.phone, 'far.panorama'), sampler: PANO_SAMPLER }, desktop: { ...painted(PANO_URL.desktop, 'far.panorama'), sampler: PANO_SAMPLER } },
  rest: [painted(TEX_URL.clouds, 'far.cumulus'),
    { ...painted(TEX_URL.cloudsea, 'far.cloudsea'), sampler: { release: true, wrapS: 1000, wrapT: 1000, mips: true, minFilter: 1008, anisotropy: 4 } },
    painted(TEX_URL.maelstrom, 'far.maelstrom')],
} as const;

/**
 * Sky Reach's painted look as one row (look/render.ts draws it on the engine's `paintedLook`): `look` is the engine's own
 * spec rows (the painter's light, the key at the painted sun, the fog, the horizon, the NEUTRAL curve, the god rays), `haze`
 * the heading haze over the panorama's fog strip, `day` the fixed clock and `images` the painted images the look loads up
 * front, and `dressing` the dome's graph per tier and the dressing's graphs, card fields and discs, built at build time
 * (generators/skyDressing.ts → data/skyDressing.generated.json; look/render.ts admits them).
 */
export const SKY_PAINTED = {
  look: { light: SKY_PAINTER_LIGHT, sun: { ...SKY_KEY, dir: { x: sunX, y: sunY, z: sunZ } }, fog: { color: SKY.fog, near: SKY_FOG.near, far: SKY_FOG.far }, horizon: SKY.horizon,
    neutral: true, rays: SKY_RAYS },
  haze: { ...SKY_HAZE, ...SKY_FOG, strip: PANO_FOG_SRGB }, day: SKY_DAY, images: SKY_LOOK_TEXTURES, dressing: DRESSING,
} as const;
