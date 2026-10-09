import type { ShardManifest } from '@wildshard/game/shard/manifest';

/** The generated models (C6): loaded by `world/meshes.ts`, listed here so the boot and the offline cache fetch them. */
export type DuneMeshName = 'caravan' | 'dry-well' | 'waymark-brazier' | 'dune-strider' | 'dune-matriarch' | 'caravan-scout' | 'whip-glove';
export const DUNE_MESHES: readonly DuneMeshName[] = ['caravan', 'dry-well', 'waymark-brazier', 'dune-strider', 'dune-matriarch', 'caravan-scout', 'whip-glove'];
/**
 * The hero models kept TEXTURED (loop 6, toward the mockups B-D): Hunyuan3D-2 shape + 2048 paint, decimated, the paint
 * kept as a 1024 WebP map on its UVs (the facet-colour path above reads low-poly and blotchy up close).
 */
export type DuneHdName = 'wagon-hd' | 'wagon-hd2' | 'crates-hd' | 'sacks-hd' | 'brazier-hd' | 'glove-hd' | 'glove-hd2' | 'glove-hd3' | 'glove-hd4' | 'horse-hd' | 'mesa-butte' | 'mesa-mesa' | 'mesa-spire';
// E399: the mesas are not preloaded while the world shows none (the mockups have low dune ranges at the horizon)
// E399 (council round 3): the held glove is glove-hd2 (a stitched gauntlet with a cuff, framed as mockup D); glove-hd stays on disk
// E407 row 4: the held glove is glove-hd3 (the glove alone gripping its handle; the loop is a code tube); glove-hd2 stays on disk
// round 18: the held glove is glove-hd4 (the back of the hand and the cuff toward the camera, as mockups D and dusk-fire);
// glove-hd3 stays on disk
// the original top-10's row 7: the camp as a modelled set from mockup B (art/sunscar-dunes/round-28-camp): wagon-hd2 (torn
// canvas over bare hoops, a planked tailboard, spoked wheels), the crate pair and the sack pile; wagon-hd stays on disk
export const DUNE_HD: readonly DuneHdName[] = ['wagon-hd2', 'crates-hd', 'sacks-hd', 'brazier-hd', 'glove-hd4', 'horse-hd'];
const HD_URLS: Readonly<Record<DuneHdName, string>> = {
  'wagon-hd': '/assets/sunscar-dunes/models/wagon-hd/wagon-hd.glb',
  // the camp from mockup B (art/sunscar-dunes/round-28-camp; Hunyuan3D-2)
  'wagon-hd2': '/assets/sunscar-dunes/models/wagon-hd2/wagon-hd2.glb', 'crates-hd': '/assets/sunscar-dunes/models/crates-hd/crates-hd.glb',
  'sacks-hd': '/assets/sunscar-dunes/models/sacks-hd/sacks-hd.glb', 'brazier-hd': '/assets/sunscar-dunes/models/brazier-hd/brazier-hd.glb',
  'glove-hd': '/assets/sunscar-dunes/models/glove-hd/glove-hd.glb',
  // the stitched gauntlet glove and its coiled plaited whip (art/sunscar-dunes/round-20-glove)
  'glove-hd2': '/assets/sunscar-dunes/models/glove-hd2/glove-hd2.glb',
  // the leather glove alone, its fist round a short plaited handle (art/sunscar-dunes/round-23-glove; Hunyuan3D-2, its backdrop card cut)
  'glove-hd3': '/assets/sunscar-dunes/models/glove-hd3/glove-hd3.glb',
  // the same glove re-posed: the back of the hand to the camera (art/sunscar-dunes/round-27-glove; Hunyuan3D-2 from the mockups' hands)
  'glove-hd4': '/assets/sunscar-dunes/models/glove-hd4/glove-hd4.glb',
  // the caravan's pack horse, tethered by the tent (mockup B; art/sunscar-dunes/round-19-horse)
  'horse-hd': '/assets/sunscar-dunes/models/horse-hd/horse-hd.glb',
  // the far sandstone (art/sunscar-dunes/round-18-mesas): a tall butte, a broad mesa, a spire-and-hoodoo cluster
  'mesa-butte': '/assets/sunscar-dunes/models/mesa-butte/mesa-butte.glb', 'mesa-mesa': '/assets/sunscar-dunes/models/mesa-mesa/mesa-mesa.glb',
  'mesa-spire': '/assets/sunscar-dunes/models/mesa-spire/mesa-spire.glb',
};
export const duneHdUrl = (name: DuneHdName): string => HD_URLS[name];
const URLS: Readonly<Record<DuneMeshName, string>> = {
  caravan: '/assets/sunscar-dunes/models/caravan/caravan.glb', 'dry-well': '/assets/sunscar-dunes/models/dry-well/dry-well.glb',
  'waymark-brazier': '/assets/sunscar-dunes/models/waymark-brazier/waymark-brazier.glb', 'dune-strider': '/assets/sunscar-dunes/models/dune-strider/dune-strider.glb',
  // loop 2 (art/sunscar-dunes/round-11-loop-2/props.json): the Matriarch's own body, Sefa the caravan scout, the gloved fist on the whip's handle
  'dune-matriarch': '/assets/sunscar-dunes/models/dune-matriarch/dune-matriarch.glb', 'caravan-scout': '/assets/sunscar-dunes/models/caravan-scout/caravan-scout.glb',
  'whip-glove': '/assets/sunscar-dunes/models/whip-glove/whip-glove.glb',
};
export const duneMeshUrl = (name: DuneMeshName): string => URLS[name];
/** The world pieces baked offline (SF72: `generators/<piece>.ts` → `scripts/bake-signal-world.mjs`), drawn by `world/baked.ts`. */
export const BAKED_PIECES = ['rocks', 'dressing'] as const;
export type BakedPiece = (typeof BAKED_PIECES)[number];
const BAKED_URLS: Readonly<Record<BakedPiece, string>> = { rocks: '/assets/sunscar-dunes/baked/rocks.glb', dressing: '/assets/sunscar-dunes/baked/dressing.glb' };
export const bakedUrl = (piece: BakedPiece): string => BAKED_URLS[piece];

/** The flame's flipbook (world/fireFx.ts loadFireBook; art/sunscar-dunes/round-26-fire; E407 row 6). */
export const FIRE_BOOK_URL = '/assets/sunscar-dunes/fx/fire-book.webp';
/** The painted dusk skies, one per dusk stage (look/painted.ts, art/sunscar-dunes/round-25-sky; E409 second top-10 row 2). */
export const PAINTED_STAGES = ['early', 'late'] as const;
export type PaintedStage = (typeof PAINTED_STAGES)[number];
const PAINTED_URLS: Readonly<Record<PaintedStage, string>> = { early: '/assets/sunscar-dunes/sky/dusk-early.webp', late: '/assets/sunscar-dunes/sky/dusk-late.webp' };
export const paintedUrl = (stage: PaintedStage): string => PAINTED_URLS[stage];

/** Signal Dunes downloads its generated models (C6, `world/meshes.ts`), its baked world pieces (`world/baked.ts`) and its painted dusk skies; the rest is code and every sound is a kit voice. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: PAINTED_STAGES.map(paintedUrl), baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [...DUNE_MESHES.map(duneMeshUrl), ...DUNE_HD.map(duneHdUrl), ...BAKED_PIECES.map(bakedUrl)], art: [FIRE_BOOK_URL], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
/** What the shard reads after its boot: the learned grade (look/render.ts loadLUT; art/sunscar-dunes/round-24-lut/). */
export const lateReads = (): readonly string[] => ['/assets/lut/sunscar-dunes.bin'];
