import * as v from "valibot";
import { RuntimeSchema, type RuntimeDeclaration } from "@wildshard/format/runtime";
import type { ShardManifest } from "../shard/manifest";
import type { ShardContext } from "./context";
import { parseShardSlug } from "../shard/slug";
import type { Shardfile } from "../shardfile/schema";
import { presentationCard } from "../shardfile/presentation";
import { buildYield } from "@wildshard/engine/core/workSlice";

/** Trusted composition-root binding; the declaration can select only the entry belonging to the same shard. */
export interface TrustedRuntimeEntry {
  readonly slug: string;
  readonly entry: string;
  readonly load: () => Promise<{ default: new () => ShardPlugin }>;
}
/** Resolve only explicitly registered first-party code. Neighbour preparation may import it without running hooks. */
export async function prepareTrustedRuntime(declaration: RuntimeDeclaration, slug: string, firstParty: boolean,
  entries: readonly TrustedRuntimeEntry[]): Promise<new () => ShardPlugin> {
  const parsed = v.parse(RuntimeSchema, declaration);
  if (!firstParty) throw new Error('Custom runtime requires a trusted first-party shard');
  const registered = new Map<string, TrustedRuntimeEntry[]>();
  for (const entry of entries) { const group = registered.get(entry.slug) ?? []; group.push(entry); registered.set(entry.slug, group); }
  const matches = (registered.get(slug) ?? []).filter((entry) => entry.entry === parsed.entry);
  if (matches.length !== 1) throw new Error('Runtime entry must have exactly one matching trusted shard binding');
  const match = matches[0];
  if (match === undefined) throw new Error('Missing trusted runtime entry');
  return (await match.load()).default;
}

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
    render: async () => source.look.keys.length === 0 ? (await import('../shardfile/emptyLook')).emptyLook(source.look.dayOverride) : (await import('../shardfile/look')).shardfileLook(source.look), tiers: { phone: { ao: false, godRays: false }, desktop: { ao: false, godRays: false } },
    audio: { ambience: 'none', score: 'none' },
    boot: { files: () => [], sources: () => ({ sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [] }), viewmodelSets: [], audio: () => Promise.resolve([]), precache: [] },
    // A plugin source enters the ordinary staged LevelLoader, even with no authored hooks.
    load: async () => { const { EmptyEquipment } = await import('../shardfile/emptyEquipment'); return { default: class {
      kit(ctx: ShardContext): void {
        const runtime = ctx.game.runtime;
        if (runtime === undefined) throw new Error('Shardfile source requires the session host');
        runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), secondary: null, rifle: null });
      }
    } }; },
  };
}

/** Staged trusted plugin hooks; invoked only by the owning session. */
export abstract class ShardPlugin {
  world?(ctx: ShardContext): Promise<void> | void;
  kit?(ctx: ShardContext): Promise<void> | void;
  play?(ctx: ShardContext): Promise<void> | void;
}

/**
 * End a stretch of a shard's world build (op-hitch45): `await worldBuildYield(ctx)` between pieces. A fresh timer task of
 * the shard's scope, or, in play with a frame due (the `buildPacing` Developer tool), a wait for the engine loop's next
 * drawn frame: a grid cell builds its world on the road, and WebKit draws no frame between back-to-back timer tasks.
 * Rejects once the shard's scope has closed (an unloaded cell stops building).
 */
export function worldBuildYield(ctx: Pick<ShardContext, 'scope'>): Promise<void> { return buildYield(ctx.scope); }
