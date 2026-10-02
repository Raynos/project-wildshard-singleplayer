import type { ShardManifest } from '#game';

/** The generated models (C6, and the rope-bridge kit): loaded by `world/meshes.ts`, listed here so the boot and the offline cache fetch them. */
export type SkyMeshName = 'storm-roc' | 'sky-goat' | 'drift-ray' | 'windmill' | 'wind-vane' | 'bridge-post' | 'bridge-deck';
export const SKY_MESHES: readonly SkyMeshName[] = ['storm-roc', 'sky-goat', 'drift-ray', 'windmill', 'wind-vane', 'bridge-post', 'bridge-deck'];
const URLS: Readonly<Record<SkyMeshName, string>> = {
  'storm-roc': '/assets/far-reach/models/storm-roc/storm-roc.glb', 'sky-goat': '/assets/far-reach/models/sky-goat/sky-goat.glb',
  'drift-ray': '/assets/far-reach/models/drift-ray/drift-ray.glb', windmill: '/assets/far-reach/models/windmill/windmill.glb',
  'wind-vane': '/assets/far-reach/models/wind-vane/wind-vane.glb', 'bridge-post': '/assets/far-reach/models/bridge-post/bridge-post.glb',
  'bridge-deck': '/assets/far-reach/models/bridge-deck/bridge-deck.glb',
};
export const skyMeshUrl = (name: SkyMeshName): string => URLS[name];

/** Sky Reach downloads only its generated models (C6, `world/meshes.ts`); the rest is built in code and the card is an inline SVG. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: SKY_MESHES.map(skyMeshUrl), art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
