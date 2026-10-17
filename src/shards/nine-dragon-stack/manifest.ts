import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { DECLARATION, POSES } from './boot/declaration.generated';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import { TERRAIN } from './terrain';

/** Fixed metadata and asset identities are compiled by the boot producer. */
export const NINE_DRAGON_STACK: ShardManifest = {
  ...DECLARATION,
  slug: 'nine-dragon-stack',
  navigation: { row: navigation.navigation, url: navigation.url },
  trustedRuntime: { get slug() { return NINE_DRAGON_STACK.slug; }, entry: 'runtime/index.ts' },
  dev: { poses: () => Promise.resolve(POSES) },
  load: () => import('./plugin'),
  boot: { ...DECLARATION.boot, audio: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioFiles('nine-dragon-stack') },
  audio: { ...DECLARATION.audio, preload: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioCatalogue('nine-dragon-stack') },
  ktx2: () => import('./ktx2.generated'),
  ground: { terrain: TERRAIN, structures: true },
  forest: { ...DECLARATION.forest, density: () => 0 },
  sword: async () => {
    try { return await (await import('./vm/arms')).jianArms(); }
    catch (error) {
      console.warn('nine-dragon-stack: the arms rig did not load, the static jian stands in', error);
      return (await import('./world/jian')).jianSword();
    }
  },
  roster: async () => (await import('./roster')).ROSTER,
  render: async () => (await import('./look/render')).shardRender(),
};
// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NINE_DRAGON_STACK;
