import { ShardPlugin, installLoot, type ShardContext } from '#game';
import { installSilentScore } from '#kit';
import { Vector3 } from 'three';
import type { Animal, QuestState } from '#engine';
import { STRINGS } from './strings';
import { RAY_HOME, DECK } from './layout';
import { buildWorld, type BuiltWorld } from './world/build';
import { ownPrimitives } from './world/resources';
import { DUNE_RAY, DUNE_RAY_LOOK } from './species/duneRay';
import { Bullwhip } from './weapons/Bullwhip';
import { WHIP_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { installDunesCues } from './audio/cues';

declare module '#engine' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}
/** Seconds before a fallen dune ray is replaced by a new one circling home. */
const RAY_RESPAWN_MS = 25000;

export class SunscarDunesPlugin extends ShardPlugin {
  readonly player = new Vector3();
  whip: Bullwhip | null = null; quest: QuestState | null = null; built: BuiltWorld | null = null; lit = false;
  private flicker = 0;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS);
    this.built = buildWorld(ctx, () => { this.light(); });
    ctx.game.runtime?.interactables.push(this.built.interact);
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon(WHIP_ROW); ctx.rows.species(DUNE_RAY); ctx.rows.speciesLook(DUNE_RAY_LOOK);
    ctx.rows.spawnTable({ id: 'sunscar.rays', table: { mode: 'each', rows: [{ item: { kind: 'duneRay', variant: 'dusk' }, weight: 1 }] } });
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets) => {
      this.whip = new Bullwhip(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null);
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: null, rifle: null });
    };
  }
  override play(ctx: ShardContext): void {
    const host = ctx.app.equipmentHost, whip = this.whip, rt = ctx.game.runtime, built = this.built;
    if (host !== null && whip !== null) { host.viewmodel.add(whip.model); ctx.scope.onDispose(() => { whip.model.removeFromParent(); }); }
    if (whip) ownPrimitives(whip.model, ctx.scope);
    const position = rt?.world?.player.position ?? this.player;
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installDunesCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    const base = built?.base ?? new Vector3();
    const installed = installQuest(ctx, position, base, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined);
    this.quest = installed.quest;
    if (installed.lit()) this.light(true);
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['sunscar.complete'] : [];
    ctx.inputContext({ id: 'sunscar.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    const pin = document.createElement('span'); pin.textContent = STRINGS.tower; ctx.hud.pin(new Vector3(base.x, base.y + DECK.height + 4, base.z), pin);
    ctx.system({ id: 'sunscar.fire', phase: 'update', run: (dt) => {
      if (!this.lit || built === null) return;
      this.flicker += dt; const f = 0.85 + 0.15 * Math.sin(this.flicker * 13) * Math.sin(this.flicker * 7.3 + 1);
      built.light.intensity = 28 * f; built.fire.scale.set(1, 0.9 + 0.2 * f, 1);
    } });
    const flags = installed.flags;
    this.lightFlags = () => { flags.set('sunscar.tower'); flags.set('sunscar.fire'); };
    if (this.lit) this.lightFlags();
    const spawner = ctx.app.encounters.spawn('sunscar.rays', ctx.scope, { create: (entry, at) => rt?.play?.animals.spawn(entry.kind, at.x, at.z, at.yaw, entry.variant) ?? null,
      retire: (actor) => { if (actor) rt?.play?.animals.retire(actor); } });
    const spawnRay = (): void => { spawner.spawn({ tags: [] }, { ...RAY_HOME, yaw: 0 }, () => ctx.app.rng.stream('spawn').next()); };
    spawnRay();
    ctx.on('actor.died', ({ actor }) => {
      if (!actor.tags.includes('creature.duneRay')) return;
      ctx.scope.timeout(RAY_RESPAWN_MS, () => {
        const dead = rt?.play?.animals.animals.filter((a: Animal) => a.kind === 'duneRay' && !a.alive) ?? [];
        for (const a of dead) rt?.play?.animals.retire(a);
        spawnRay();
      });
    });
    ctx.debug.expose('sunscar', this);
  }
  private lightFlags: () => void = () => undefined;
  /** Light the brazier: flames and their light, the interact label, and the quest's two flags. */
  light(restore = false): void {
    const built = this.built; if (built === null || (this.lit && !restore)) return;
    this.lit = true; built.fire.visible = true; built.light.intensity = 28; built.interact.label = STRINGS.lit;
    this.lightFlags();
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default SunscarDunesPlugin;
