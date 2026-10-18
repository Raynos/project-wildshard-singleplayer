import SIGNAL_RUNTIME_ROWS from './data/runtimeRows.generated.json' with { type: 'json' };
import { settleWeatherFields } from '@wildshard/game/plugin/weather';
import { runtimePresentation } from '@wildshard/game/shardfile/runtimeProduct';
import { HybridRuntimePlugin, type HybridRuntimeRows } from '@wildshard/game/plugin/headless';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { buildWorld, type SignalFire, type SignalWorld } from './world/build';
import { lastLightAll } from './look/light';
import { DUNE_LIBRARY } from './world/meshes';
import { WORLD } from './world/baked';
import { WHIP_HELD_OWNERS, type Bullwhip } from './runtime/items/heldWhip';

type ShardContext = Parameters<HybridRuntimePlugin['world']>[0];

export class SignalDunesPlugin extends HybridRuntimePlugin {
  declare readonly whip: Bullwhip | null;
  fire: SignalFire | null = null; places: SignalWorld | null = null;
  // SF27: the ray, the skitterer (an admitted species script), the strider and the Matriarch (species/matriarch.ts, a phased flyer) run their rows' declared brains
  protected rows(product: ShardProduct): HybridRuntimeRows {
    const { page, program } = product.section('actors/species-programs');
    const stages = product.section('quests/directors').directors?.find(row => row.id === SIGNAL_RUNTIME_ROWS.fight.stages.id);
    if (program === undefined || stages === undefined) throw new Error('Missing admitted species program or boss stages');
    return { ...SIGNAL_RUNTIME_ROWS, strings: product.section('ui/strings'), fight: { ...SIGNAL_RUNTIME_ROWS.fight, stages }, species: { ...SIGNAL_RUNTIME_ROWS.species, page, program }, owners: { ...WHIP_HELD_OWNERS, models: DUNE_LIBRARY, looks: { dress: lastLightAll } } }; }
  protected override async build(ctx: ShardContext): Promise<void> {
    const source = ctx.product.shardfile;
    // The generated models (C6) load behind the loading screen; the world and the strider's look read them synchronously.
    const [, baked] = await Promise.all([DUNE_LIBRARY.preload(), WORLD.load()]);
    this.places = buildWorld(ctx, new Flags(ctx.manifest.slug), baked, this.keepClientChannels.bind(this, ctx)); this.fire = this.places.fire;
    // Preserve the original cascade binding on the one shared sand material.
    const sand = runtimePresentation(source)?.material('pbr') ?? null;
    if (sand !== null) {
      // the sky's cascades on the sand, as the level painter's terrain group had them (the data client's tiles have none)
      ctx.game.runtime?.world?.sky.setupMaterial(sand);
    }
  }
  // loop 4: the style bible's dusk rim on the whip and glove too, so the weapon separates from the sand behind it
  protected override dress(ctx: ShardContext): void { const whip = this.whip; if (whip !== null) { lastLightAll(whip.model, ctx.scope); ctx.scope.ownPrimitives(whip.model); } }
  /** Settle the actual quest look for its declared capture checkpoint. */
  settleQuestDusk(): void { const places = this.places; if (places !== null) settleWeatherFields('sunscar-dunes', places.flags.all); }
  protected override async install(ctx: ShardContext): Promise<void> {
    const source = ctx.product.shardfile;
    const places = this.places;
    if (places) {
      // SF14 / SF50-p: the quest's and the Matriarch's feats are ledger facts; the platform grants their achievements once.
      if (this.whip !== null) places.contacts.bindWorldTargets(this.whip);
      // The signal fire summons the Dune Matriarch from the basin (C5). A save that beat her before facts existed emits hers on load.
      await this.bindPageFight(ctx);
    }
    this.populate(ctx, source, { spawned: animal => { lastLightAll(animal.mesh, ctx.scope); }, flags: places?.flags ?? null });

  }
}
