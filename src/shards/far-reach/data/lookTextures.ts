import { PANO_URL, TEX_URL } from './files';
import { PANO_PAD_PX } from '../look/panoramaData';
import { skyDomeGraph } from './skyDomeLook';

/**
 * The painted images the look loads up front (look/render.ts, the game's `loadPaintedTexture`), as rows: the panorama per
 * tier (look/sky.ts's strip: clamped, unmipped, magnified near 1:1, so no mip chain puts a seam column where the heading
 * wraps), the cumulus atlas, the cloud sea (tiled: repeating, trilinear mips, 4x anisotropy) and the maelstrom. Memory
 * saver: every decoded copy goes at its upload (nothing reads these pixels on the CPU). Samplers are three's constants
 * (1000 repeat, 1001 clamp, 1006 linear, 1008 linear-mipmap-linear).
 */
const painted = (url: string, name: string) => ({ url, name, warn: `[far-reach] ${name} not loaded:`, sampler: { release: true } }) as const;
const PANO_SAMPLER = { release: true, wrapS: 1001, wrapT: 1001, mips: false, minFilter: 1006, magFilter: 1006 } as const;
export const SKY_LOOK_TEXTURES = {
  pano: { phone: { ...painted(PANO_URL.phone, 'far.panorama'), sampler: PANO_SAMPLER }, desktop: { ...painted(PANO_URL.desktop, 'far.panorama'), sampler: PANO_SAMPLER } },
  rest: [painted(TEX_URL.clouds, 'far.cumulus'),
    { ...painted(TEX_URL.cloudsea, 'far.cloudsea'), sampler: { release: true, wrapS: 1000, wrapT: 1000, mips: true, minFilter: 1008, anisotropy: 4 } },
    painted(TEX_URL.maelstrom, 'far.maelstrom')],
} as const;

/**
 * The dome's graph per tier: the strip carries PANO_PAD_PX columns of wrap either side of its shipped width (5562 px on
 * desktop, 4128 on the phone; art/far-reach/round-14-loop-4/pano/prep.py), and the heading maps inside them.
 */
const domeGraph = (width: number): ReturnType<typeof skyDomeGraph> => skyDomeGraph(PANO_PAD_PX / width, (width - PANO_PAD_PX * 2) / width);
export const SKY_DOME_GRAPH = { phone: domeGraph(4128), desktop: domeGraph(5562) } as const;
