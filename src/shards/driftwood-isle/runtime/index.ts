import { driftwoodRows } from './boot/rows';
import { pageDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { buildProgress, type ShardContext, ShardPlugin } from '@wildshard/game/plugin/context';

import { STRINGS } from './strings';
import { buildDriftwoodWorld, keepDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { releaseDriftwoodCopies } from '../world/gpuOnlyCopies';
import { islandSystems } from './world/systems';
import { installAmbientFlock } from '@wildshard/sdk/looks/ambientFlock';
import { installDriftwoodAudio } from './audio/install';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { driftwoodDirectorBytes } from './director';
import type { Vector3 } from 'three';
import { SECTIONS } from './sections';
import { installDriftwoodAdventure } from '../quest/install';
import type { Adventure } from '../quest/adventure';
import { installDriftwoodCreatures } from '../creatures/install';
import { driftwoodLoadoutRows, clearDriftwoodDrop } from '../loadout/rows';
import { bindRuntimeEquipment } from '@wildshard/game/plugin/headless';
import { Sword } from '@wildshard/game/weapons/Sword';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { followToon } from './look/toon';

type World = NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;

type WorldBuilder = (world: World, viewer: () => Vector3, progress: ShardContext['progress']) => Promise<DriftwoodWorld>;
const PROBE_KEYS = ['ocean', 'pier', 'jetties', 'boat', 'hut', 'lookout', 'wreck', 'shrine', 'bushes', 'gulls', 'bridge', 'bridgeDeck', 'cove', 'enemies'] as const;

/** Driftwood owns its world, creatures, loadout, adventure and audio through scoped hooks. */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly build: WorldBuilder;
  private adventure: Adventure | null = null;
  /** `build` is injectable so the hook runs with a stub world in a node test (test/shards/driftwood-isle/plugin.test.ts) */
  constructor(build: WorldBuilder = (world, viewer, progress) => buildDriftwoodWorld(world, viewer, progress)) {
    super();
    this.build = build;
  }

  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const built = await this.build(world, shell.viewer, buildProgress(ctx));
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
    if (gulls !== null) installAmbientFlock(ctx, gulls, world.player);
  }

  override async kit(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood kit requires its world host');
    if (shell.world === null) throw new Error('Driftwood kit requires its world host');
    // the castaway arms' graph toon materials (data/fpArmsLook.ts), owned by this scope, lent before the swords and the
    // swimming hands are dressed (and any Model Explorer card)
    const arms = await runtimeLookMaterials(ctx, ctx.product.shardfile, true, Object.values(driftwoodRows('custom/fixedLayouts').nativeView.FP_ARMS_MATERIALS));
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded while compiling its arms');
    ctx.scope.onDispose((await import('./fpArms')).lendCastawayArms(arms, followToon(arms.toon)));
    installDriftwoodCreatures(ctx,await pageDecisionAuthority(ctx));
    const rows = driftwoodLoadoutRows(shell.world, shell, arms.materials, ctx.product.shardfile);
    ctx.rows.weapon(rows);
    const world = shell.world;
    shell.buildEquipment = bindRuntimeEquipment(ctx, ctx.product.shardfile, { factories: new Map([
      ['weapon.driftwood-isle.wood', { create: (_item, targets, nolock, viewmodel) => {
        if (viewmodel?.arms === undefined || viewmodel.ironArms === undefined) throw new Error('Driftwood requires both sword arms');
        const { ironArms: _iron, swim: _swim, ...woodArms } = viewmodel;
        return new Sword(world, targets, { row: rows[0], profile: rows[0], allowUnlocked: nolock, ...woodArms,
          ...(world.game.level.camera ? { portraitFov: world.game.level.camera.portraitFov } : {}) });
      } }],
      ['weapon.driftwood-isle.iron', { create: (_item, targets, nolock, viewmodel) => {
        if (viewmodel?.ironArms === undefined) throw new Error('Driftwood requires iron sword arms');
        return new Sword(world, targets, { row: rows[1], profile: rows[1], allowUnlocked: nolock, blade: 'iron', arms: viewmodel.ironArms });
      } }],
    ]) });
    ctx.scope.onDispose(() => { clearDriftwoodDrop(shell); });
    const quest = ctx.product.section('custom/questRows', SECTIONS); // the kit's rows from the product (W2b)
    ctx.rows.item(quest.items); ctx.rows.feat(quest.feats);
    const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
    ctx.rows.effect(economy.effects); ctx.rows.shop(economy.goods);
  }


  override async play(ctx: ShardContext): Promise<void> {
    await installDriftwoodAudio(ctx);
    // Warm the actual finale memory after audio, then install the same adventure in its owner.
    this.adventure = await withPreparedScriptMemories([driftwoodDirectorBytes()], ctx.scope,
      null, () => installDriftwoodAdventure(ctx));
    ctx.scope.onDispose(() => { this.adventure = null; });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
