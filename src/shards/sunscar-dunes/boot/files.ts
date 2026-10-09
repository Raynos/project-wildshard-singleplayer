import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { SAND_FILES } from '../data/sand';
import { FIRE_STYLE } from '../data/fire';
import { BAKED_PIECES, BAKED_URLS, DUNE_HD, DUNE_MESHES, DUNE_RIGS, DUNE_HD_URLS, DUNE_MESH_URLS, DUNE_RIG_URLS, PAINTED_STAGES, PAINTED_URLS } from '../data/files';

/** Signal Dunes downloads its generated models (C6, `world/meshes.ts`), its baked world pieces (`world/baked.ts`), its baked creature rigs, its baked sand maps (`look/render.ts`) and its painted dusk skies; the rest is code and every sound is a kit voice. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: PAINTED_STAGES.map((key) => PAINTED_URLS[key]), baked: [], terrain: Object.values(SAND_FILES), trees: [], physics: [], cabins: [], props: [...DUNE_MESHES.map((key) => DUNE_MESH_URLS[key]), ...DUNE_HD.map((key) => DUNE_HD_URLS[key]), ...BAKED_PIECES.map((key) => BAKED_URLS[key]), ...DUNE_RIGS.map((key) => DUNE_RIG_URLS[key])], art: [FIRE_STYLE.book.url], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
/** What the shard reads after its boot: the learned grade (look/render.ts loadLUT; art/sunscar-dunes/round-24-lut/). */
export const lateReads = (): readonly string[] => ['/assets/lut/sunscar-dunes.bin'];
