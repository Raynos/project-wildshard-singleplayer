/**
 * The Nalati painted texture set (look pass, "painted assets" — docs/design/nalati/look-pass.md; painted-asset agent).
 *
 * The mockups are paintings: every surface carries painted high-frequency detail. These are hand-painted (codex image
 * gen, gpt-6-sol, in the style of art/nalati-grasslands/round-1/1-art-style/style-B-painterly.jpg) and made seamless
 * here, under public/assets/nalati/:
 *
 *   tex/<name>.webp          1024², seamless (tiled 2×2 in progress/nalati-look/assets-textures.jpg), sRGB albedo
 *   tex/<name>.phone.webp     512², the phone tier's copy
 *   cards.webp / cards.phone.webp   the grass + flower card atlas (2048×1024 / 1024×512, straight alpha — see GRASS_CARDS)
 *
 * Nothing is fetched until someone asks: every loader is lazy, cached per file, and picks the tier's file itself
 * (`TIER_CONFIG.maxTexture <= 1024` → `.phone.webp`). The files are sRGB albedo, evenly lit (the painted light comes
 * from the painterly material, not the texture), so the painterly ramp / rim / shade tint still own the lighting.
 *
 * ── Adoption (each owner does their own) ────────────────────────────────────────────────────────────────────────────
 *
 * Terrain (world-agent, src/nalati/terrainSurface.ts): the vertex colour keeps the macro painting; the texture adds the
 * painted detail. Load `await loadNalatiTextures(['meadow', 'path', 'gravel', 'rock', 'snow'])`, put them on the
 * terrain shader as uniforms (tMeadow …) and, after `color_fragment`, sample each at world XZ × 1 / TEX_METRES[name]
 * (rock: triplanar — XZ, XY, ZY weighted by |normal|^4) and replace the procedural grain with
 *     vec3 detail = meadow * (1 - road) + path * road;  detail = mix(detail, gravel, vSurf.y); … rock by vSurf.w, snow by vSurf.z
 *     diffuseColor.rgb *= detail / TEX_MEAN[name]           // luminance-preserving (linear means): the macro vertex colour stays the hue
 * or, for a stronger read, `diffuseColor.rgb = mix(diffuseColor.rgb, detail * macroTint, 0.6)`. Break the tiling with
 * a second tap at 0.37× scale rotated 30° mixed by a low-frequency noise (the grain noise you already have).
 *
 * Outcrops (world-agent, src/nalati/outcrops.ts): `rock` triplanar the same way, 1 / TEX_METRES.rock.
 * Spruce (spruce agent, the 'spruce' TreeFactory): trunk uv = (angle / 2π × 2, height / 1.6 m) → `bark`, RepeatWrapping.
 * Yurts (poi-agent): the wall cylinder's uv = (angle / 2π × 6, height / wall height) → `felt` (its ornament band runs
 * across the middle third, tiling horizontally — keep v in 0..1 over the wall so there is exactly one band).
 * Grass (src/nalati/look/grass.ts, the near-field cards): see GRASS_CARDS below — a card instance maps its quad to one cell.
 *
 * Bytes (measured): desktop 2.78 MB — cards 0.89 · the seven tiles 1.90; phone 0.92 MB — cards 0.32 · tiles 0.61. Nothing here is in the boot manifest: a module that adopts a file loads it lazily.
 */
import * as THREE from 'three';
import { loadTexture } from '../core/assets';
import { TIER_CONFIG } from '../core/tier';

export type NalatiTexName = 'meadow' | 'path' | 'gravel' | 'rock' | 'snow' | 'bark' | 'felt';

/** metres of world one tile covers, as painted (a pebble / blade / plate reads at its real size) */
export const TEX_METRES: Readonly<Record<NalatiTexName, number>> = {
  meadow: 2.5, path: 2.0, gravel: 1.6, rock: 4.0, snow: 3.0, bark: 1.6, felt: 1.8,
};

/**
 * each texture's mean colour in LINEAR space (what the shader sees after the sRGB decode), for a luminance-preserving
 * detail blend: `albedo *= tex / TEX_MEAN[name]` keeps the macro vertex colour's hue and brightness and adds the painted detail
 */
export const TEX_MEAN: Readonly<Record<NalatiTexName, readonly [number, number, number]>> = {
  meadow: [0.25, 0.245, 0.056], path: [0.457, 0.274, 0.116], gravel: [0.324, 0.268, 0.212], rock: [0.297, 0.247, 0.181],
  snow: [0.607, 0.665, 0.798], bark: [0.216, 0.139, 0.097], felt: [0.564, 0.397, 0.295],
};

const DIR = '/assets/nalati/';
export const isPhoneTier = (): boolean => TIER_CONFIG.maxTexture <= 1024;

/** a Nalati painted file's URL for this tier (`name` without extension, relative to /assets/nalati/) */
export function nalatiUrl(name: string): string {
  return `${DIR}${name}${isPhoneTier() ? '.phone' : ''}.webp`;
}

const cache = new Map<string, Promise<THREE.Texture>>();

/** One painted tileable texture: sRGB, RepeatWrapping, mipmapped, anisotropic. Shared per name — set `repeat` on a clone. */
export function loadNalatiTexture(name: NalatiTexName): Promise<THREE.Texture> {
  const url = nalatiUrl(`tex/${name}`);
  let p = cache.get(url);
  if (!p) {
    p = loadTexture(url, true).then((t) => { t.name = `nalati-${name}`; return t; });
    cache.set(url, p);
  }
  return p;
}

export async function loadNalatiTextures<K extends NalatiTexName>(names: readonly K[]): Promise<Record<K, THREE.Texture>> {
  const texs = await Promise.all(names.map(loadNalatiTexture));
  const out = {} as Record<K, THREE.Texture>;
  names.forEach((n, i) => { const t = texs[i]; if (t) out[n] = t; });
  return out;
}

// ── the grass + flower card atlas ──────────────────────────────────────────────────────────────────────────────────

export type GrassCardKind = 'grass' | 'dry' | 'feather' | 'sage' | 'edelweiss' | 'buttercup';
/** one card in the atlas: uv rect (u0, v0 bottom-left … u1, v1 top-right, three's flipY-false bitmap convention: v = 0 is the
 *  bottom row), its kind, and `aspect` = the cell's width / height: a quad h tall and h × aspect wide shows the whole cell
 *  (the clump stands centred on the quad's bottom edge, transparent round it) */
export interface GrassCard { kind: GrassCardKind; u0: number; v0: number; u1: number; v1: number; aspect: number }

/**
 * The atlas: 2048 × 1024 (phone 1024 × 512), 8 columns × 2 rows of 256 × 512 cells. Every clump stands on its cell's
 * bottom edge, centred, straight (unpremultiplied) alpha with the colour bled out under the transparent texels (no
 * key-colour fringes in the mips). Row 0 (bottom, v 0..0.5): eight grass clumps; row 1 (top): the flowers.
 *
 * Grass-agent adoption (src/nalati/look/grass.ts buildCards): a card clump is a camera-facing (or 2–3 crossed) quad per instance, uv from
 * `GRASS_CARDS[i]`, `alphaTest: 0.5` + `alphaToCoverage` on desktop (MSAA), `alphaTest` alone on the phone; bend the
 * top verts with the same wind / trample vector as the blades. Tint by the instance's ground colour × tone so the cards
 * take the hills' gold / green patches, keep the painted texel detail. Cards are for the MID ring (the far LOD the
 * blades cannot afford) and the flower drifts; the near blades can stay geometry. Discard costs the tile GPUs their
 * hidden-surface removal, so keep the card count / overdraw measured on ?tier=phone.
 */
export const GRASS_CARDS: readonly GrassCard[] = buildCards();

function buildCards(): GrassCard[] {
  // [kind, aspect] per cell, row 0 then row 1, in the order the packer laid them out
  const cells: [GrassCardKind, number][] = [
    ['grass', 0.5], ['grass', 0.5], ['feather', 0.5], ['grass', 0.5], ['grass', 0.5], ['dry', 0.5], ['grass', 0.5], ['grass', 0.5],
    ['sage', 0.5], ['sage', 0.5], ['sage', 0.5], ['edelweiss', 0.5], ['edelweiss', 0.5], ['buttercup', 0.5], ['buttercup', 0.5], ['buttercup', 0.5],
  ];
  return cells.map(([kind, aspect], i) => {
    const col = i % 8, row = Math.floor(i / 8);
    return { kind, u0: col / 8, v0: row / 2, u1: (col + 1) / 8, v1: (row + 1) / 2, aspect };
  });
}

let atlas: Promise<THREE.Texture> | null = null;
/** The card atlas: sRGB, clamped, mipmapped. */
export function loadGrassCardAtlas(): Promise<THREE.Texture> {
  atlas ??= loadTexture(nalatiUrl('cards'), true).then((t) => {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.name = 'nalati-cards';
    return t;
  });
  return atlas;
}
