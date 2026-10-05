import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { STRINGS } from '../strings';
import { buildDriftwoodWorld, keepDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { releaseDriftwoodCopies } from '../world/gpuOnlyCopies';
import { islandSystems } from '../world/systems';
import { installDriftwoodAudio } from './audio/install';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { Vector3 } from 'three';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../quest/rows';
import { DRIFTWOOD_EFFECTS } from '../loot/effects';
import { GOODS } from '../loot/shop';
import { installDriftwoodAdventure } from '../quest/install';
import type { Adventure } from '../quest/adventure';
import { installDriftwoodCreatures } from '../creatures/install';
import { driftwoodLoadoutRows, installDriftwoodLoadout, clearDriftwoodDrop } from '../loadout/rows';

type WorldBuilder = (world: World, viewer: () => Vector3) => Promise<DriftwoodWorld>;
const PROBE_KEYS = ['ocean', 'pier', 'jetties', 'boat', 'hut', 'lookout', 'wreck', 'shrine', 'bushes', 'gulls', 'bridge', 'bridgeDeck', 'cove', 'enemies'] as const;

/** Driftwood owns its world, creatures, loadout, adventure and audio through scoped hooks. */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly build: WorldBuilder;
  private adventure: Adventure | null = null;
  /** `build` is injectable so the hook runs with a stub world in a node test (test/shards/driftwood-isle/plugin.test.ts) */
  constructor(build: WorldBuilder = (world, viewer) => buildDriftwoodWorld(world, viewer)) {
    super();
    this.build = build;
  }

  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const built = await this.build(world, shell.viewer);
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    // G144 / G173 (E450): the built world's vertex data on the GPU only (../world/gpuOnlyCopies.ts), before the first
    // frame: each copy goes as it uploads
    releaseDriftwoodCopies(built);
    keepDriftwoodWorld(shell, built);
    shell.hooks.meleeSilent = true;
    const { ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove } = built;
    Object.assign(shell.objects, { ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove });
    shell.hooks.spawnFloor = (x, z) => pier?.floorHeightAt(x, z);
    if (gulls !== null) shell.overhead.push(gulls.group);
    if (built.cover !== null) shell.overhead.push(built.cover.group);
    ctx.debug.expose('driftwood', shell);
    // the probe's `shard` handles (E405 AG25: the shard names its own; the engine's probe keeps no shard table), read
    // when the probe installs, so `enemies` (creatures hook) is there too
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, Object.defineProperties({}, Object.fromEntries(PROBE_KEYS.map((key) => [key, { enumerable: true, get: () => shell.objects[key] }]))));
    shell.hooks.places = () => this.adventure?.places?.points ?? [];
    islandSystems<NonNullable<DriftwoodWorld['bridgeDeck']>>(ctx, world, built); // the island's per-frame work (./world/systems.ts)
  }

  override kit(ctx: ShardContext): void {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood kit requires its world host');
    if (shell.world === null) throw new Error('Driftwood kit requires its world host');
    this.installCreatures(ctx);
    const rows = driftwoodLoadoutRows(shell.world, shell);
    ctx.rows.weapon(rows); installDriftwoodLoadout(shell.world, shell, rows);
    ctx.scope.onDispose(() => { clearDriftwoodDrop(shell); });
    ctx.rows.item(DRIFTWOOD_ITEMS); ctx.rows.feat(DRIFTWOOD_FEATS);
    ctx.rows.effect(DRIFTWOOD_EFFECTS); ctx.rows.shop(GOODS);
  }

  /** SF27: the hybrid subclass selects admitted decisions; the ordinary entry keeps the shipping species rows. */
  protected installCreatures(ctx: ShardContext): void { installDriftwoodCreatures(ctx); }

  override async play(ctx: ShardContext): Promise<void> {
    await installDriftwoodAudio(ctx);
    this.adventure = await installDriftwoodAdventure(ctx);
    ctx.scope.onDispose(() => { this.adventure = null; });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
