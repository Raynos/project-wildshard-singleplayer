import type { ShardManifest } from '#game';

/** The generated models (C6): loaded by `world/meshes.ts`, listed here so the boot and the offline cache fetch them. */
export type DuneMeshName = 'caravan' | 'dry-well' | 'waymark-brazier' | 'dune-strider';
export const DUNE_MESHES: readonly DuneMeshName[] = ['caravan', 'dry-well', 'waymark-brazier', 'dune-strider'];
const URLS: Readonly<Record<DuneMeshName, string>> = {
  caravan: '/assets/sunscar-dunes/models/caravan/caravan.glb', 'dry-well': '/assets/sunscar-dunes/models/dry-well/dry-well.glb',
  'waymark-brazier': '/assets/sunscar-dunes/models/waymark-brazier/waymark-brazier.glb', 'dune-strider': '/assets/sunscar-dunes/models/dune-strider/dune-strider.glb',
};
export const duneMeshUrl = (name: DuneMeshName): string => URLS[name];

/** Signal Dunes downloads only its generated models (C6, `world/meshes.ts`); the rest is code and every sound is a kit voice. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: DUNE_MESHES.map(duneMeshUrl), art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
