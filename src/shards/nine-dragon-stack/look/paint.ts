// Copied from the texture lab (the dev labs (deleted in E357 F7), round-9-lab-texture) into the clean room.
// P5 "texture" (E169, round-9-lab-texture): PAINTED SURFACE TEXTURES under the Jiehua ink.
//
// Nine codex image_gen swatches (art/nine-dragon-stack/round-9-lab-texture/tools/mkjobs.py), made seamless and turned
// into DETAIL RATIOS by tools/texprep.py (linear texel / its flattened local mean, stored as ratio / scale), loaded into
// ONE RGBA8 texture array (1024² × 9, mipmapped, anisotropic). The material multiplies its wash by the ratio before
// the ruled lines are composed, so the lines stay crisp, the palette stays the wash's (the deepest mip is exactly 1: a
// far surface is its flat wash, the round-8 ΔE fit survives), and the paint reads as painted grain, grime runs, carved
// relief, glaze and lacquer. Alpha carries a cavity map (flagstone puddles) or a coverage mask (posters).
//
// Surfaces pick a layer by their kind (flag 3 → flag/flag2 per stone, panel 5 → the carved frieze, tiles 2 → glazed
// tiles, facade 1 → concrete, stone 9 → stone) or explicitly by `Look.surf` (flag bits × 4096): see SURF.
// Cost: 1 sample (flags, panel field, tiles, lacquer, wood), 2 samples (concrete / stone: a second scale), 3 on a
// poster wall (concrete ×2 + the poster). GPU memory 1024² × 9 × 4 B × 4/3 = 50 MB as RGBA8 (the lab); ~12.6 MB as ASTC
// 4×4 / ETC2 in a KTX2 array for shipping. Download: the JPEGs, 3.65 MB. Findings: round-9-lab-texture/README.md.
import type { DataArrayTexture } from 'three';
import { loadPaintArray, paintArrayPlaceholder } from '@wildshard/sdk/looks/paintArray';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { paintSize, type NdTier } from '../tier';
import { LAYERS, PAINT_UNIFORMS, SURF as PAINT_SURF } from '../data/paint';

// SHARD-PLATFORM M3: the layers, the surfaces, the flagstone layout, the uniforms' rows and the GLSL are data
// (data/paint.ts); the SDK's paint array (@wildshard/sdk/looks/paintArray) loads them.

/** Look.surf: an explicit surface (flag bits × 4096); 0 = by kind (data/paint.ts) */
export const SURF: typeof PAINT_SURF = PAINT_SURF;

// The 1024px array alone holds 48 MiB on the GPU. On a phone, 512px preserves the authored ratios at the
// displayed scale and reduces the array and its upload buffer to one quarter of that size.

/** a 1-texel stand-in (ratio 1 everywhere) until the real array has loaded */
export function paintPlaceholder(): DataArrayTexture { return paintArrayPlaceholder(LAYERS); }

/** load every layer (`base` = the folder URL) into one mipmapped RGBA8 array */
export function loadPaint(base: string, anisotropy: number, tier: NdTier, onLayer: (fraction: number) => void = () => undefined): Promise<{ tex: DataArrayTexture; bytes: number }> {
  return loadPaintArray(base, LAYERS, paintSize(tier), anisotropy, 'Nine Dragon paint array (GPU only)', onLayer);
}

/** the paint uniforms (merged into Shared.u so every world program sees one object): the array and data/paint.ts' rows */
export function paintUniforms(): { uPaint: { value: DataArrayTexture } } & UniformsOf<typeof PAINT_UNIFORMS> {
  return { uPaint: { value: paintPlaceholder() }, ...uniformsFrom(PAINT_UNIFORMS) };
}
