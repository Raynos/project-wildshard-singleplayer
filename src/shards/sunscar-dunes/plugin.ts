import { standaloneEntry } from './runtime/standalone';
import { speciesBrains, type SpeciesBrains } from '@wildshard/sdk/speciesBrains';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from './data/brains';
import { SKITTERER_DATA } from './data/species/skitterer';
import { DUNE_RAY } from './data/species/duneRay';
import { DUNE_STRIDER } from './data/species/strider';
import { installLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { bindRuntimeCoins, bindRuntimeItemContexts, bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import { installSilentScore } from '@wildshard/game/systems/audio/silentScore';
import source from './shard.config';
import { Vector3 } from 'three';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { QuestState } from '@wildshard/engine/quest/core';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { STRINGS } from './data/strings';
import { buildWorld, type SignalFire, type SignalWorld } from './world/build';
import { ownPrimitives } from './world/resources';
import { lastLightAll } from './look/light';
import { setDusk, stepDusk } from './look/dusk';
import { preloadDuneMeshes } from './world/meshes';
import { loadBakedWorld } from './world/baked';
import { DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW, whipIcon } from './weapons/rows';
import { installQuest } from './quest/install';
import { FACT, MATRIARCH_FLAG } from './quests/signal';
import { FLAG, SCOUT_FLAG } from './data/flags';
import { installSunscarCues } from './runtime/audio/cues';
import { installCreatures } from './combat/creatures';
import { SAND_SKITTERER_LOOK } from './species/skitterer';
import { DUNE_STRIDER_LOOK } from './species/strider';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from './species/matriarch';
import { installMatriarch, type DuneMatriarch } from './combat/matriarch';
import { SAND_TILES, SKIRT } from './look/render';

// the slot merges through @wildshard/engine (deep engine paths do not resolve); a program sees it only when it includes this file
declare module '@wildshard/engine/combat/Equipment' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}

/** The dusk a quest step has reached (look/dusk.ts): 0 at the start, deeper with each step, 1 once the signal burns. */
function duskOf(places: SignalWorld): number {
  const f = places.flags;
  if (f.has(FLAG.lit)) return 1;
  const lit = places.braziers.filter((b) => b.lit).length;
  if (lit > 0) return 0.5 + 0.12 * lit;
  // round 9 (seat B R8B-9: the logbook step's 0.32 under Sefa's 0.5 brightened the sky again in play): never lighter than the step before
  return f.has(FLAG.oil) ? 0.56 : f.has(FLAG.logbook) ? 0.52 : f.has(SCOUT_FLAG) ? 0.5 : 0;
}

export class SignalDunesPlugin extends ShardPlugin {
  readonly player = new Vector3(); whip: Bullwhip | null = null; quest: QuestState | null = null;
  fire: SignalFire | null = null; places: SignalWorld | null = null; creatures: ReturnType<typeof installCreatures> | null = null;
  matriarch: DuneMatriarch | null = null;
  /** The dune ray now flying (captures drive it). */
  get ray(): Animal | null { return this.creatures?.ray() ?? null; }
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
  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    // The generated models (C6) load behind the loading screen; the world and the strider's look read them synchronously.
    const [, baked] = await Promise.all([preloadDuneMeshes(), loadBakedWorld()]);
    this.places = buildWorld(ctx, new Flags(ctx.manifest.slug), baked); this.fire = this.places.fire;
    // G99: in a grid cell nothing draws past the cube (the dune skirt stops at its edge; the platform drops the ranges)
    if (ctx.cube !== null) SKIRT.fit(ctx.cube.half);
  }
  private brains: SpeciesBrains | null = null;
  /** Actual instantiated declared policies, for the SF27 activation receipt; no actor state is changed. */
  brainWitness(): { id: string; kind: string; family: string | null }[] {
    return (this.creatures?.all() ?? []).filter(actor => actor.kind === 'duneRay' || actor.kind === 'duneStrider').map(actor => ({ id: actor.entityId, kind: actor.kind, family: this.brains?.witness(actor) ?? null }));
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW);
    // SF27: the ray, the skitterer (an admitted species script), the strider and the Matriarch (species/matriarch.ts, a phased flyer) run their rows' declared brains
    const brains = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES); this.brains = brains;
    ctx.rows.species([{ ...DUNE_RAY, ...brains.bind(DUNE_RAY.kind) }, { ...SKITTERER_DATA, ...brains.bind(SKITTERER_DATA.kind) }, { ...DUNE_STRIDER, ...brains.bind(DUNE_STRIDER.kind) }, DUNE_MATRIARCH]); ctx.rows.speciesLook([DUNE_RAY_LOOK, SAND_SKITTERER_LOOK, DUNE_STRIDER_LOOK, DUNE_MATRIARCH_LOOK]);
    ctx.rows.encounter([{ id: 'sunscar.matriarch', displayName: STRINGS.matriarch }]);
    const rt = ctx.game.runtime;
    // SF50-p / M3: the whip is its shardfile's declared item row; the platform installs it, resolving this runtime's own family.
    if (rt) rt.buildEquipment = (targets) => {
      const items = bindRuntimeItems(ctx, source, { icon: whipIcon, families: new Map([['sunscar-dunes.whip', { kind: 'weapon', create: () => {
        const whip = new Bullwhip(ctx.app, targets); this.whip = whip;
        whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
        return whip;
      } }]]) });
      const primary = items.primary; if (primary === null) throw new Error('Signal Dunes declares its whip as the primary');
      return Promise.resolve({ primary, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, whip = this.whip;
    // loop 4: the style bible's dusk rim on the whip and glove too, so the weapon separates from the sand behind it
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); lastLightAll(whip.model, ctx.scope); ownPrimitives(whip.model, ctx.scope); }
    // the whip's declared input context (shard.config.ts items.contexts): while the cell is entered for a retained home
    bindRuntimeItemContexts(ctx, source);
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    if (rt?.play) {
      const play = rt.play;
      if (retainsRuntimeServices(ctx)) installEnteredRuntimeService(ctx, scope => {
        if (source.audio.score === 'silent') installSilentScore(play.music, scope);
        installSunscarCues(play.audio, play.cues, scope);
      });
      else { if (source.audio.score === 'silent') installSilentScore(play.music, ctx.scope); installSunscarCues(play.audio, play.cues, ctx.scope); }
    }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const places = this.places;
    // SF50-p: every coin the runtime pays goes through the platform purse (the level's loot purse; headless, the shard's).
    const coins = bindRuntimeCoins(ctx, loot?.purse ?? null);
    if (places) {
      // SF14 / SF50-p: the quest's and the Matriarch's feats are ledger facts; the platform grants their achievements once.
      const installed = installQuest(ctx, position, places, coins), facts = installed.facts;
      this.quest = installed.quest; this.whip?.aimAt(places.crackables);
      // The signal fire summons the Dune Matriarch from the basin (C5). A save that beat her before facts existed emits hers on load.
      const matriarch = installMatriarch(ctx, position, places.flags, () => places.fire.lit, coins, () => { places.flags.set(MATRIARCH_FLAG); facts(FACT.matriarch, 'sunscar.matriarch'); }); this.matriarch = matriarch.boss;
      places.fire.onLight = matriarch.summon;
    }
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['sunscar.complete'] : [];
    // The first frame looks a little down the spawn's slip face, over the dune rows to the tower (review H1).
    if (rt?.world) rt.world.player.pitch = -0.1;
    this.creatures = installCreatures(ctx, () => places !== null && !places.flags.has(SCOUT_FLAG));
    // The dusk deepens with the quest (E399, look/dusk.ts): a save loads at its step's light, play eases to each new one.
    if (places) {
      if (retainsRuntimeServices(ctx)) installEnteredRuntimeService(ctx, scope => {
        setDusk(duskOf(places), true);
        scope.onDispose(() => { setDusk(0, true); });
      });
      else { setDusk(duskOf(places), true); ctx.scope.onDispose(() => { setDusk(0, true); }); }
      ctx.system({ id: 'sunscar.dusk', phase: 'update', run: (dt) => { setDusk(duskOf(places)); stepDusk(dt); SAND_TILES.follow(position.x, position.z); } });
    }
    ctx.debug.expose('sunscar', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default standaloneEntry(SignalDunesPlugin);

/** Resolve only the declared first-party entry, preserving the standalone constructor. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return SignalDunesPlugin;
}
