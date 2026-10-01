import type { ShardManifest } from '#game';

/** Sunscar Dunes downloads no art of its own: the dunes, sky, tower, whip and ray are built in code. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
