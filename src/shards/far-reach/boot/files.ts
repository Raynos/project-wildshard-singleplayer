import type { ShardManifest } from '#game';

/** Sky Reach builds everything in code: no downloaded assets beyond the engine's own runtime. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
