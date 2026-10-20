import { installQuestCatalogue } from '@wildshard/game/quest/chapter';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { pageDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { buildProgress, type ShardContext, ShardPlugin } from '@wildshard/game/plugin/context';

import { buildDriftwoodWorld, keepDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { islandSystems } from './world/systems';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { installDriftwoodAudio } from './audio/install';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { readDirectorProduct } from '@wildshard/game/plugin/director';
import type { Vector3 } from 'three';
import { installDriftwoodAdventure } from '../quest/install';
import type { QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import { installDriftwoodCreatures } from '../creatures/install';
import { HeldClaims } from '@wildshard/game/loadout/claims';

type World = NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;

type WorldBuilder = (world: World, viewer: () => Vector3, progress: ShardContext['progress'], context: ShardContext) => Promise<DriftwoodWorld>;
const PROBE_KEYS = ['ocean', 'pier', 'jetties', 'boat', 'hut', 'lookout', 'wreck', 'shrine', 'bushes', 'gulls', 'bridge', 'bridgeDeck', 'cove', 'enemies'] as const;

/** Driftwood owns its world, creatures, loadout, adventure and audio through scoped hooks. */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly build: WorldBuilder;
  private adventure: Adventure | null = null;
  /** `build` is injectable so the hook runs with a stub world in a node test (test/shards/driftwood-isle/plugin.test.ts) */
  constructor(build: WorldBuilder = async (world, viewer, progress, context) => {
    const scenes = await installWorldScenes(context, context.product.section('world/scenes'));
    return buildDriftwoodWorld(world, viewer, progress, scenes);
  }) {
    super();
    this.build = build;
  }

  override async world(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const built = await this.build(world, shell.viewer, buildProgress(ctx), ctx);
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    keepDriftwoodWorld(shell, built);
    shell.hooks.meleeSilent = true;
    const { ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove } = built;
    Object.assign(shell.objects, { ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove });
    shell.hooks.spawnFloor = (x, z) => pier?.floorHeightAt(x, z);
    if (gulls !== null) shell.overhead.push(gulls.group);
    if (built.cover !== null) shell.overhead.push(built.cover.group);
    // the probe's `shard` handles (E405 AG25: the shard names its own; the engine's probe keeps no shard table), read
    // when the probe installs, so `enemies` (creatures hook) is there too
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({}, Object.fromEntries(PROBE_KEYS.map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
    shell.hooks.places = () => this.adventure?.places?.points ?? [];
    islandSystems<NonNullable<DriftwoodWorld['bridgeDeck']>>(ctx, world, built); // the island's per-frame work (./world/systems.ts)
    if (gulls !== null) await installPageLife(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('actors/page-life.json'))), null, null, new Map([['gulls', gulls]]));
  }

  override async kit(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood kit requires its world host');
    if (shell.world === null) throw new Error('Driftwood kit requires its world host');
    const held = await HeldClaims.prepare(ctx);
    await installDriftwoodCreatures(ctx,await pageDecisionAuthority(ctx));
    held.install();
    installQuestCatalogue(ctx);
    const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
    ctx.rows.effect(economy.effects); ctx.rows.shop(economy.goods);
  }


  override async play(ctx: ShardContext): Promise<void> {
    await installDriftwoodAudio(ctx);
    // Warm the actual finale memory after audio, then install the same adventure in its owner.
    const director = await readDirectorProduct(ctx.product, ctx.scope);
    this.adventure = await withPreparedScriptMemories([director.bytes], ctx.scope,
      null, () => installDriftwoodAdventure(ctx));
    ctx.scope.onDispose(() => { this.adventure = null; });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
