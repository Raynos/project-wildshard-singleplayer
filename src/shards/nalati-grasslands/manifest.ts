import { declaredTreeSet, type ShardManifest } from '@wildshard/game/shard/manifest';
import { DECLARATION } from './boot/declaration.generated';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import geography from './boot/geography.generated.json' with { type: 'json' };
import { SEED, SPAWN, GROUND, groundColor, surfaceAt, forestMask, NALATI_MINIMAP } from './world/geography';
import discovery from './data/discovery.json' with { type: 'json' };

/** Fixed metadata and asset identities are compiled by the boot producer. */
export const NALATI_GRASSLANDS: ShardManifest = {
  ...DECLARATION,
  slug: 'nalati-grasslands',
  seed: SEED, spawn: SPAWN,
  navigation: { row: navigation.navigation, url: navigation.url },
  dev: { poses: () => Promise.resolve(Object.fromEntries(discovery.captureProbes.map(probe => [probe.name, {
    probe, eye: [probe.x, (NALATI_GRASSLANDS.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const,
    yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
  }]))) },
  load: async () => {
    const { default: Runtime } = await import('./runtime/index');
    return (await import('@wildshard/game/shard/declaredEntry')).declaredRuntimeEntry(Runtime, Runtime,
      { entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['world-bindings', 'kit'], features: ['weather.clock', 'held.mounted'] } });
  },
  trustedRuntime: { get slug() { return NALATI_GRASSLANDS.slug; }, entry: 'runtime/index.ts' },
  ktx2: () => import('./ktx2.generated'),
  render: async () => (await import('./look/render')).shardRender(),
  roster: async () => (await import('./roster')).ROSTER,
  minimap: { ...DECLARATION.minimap, palette: NALATI_MINIMAP },
  groundColor, surfaceAt,
  ground: GROUND,
  navmesh: { ground: { waterMargin: .25,wet: geography.channels.wet,wetThreshold: .5,trailClearance: 3.5 } },
  trees: { ...DECLARATION.trees, factory: declaredTreeSet('nalati-grasslands') },
  forest: { ...DECLARATION.forest, mask: forestMask },
};
// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NALATI_GRASSLANDS;
