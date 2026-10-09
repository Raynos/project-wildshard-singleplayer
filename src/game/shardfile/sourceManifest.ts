import type { ShardManifest } from '../shard/manifest';
import type { ShardContext } from '../shard/context';
import { parseShardSlug } from '../shard/slug';
import type { Shardfile } from './schema';
import { presentationCard } from './presentation';

/** Pure catalogue/level mapping from parsed data and already admitted immutable image bytes.
 * No fetch, browser decode, world allocation or service installation occurs here. Absent presentation keeps the empty card.
 * The caller owns asset admission and the library lease; the returned hooks enter the ordinary session later. */
export function sourceManifest(source: Pick<Shardfile, 'identity' | 'accent' | 'spawn' | 'look' | 'presentation'>, assets: ReadonlyMap<string, Uint8Array> = new Map()): ShardManifest {
  const presentation = source.presentation;
  const card = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
  return {
    api: 1, accent: source.accent, slug: parseShardSlug(source.identity.slug), name: source.identity.name, seed: source.identity.seed,
    order: 0, status: 'live', label: '(0, 0)', biome: presentation?.biome ?? 'Empty world', blurb: presentation?.blurb ?? 'An empty shardfile world.',
    card: presentation === undefined ? { thumb: card, portrait: card, landscape: card } : presentationCard(presentation, assets), style: 'greybox', kitLook: 'toon', hands: 'toon', weapon: 'custom',
    treeCount: 0, trees: { factory: 'none', noun: 'trees' }, ground: { structures: true, paths: 'plugin' }, horizon: { rings: [], cloudSea: false },
    spawn: { ...source.spawn }, spawns: [], species: [], uses: [], boundary: { visible: false },
    sky: { sunColor: [1, 1, 1], sunIntensity: 1, envIntensity: 0.5, bgIntensity: 1, fogSunColor: [1, 1, 1], cloudSunColor: [1, 1, 1], hemiSky: 0x9ca7b4, hemiGround: 0x606060, hemiIntensity: 0.7, sun: { azimuth: 35, elevation: 45 } },
    atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 1, 1] },
    grade: { saturation: source.look.grade.saturation - 1, brightness: 0, contrast: source.look.grade.contrast - 1, bloomIntensity: 0, bloomThreshold: 1, shadowTint: [1, 1, 1], highTint: [1, 1, 1], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
    budgets: {}, fight: {}, loadout: { weapons: [], tools: [], start: [] }, minimap: {},
    render: async () => source.look.keys.length === 0 ? (await import('./emptyLook')).emptyLook(source.look.dayOverride) : (await import('./look')).shardfileLook(source.look), tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
    audio: { ambience: 'none', score: 'none' },
    boot: { files: () => [], sources: () => ({ sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [] }), viewmodelSets: [], audio: () => Promise.resolve([]), precache: [] },
    // A plugin source enters the ordinary staged LevelLoader, even with no authored hooks.
    load: async () => { const { EmptyEquipment } = await import('./emptyEquipment'); return { default: class {
      kit(ctx: ShardContext): void {
        const runtime = ctx.game.runtime;
        if (runtime === undefined) throw new Error('Shardfile source requires the session host');
        runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), secondary: null, rifle: null });
      }
    } }; },
  };
}
