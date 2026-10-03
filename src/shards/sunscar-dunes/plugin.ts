import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import { Vector3 } from 'three';
import { Flags, type Animal, type QuestState } from '#engine';
import { STRINGS } from './strings';
import { buildWorld, FLAG, type SignalFire, type SignalWorld } from './world/build';
import { ownPrimitives } from './world/resources';
import { lastLightAll } from './look/light';
import { preloadDuneMeshes } from './world/meshes';
import { DUNE_RAY, DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest, MATRIARCH_FLAG, SCOUT_FLAG } from './quest/install';
import { installSunscarCues } from './audio/cues';
import { installCreatures } from './combat/creatures';
import { SAND_SKITTERER, SAND_SKITTERER_LOOK } from './species/skitterer';
import { DUNE_STRIDER, DUNE_STRIDER_LOOK } from './species/strider';
import { DUNE_MATRIARCH, DUNE_MATRIARCH_LOOK } from './species/matriarch';
import { installMatriarch, type DuneMatriarch } from './combat/matriarch';

declare module '#engine' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}

export class SignalDunesPlugin extends ShardPlugin {
  readonly player = new Vector3(); whip: Bullwhip | null = null; quest: QuestState | null = null;
  fire: SignalFire | null = null; places: SignalWorld | null = null; creatures: ReturnType<typeof installCreatures> | null = null;
  matriarch: DuneMatriarch | null = null;
  /** The dune ray now flying (captures drive it). */
  get ray(): Animal | null { return this.creatures?.ray() ?? null; }
  /**
   * Quest state for a capture (E399, the mock-C-waymark view): sets the same flags a player sets in play, nothing else.
   * 'waymarks-lit': Sefa met, the logbook read, the oil taken and the three waymark braziers oiled and lit (the quest's
   * order: a player sees lit waymarks only after the steps before them).
   */
  stage(name: string): void {
    const places = this.places; if (!places) return;
    if (name === 'waymarks-lit') {
      for (const f of [SCOUT_FLAG, FLAG.logbook, FLAG.oil]) places.flags.set(f);
      for (const b of places.braziers) { b.oiled = true; b.light(); }
    }
  }
  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    // The generated models (C6) load behind the loading screen; the world and the strider's look read them synchronously.
    await preloadDuneMeshes();
    this.places = buildWorld(ctx, new Flags(ctx.manifest.slug)); this.fire = this.places.fire;
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW);
    ctx.rows.species([DUNE_RAY, SAND_SKITTERER, DUNE_STRIDER, DUNE_MATRIARCH]); ctx.rows.speciesLook([DUNE_RAY_LOOK, SAND_SKITTERER_LOOK, DUNE_STRIDER_LOOK, DUNE_MATRIARCH_LOOK]);
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
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installSunscarCues(rt.play.audio, rt.play.cues, ctx.scope); }
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
    ctx.debug.expose('sunscar', this);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SignalDunesPlugin;
