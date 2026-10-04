import { selectDuneRows } from './runtime/brains';
import { installLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { installSilentScore } from '@wildshard/kit/audio/forest';
import source from './shard.config';
import { Vector3 } from 'three';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { QuestState } from '@wildshard/engine/quest/core';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { STRINGS } from './strings';
import { buildWorld, FLAG, type SignalFire, type SignalWorld } from './world/build';
import { ownPrimitives } from './world/resources';
import { lastLightAll } from './look/light';
import { setDusk, stepDusk } from './look/dusk';
import { preloadDuneMeshes } from './world/meshes';
import { DUNE_RAY, DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest, MATRIARCH_FLAG } from './quest/install';
import { SCOUT_FLAG } from './quest/scout';
import { installSunscarCues } from './runtime/audio/cues';
import { installCreatures } from './combat/creatures';
import { SAND_SKITTERER, SAND_SKITTERER_LOOK } from './species/skitterer';
import { DUNE_STRIDER, DUNE_STRIDER_LOOK } from './species/strider';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from './species/matriarch';
import { installMatriarch, type DuneMatriarch } from './combat/matriarch';

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
    await preloadDuneMeshes();
    this.places = buildWorld(ctx, new Flags(ctx.manifest.slug)); this.fire = this.places.fire;
  }
  private brainPolicies: ReturnType<typeof selectDuneRows> = null;
  /** Actual instantiated declared policies, for the SF27 activation receipt; no actor state is changed. */
  brainWitness(): { id: string; kind: string; family: string | null }[] {
    return (this.creatures?.all() ?? []).filter(actor => actor.kind === 'duneRay' || actor.kind === 'duneStrider').map(actor => ({ id: actor.entityId, kind: actor.kind, family: this.brainPolicies?.witness(actor) ?? null }));
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW);
    this.brainPolicies = selectDuneRows(ctx);
    ctx.rows.species(this.brainPolicies?.rows ?? [DUNE_RAY, SAND_SKITTERER, DUNE_STRIDER, DUNE_MATRIARCH]); ctx.rows.speciesLook([DUNE_RAY_LOOK, SAND_SKITTERER_LOOK, DUNE_STRIDER_LOOK, DUNE_MATRIARCH_LOOK]);
    ctx.rows.encounter([{ id: 'sunscar.matriarch', displayName: STRINGS.matriarch }]);
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      this.whip = new Bullwhip(ctx.app, targets);
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: null, rifle: null, install: () => undefined });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, whip = this.whip;
    // loop 4: the style bible's dusk rim on the whip and glove too, so the weapon separates from the sand behind it
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); lastLightAll(whip.model, ctx.scope); ownPrimitives(whip.model, ctx.scope); }
    ctx.inputContext({ id: 'sunscar.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    if (rt?.play) { if (source.audio.score === 'silent') installSilentScore(rt.play.music, ctx.scope); installSunscarCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const places = this.places;
    const onCoin = loot?.purse ? (share: number): void => { loot.purse?.add(share); } : undefined;
    if (places) {
      this.quest = installQuest(ctx, position, places, onCoin).quest; this.whip?.aimAt(places.crackables);
      // The signal fire summons the Dune Matriarch from the basin (C5).
      const matriarch = installMatriarch(ctx, position, () => places.fire.lit, onCoin, () => { places.flags.set(MATRIARCH_FLAG); }); this.matriarch = matriarch.boss;
      places.fire.onLight = matriarch.summon;
    }
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['sunscar.complete'] : [];
    // The first frame looks a little down the spawn's slip face, over the dune rows to the tower (review H1).
    if (rt?.world) rt.world.player.pitch = -0.1;
    this.creatures = installCreatures(ctx, () => places !== null && !places.flags.has(SCOUT_FLAG));
    // The dusk deepens with the quest (E399, look/dusk.ts): a save loads at its step's light, play eases to each new one.
    if (places) {
      setDusk(duskOf(places), true);
      ctx.system({ id: 'sunscar.dusk', phase: 'update', run: (dt) => { setDusk(duskOf(places)); stepDusk(dt); } });
      ctx.scope.onDispose(() => { setDusk(0, true); });
    }
    ctx.debug.expose('sunscar', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SignalDunesPlugin;
