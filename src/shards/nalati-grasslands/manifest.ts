import { defineShard, type ShardManifest } from '@wildshard/game/shard/manifest';
import { ROWS,TERRAIN_ROWS } from './boot/declaration.generated';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import discovery from './data/discovery.json' with { type: 'json' };

/** Fixed metadata and asset identities are compiled by the boot producer. */
const BOUND = defineShard({
  ...ROWS,...TERRAIN_ROWS,slug: 'nalati-grasslands',
  navigation: { row: navigation.navigation,url: navigation.url },
  minimap: { ...ROWS.minimap,...TERRAIN_ROWS.minimap },
  trees: { ...ROWS.trees,factory: 'declared' },
}, {});
export const NALATI_GRASSLANDS: ShardManifest = {
  ...BOUND,
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
};
// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NALATI_GRASSLANDS;
