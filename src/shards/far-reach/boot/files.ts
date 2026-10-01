import type { ShardManifest } from '#game';

/** Sky Reach downloads no art: every model is built in code and the card is an inline SVG. */
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = () => ({
  sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
