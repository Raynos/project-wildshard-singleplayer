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
  ktx2: () => import('./ktx2.generated'),
  ground: { terrain: TERRAIN, structures: true },
  forest: { ...DECLARATION.forest, density: () => 0 },
  sword: async () => (await import('@wildshard/game/systems/viewmodel/graphArms')).graphSword('nine-dragon-stack', 'weapons/jian-row.json'),
  roster: async () => (await import('./roster')).ROSTER,
  render: async () => (await import('./look/render')).shardRender(),
};
// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NINE_DRAGON_STACK;
