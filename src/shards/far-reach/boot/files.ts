import type { ShardManifest } from '#game';

/** The generated models (C6, and the rope-bridge kit): loaded by `world/meshes.ts`, listed here so the boot and the offline cache fetch them. */
export type SkyMeshName = 'storm-roc' | 'sky-goat' | 'drift-ray' | 'wind-vane' | 'bridge-post' | 'bridge-deck' | 'keeper';
export const SKY_MESHES: readonly SkyMeshName[] = ['storm-roc', 'sky-goat', 'drift-ray', 'wind-vane', 'bridge-post', 'bridge-deck', 'keeper'];
const URLS: Readonly<Record<SkyMeshName, string>> = {
  'storm-roc': '/assets/far-reach/models/storm-roc/storm-roc.glb', 'sky-goat': '/assets/far-reach/models/sky-goat/sky-goat.glb',
  'drift-ray': '/assets/far-reach/models/drift-ray/drift-ray.glb',
  'wind-vane': '/assets/far-reach/models/wind-vane/wind-vane.glb', 'bridge-post': '/assets/far-reach/models/bridge-post/bridge-post.glb',
  'bridge-deck': '/assets/far-reach/models/bridge-deck/bridge-deck.glb', keeper: '/assets/far-reach/models/keeper/keeper.glb',
};
export const skyMeshUrl = (name: SkyMeshName): string => URLS[name];
/** The painted textures (E392, `art/far-reach/round-17-mockup-loop/textures/`): keel rock, meadow ground, the cumulus atlas. */
export const TEX_URL = { rock: '/assets/far-reach/tex/rock.webp', meadow: '/assets/far-reach/tex/meadow.webp', clouds: '/assets/far-reach/tex/clouds.webp', branches: '/assets/far-reach/tex/branches.webp', cloudsea: '/assets/far-reach/tex/cloudsea.webp' } as const;
/** The war fan's painted silk leaf (weapons/fanModel.ts). */
export const FAN_LEAF_URL = '/assets/far-reach/fan/leaf.webp';
/** The painted 360° sky (look/sky.ts), one strip per tier. */
export const PANO_URL = { desktop: '/assets/far-reach/sky/panorama.webp', phone: '/assets/far-reach/sky/panorama.phone.webp' } as const;

/** Sky Reach downloads its painted sky (look/sky.ts) and its generated models (C6, `world/meshes.ts`); the rest is built in code. The card and Explore images are bundled imports (thumbs/, explore/). */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = (tier) => ({
  sky: [tier === 'phone' ? PANO_URL.phone : PANO_URL.desktop], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: SKY_MESHES.map(skyMeshUrl), art: [FAN_LEAF_URL, TEX_URL.rock, TEX_URL.meadow, TEX_URL.clouds, TEX_URL.branches, TEX_URL.cloudsea], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
