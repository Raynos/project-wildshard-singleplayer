import type { ShardManifest } from '#game';

/** The generated models (C6): loaded by `world/meshes.ts`, listed here so the boot and the offline cache fetch them. */
export type DuneMeshName = 'caravan' | 'dry-well' | 'waymark-brazier' | 'dune-strider' | 'dune-matriarch' | 'caravan-scout' | 'whip-glove';
export const DUNE_MESHES: readonly DuneMeshName[] = ['caravan', 'dry-well', 'waymark-brazier', 'dune-strider', 'dune-matriarch', 'caravan-scout', 'whip-glove'];
const URLS: Readonly<Record<DuneMeshName, string>> = {
  caravan: '/assets/sunscar-dunes/models/caravan/caravan.glb', 'dry-well': '/assets/sunscar-dunes/models/dry-well/dry-well.glb',
  'waymark-brazier': '/assets/sunscar-dunes/models/waymark-brazier/waymark-brazier.glb', 'dune-strider': '/assets/sunscar-dunes/models/dune-strider/dune-strider.glb',
  // loop 2 (art/sunscar-dunes/round-11-loop-2/props.json): the Matriarch's own body, Sefa the caravan scout, the gloved fist on the whip's handle
  'dune-matriarch': '/assets/sunscar-dunes/models/dune-matriarch/dune-matriarch.glb', 'caravan-scout': '/assets/sunscar-dunes/models/caravan-scout/caravan-scout.glb',
  'whip-glove': '/assets/sunscar-dunes/models/whip-glove/whip-glove.glb',
};
export const duneMeshUrl = (name: DuneMeshName): string => URLS[name];

/** Signal Dunes downloads only its generated models (C6, `world/meshes.ts`); the rest is code and every sound is a kit voice. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: DUNE_MESHES.map(duneMeshUrl), art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
