import { SIGNAL_RUNTIME_ROWS } from './data/runtimeRows';
import { whipIcon } from './weapons/rows';
import { firstPartyStandaloneEntry } from '@wildshard/game/shard/runtimeVariant';
import type { ScopedLoot } from '@wildshard/game/loot/runtime';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';
import { HybridRuntimePlugin, bindRuntimeCoins, bindRuntimeMelee, type HybridRuntimeRows, type HybridTargets } from '@wildshard/game/plugin/headless';
import source from './runtime/source';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { buildWorld, type SignalFire, type SignalWorld } from './world/build';
import { lastLightAll } from './look/light';
import { DUSK, setDusk, stepDusk } from './look/dusk';
import { preloadDuneMeshes, DUNE_LIBRARY } from './world/meshes';
import { loadBakedWorld } from './world/baked';
import { createWhip, type Bullwhip } from './runtime/items/heldWhip';
import { installQuest } from './quest/install';
import { FLAG, SCOUT_FLAG } from './data/flags';
import { bindDeclaredFight, bindPageQuestStages } from '@wildshard/game/plugin/ui';
import { SAND, SKIRT } from './look/render';
import { lentMaterial } from './runtime/looks/bakedGround';
import { prepareFireFx } from './world/fireFx';

type ShardContext = Parameters<HybridRuntimePlugin['world']>[0];

/** The dusk a quest step has reached (look/dusk.ts): 0 at the start, deeper with each step, 1 once the signal burns. */
function duskOf(places: SignalWorld): number {
  const f = places.flags;
  if (f.has(FLAG.lit)) return 1;
  const lit = places.braziers.filter((b) => b.lit).length;
  if (lit > 0) return 0.5 + 0.12 * lit;
  // round 9 (seat B R8B-9: the logbook step's 0.32 under Sefa's 0.5 brightened the sky again in play): never lighter than the step before
  return f.has(FLAG.oil) ? 0.56 : f.has(FLAG.logbook) ? 0.52 : f.has(SCOUT_FLAG) ? 0.5 : 0;
}

export class SignalDunesPlugin extends HybridRuntimePlugin {
  whip: Bullwhip | null = null;
  fire: SignalFire | null = null; places: SignalWorld | null = null;
  // SF27: the ray, the skitterer (an admitted species script), the strider and the Matriarch (species/matriarch.ts, a phased flyer) run their rows' declared brains
  protected readonly rows: HybridRuntimeRows = { ...SIGNAL_RUNTIME_ROWS, source };
  /**
   * Quest state for a capture (E399; council round 1: run the player's own path, every side effect with it). Each step is
   * what play does: Sefa's first talk sets her flag (her dialogue's only effect), the logbook's interact, the crank's
   * pull and the jar's interact at the well, then per waymark the oil poured by hand and the crack that lights it.
   * 'logbook': Sefa met (mock-B-logbook: the tracker at the logbook step). 'waymarks-lit': every step to the three lit
   * waymarks, in the quest's order (mock-C-waymark). The dusk settles at the step before the last action (a player who
   * waited there), and the last action's dusk then eases in as play eases it (round 7, seat A R7-A-P1: snapping straight
   * to the three-lit dusk showed the last light's fresh notices under a dusk play only reaches 6 s later).
   */
  stage(name: string): void {
    const places = this.places; if (!places) return;
    const steps = ['logbook', 'waymarks-lit'], upTo = steps.indexOf(name); if (upTo === -1) return;
    places.flags.set(SCOUT_FLAG);
    if (upTo < 1) { setDusk(duskOf(places), true); return; }
    places.logbook.onInteract();
    places.well.pull(); places.well.spot.onInteract();
    const last = places.braziers[places.braziers.length - 1];
    for (const b of places.braziers) if (b !== last) { b.spot.onInteract(); b.light(); }
    setDusk(duskOf(places), true);
    if (last) { last.spot.onInteract(); last.light(); }
  }
  protected override async build(ctx: ShardContext): Promise<void> {
    // The generated models (C6) load behind the loading screen; the world and the strider's look read them synchronously.
    const [, baked] = await Promise.all([preloadDuneMeshes(), loadBakedWorld()]);
    await prepareFireFx(ctx, source, DUNE_LIBRARY.geometry);
    this.places = buildWorld(ctx, new Flags(ctx.manifest.slug), baked); this.fire = this.places.fire;
    // G345: the data client draws the tiles in the look's sand and lends it: the skirt wears it, the fires light it, and
    // its dusk curves read DUSK (the host field shared.dusk). In a grid cell the region lends it the same way.
    const sand = lentMaterial(source, 'pbr', ctx.scope, (scope, name) => (scope === 'shared' && name === 'dusk' ? DUSK.value : undefined));
    if (sand !== null) {
      // the sky's cascades on the sand, as the level painter's terrain group had them (the data client's tiles have none)
      ctx.game.runtime?.world?.sky.setupMaterial(sand);
      SAND.material = sand; SKIRT.wear(sand, source.terrain?.order);
      ctx.scope.onDispose(() => { if (SAND.material === sand) SAND.material = null; });
    }
    // G99: in a grid cell nothing draws past the cube (the dune skirt stops at its edge; the platform drops the ranges)
    if (ctx.cube !== null) SKIRT.fit(ctx.cube.half);
  }
  // SF50-p / M3: the whip is its shardfile's declared item row; the platform installs it, resolving this runtime's own family.
  protected override arm(ctx: ShardContext, targets: HybridTargets): Bullwhip {
    const whip = bindRuntimeMelee(ctx, source, {icon:whipIcon,create:(_row,spec,ports)=>createWhip(ctx.app,targets,ports.contacts,spec.charge)});
    this.whip = whip; return whip;
  }
  protected override armed(): Bullwhip | null { return this.whip; }
  // loop 4: the style bible's dusk rim on the whip and glove too, so the weapon separates from the sand behind it
  protected override dress(ctx: ShardContext): void { const whip = this.whip; if (whip !== null) { lastLightAll(whip.model, ctx.scope); ctx.scope.ownPrimitives(whip.model); } }
  protected override install(ctx: ShardContext, loot: ScopedLoot | null): void {
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player, places = this.places;
    // SF50-p: every coin the runtime pays goes through the platform purse (the level's loot purse; headless, the shard's).
    const coins = bindRuntimeCoins(ctx, loot?.purse ?? null);
    if (places) {
      // SF14 / SF50-p: the quest's and the Matriarch's feats are ledger facts; the platform grants their achievements once.
      const installed = installQuest(ctx, position, places, coins), facts = installed.facts;
      this.quest = installed.quest; this.whip?.aimAt(places.crackables);
      // The signal fire summons the Dune Matriarch from the basin (C5). A save that beat her before facts existed emits hers on load.
      const fight = bindDeclaredFight(ctx, this.rows.fight, { kind: 'spawned', source, player: position, flags: places.flags, facts, coins, armed: places.fire.lit,
        dress: animal => { lastLightAll(animal.mesh, ctx.scope); } }); this.presentedBoss = fight.boss;
      const stages = bindPageQuestStages(ctx, source, { flags: places.flags,
        bindings: new Map([['sunscar.signal-fire', [{ action: { spawn: 'sunscar.matriarch' }, run: fight.summon }]]]) });
      places.fire.onLight = () => { stages.advance('sunscar.signal-fire'); };
    }
    this.populate(ctx, source, { spawned: animal => { lastLightAll(animal.mesh, ctx.scope); }, flags: places?.flags ?? null });
    // The dusk deepens with the quest (E399, look/dusk.ts): a save loads at its step's light, play eases to each new one.
    if (places) {
      installEnteredRuntimeService(ctx, scope => { setDusk(duskOf(places), true); scope.onDispose(() => { setDusk(0, true); }); });
      ctx.system({ id: 'sunscar.dusk', phase: 'update', run: (dt) => { setDusk(duskOf(places)); stepDusk(dt); } });
    }
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default firstPartyStandaloneEntry(SignalDunesPlugin, 'Signal Dunes', () => import('./runtime/source'), () => import('./runtime/index'));

/** Resolve only the declared first-party entry, preserving the standalone constructor. */
export function resolveTrustedRuntime(entry: string): typeof SignalDunesPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return SignalDunesPlugin;
}
