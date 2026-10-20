import type { GoldenKingFight, KurganPlay, KurganCtx } from './bossBindings';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { weaponEffects } from '../boot/weaponEffects.generated';
import { weaponSpecimen } from '../weapons/loadout';
import { app } from '@wildshard/engine/app/runtime';
import { listenPage } from '@wildshard/engine/input/dom';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import * as THREE from 'three';
import { BALBAL as KURGAN_BALBAL } from '../species/balbal';
import layout from '../data/kurganLayout.generated.json' with { type: 'json' };
import { installBossEncounter, type Boss } from '@wildshard/game/Boss';
import { GoldenBowPower } from '../runtime/weapons/GoldenBow';
import type { KurganData } from './titanTypes';
import { bakedActorGeometry } from '../world/places';
import { BossArenaRoom, ArenaRoomPortal, arenaRoomFight, ArenaRoomSchema } from '@wildshard/game/boss/arenaRoom';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import * as v from 'valibot';


let preparedKing: KurganData | null = null;
function kingRows(): KurganData { if (preparedKing === null) throw new Error('King rows are not prepared'); return preparedKing; }
export async function prepareKurganRows(product: Pick<ShardProduct, 'json'>): Promise<void> { preparedKing = await product.json<KurganData>('combat/titan-fight.json'); }

const { DUNGEON } = layout;


// ─────────────────────────────── the glue ───────────────────────────────

export class KurganBoss {
  readonly dungeon: BossArenaRoom;
  readonly spareLight = new THREE.PointLight(0xffc860, 0, 1, 2);
  ui: BossBar | null = null;
  fight: GoldenKingFight | null = null;
  boss: Boss | null = null;
  golden: GoldenBowPower | null = null;
  /** the player is inside (the dromos or the chamber) */
  get inside(): boolean { return this.portal?.inside ?? false; }
  private portal: ArenaRoomPortal | null = null;
  private skipKeys = false; private skipTouch = false;

  constructor(private readonly ctx: KurganCtx, input: unknown) {
    const rows = v.parse(ArenaRoomSchema, input), scenes = [parsePrivateScene(rows.view.scene), parsePrivateScene(rows.view.static)];
    this.dungeon = new BossArenaRoom(rows, new Map(scenes.flatMap(scene => scene.nodes.flatMap(node => node.kind === 'mesh' ? [[node.geometry, bakedActorGeometry(node.geometry)]] as const : []))));
  }

  /** Boot collision, movables and light; Memory saver delays only the hidden static dressing until entry. */
  build(): this {
    this.dungeon.build(memorySaverOn());
    return this.attach();
  }

  /** `build`, the hidden static interior a few tasks later (SF67); the same dungeon */
  async buildSliced(yieldTask: () => Promise<void>): Promise<this> {
    const lazy = memorySaverOn();
    await this.dungeon.buildSliced(true, yieldTask); // its movables a piece a task, then the sand, FX and colliders
    await yieldTask();
    this.attach();
    if (!lazy) { await yieldTask(); await this.dungeon.buildStaticSliced(yieldTask); }
    return this;
  }

  private attach(): this {
    this.ctx.game.scene.add(this.dungeon.group);
    this.dungeon.register(this.ctx.registry);   // NALATI-MERGE P1: the interior's collision, the seal, the sand drifts
    this.spareLight.position.set(DUNGEON.x, DUNGEON.y - 30, DUNGEON.z);
    this.ctx.game.scene.add(this.spareLight);
    return this;
  }

  /** once the animals, weapons and HUD exist (main.ts → nalati.bindPlay) */
  bind(play: KurganPlay): void {
    this.portal = new ArenaRoomPortal({ game: this.ctx.game, player: this.ctx.player, animals: play.animals }, this.dungeon, kingRows().king.portal, ReturnProgram.page(kingRows().programs.rules, this.ctx.game.levelScope), this.ctx.entrance);
    const { game, sky, player } = this.ctx;
    // build the adds' model now, not mid-fight (a prewarm: a broken add rig must not take the whole boot down)
    try { play.animals.factory.model(KURGAN_BALBAL, 'warrior'); } catch (e) { console.warn('[kurgan] the balbal adds did not build', e); }
    this.golden = new GoldenBowPower({ multipliers: weaponEffects.multipliers, scene: game.scene, sky, camera: game.camera, raycast: (o, d, max) => play.animals.raycast(o, d, max) });
    const encounter = installBossEncounter({ definition: kingRows().king.encounter, reward: kingRows().king.reward }, () => {
      this.fight = arenaRoomFight(play.context, this.dungeon, kingRows().king.page);
      return this.fight.script;
    }, {
      game, player, spareLight: this.spareLight, scope: game.levelScope, chunkId: 'nalati-grasslands', interactables: play.interactables,
      reward: {
        model: () => weaponSpecimen('goldenBow', sky),
        grant: () => { if (play.bow && this.golden) { play.upgradeBow(this.golden); } },
      },
      lockInput: (on) => { this.portal?.setLocked(on); play.setWeaponsEnabled(!on); },
      respawn: (pos, yaw) => { player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0; play.refill(); },
      skipHeld: () => this.skipKeys || this.skipTouch || app.input.held('jump') || app.input.held('use'),
      toast: play.toast, feed: play.feed,
      ...(play.persistence === undefined ? {} : { persistence: play.persistence }),
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    });
    this.ui = encounter.ui; this.boss = encounter.boss;
    if (this.fight === null) throw new Error('Arena fight did not bind');
    this.portal.bind(this.boss, this.ui, this.fight);
    // the King starts outside every list until you walk in; the reward, once won, is yours at every boot
    encounter.fight.reset(0);
    this.fight.setPresent(false);
    if (this.boss.rewardTaken && play.bow) { play.upgradeBow(this.golden); }
    listenPage(game.levelScope, 'keydown', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = true; });
    listenPage(game.levelScope, 'keyup', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = false; });
    listenPage(game.levelScope, 'pointerdown', () => { this.skipTouch = true; });
    listenPage(game.levelScope, 'pointerup', () => { this.skipTouch = false; });
    listenPage(game.levelScope, 'pointercancel', () => { this.skipTouch = false; });
    game.app.addSystem({ id: 'shard.nalati-grasslands.bind', phase: 'update', after: ['hud.combat'], before: ['first hints', 'main.frame'], run: (dt) => this.golden?.update(dt) }, game.levelScope);
    // dev: `?boss=golden-king` — start at the chamber door; `&bossPhase=2|3` at that checkpoint
    if (play.params.get('boss') === 'golden-king') {
      const ph = Number(play.params.get('bossPhase') ?? '1');
      this.portal.enter(true, 13.2);
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
  }

  /** a death: in the fight → back at the checkpoint (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  update(dt: number, t: number): void { this.portal?.update(dt,t); }

}

/** the wiring's one call (src/shards/nalati-grasslands/index.ts): the interior built at boot, the fight bound later by main.ts */
/** `wireKurgan`, its hidden static interior built a task apart per part (SF67: the load's long task) */
export async function wireKurganSliced(ctx: KurganCtx, product: Pick<ShardProduct, 'json'>, yieldTask: () => Promise<void>): Promise<KurganBoss> { await prepareKurganRows(product); return new KurganBoss(ctx, kingRows().arenaRoom).buildSliced(yieldTask); }

