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
import { BossArenaRoom, arenaRoomFight, ArenaRoomSchema } from '@wildshard/game/boss/arenaRoom';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import * as v from 'valibot';


let preparedKing: KurganData | null = null;
function kingRows(): KurganData { if (preparedKing === null) throw new Error('King rows are not prepared'); return preparedKing; }
export async function prepareKurganRows(product: Pick<ShardProduct, 'json'>): Promise<void> { preparedKing = await product.json<KurganData>('combat/titan-fight.json'); }

const { DUNGEON, DROMOS_SPAWN, DROMOS_END } = layout;


// ─────────────────────────────── the glue ───────────────────────────────

/** scene-root objects that stay on inside: the sky (the looter's hole shows it) and effects near the player */
const KEEP = /sky|planet|cloud|kurgan|projectile|arrow|arc|pickup|streak|csm|light/i;
function isTiny(o: THREE.Object3D): boolean {
  // a group of a few nodes near the dungeon (weapon effects, pickups): leave it alone
  const dx = o.position.x - DUNGEON.x, dy = o.position.y - DUNGEON.y, dz = o.position.z - DUNGEON.z;
  return dx * dx + dy * dy + dz * dz < 40 * 40;
}







export class KurganBoss {
  readonly dungeon: BossArenaRoom;
  readonly spareLight = new THREE.PointLight(0xffc860, 0, 1, 2);
  ui: BossBar | null = null;
  fight: GoldenKingFight | null = null;
  boss: Boss | null = null;
  golden: GoldenBowPower | null = null;
  /** the player is inside (the dromos or the chamber) */
  inside = false;
  private play: KurganPlay | null = null;
  private hidden: THREE.Object3D[] = [];
  private fadeT = -1;
  private calmWas = false;
  private locked = false; private slow = false;
  private skipKeys = false; private skipTouch = false;
  private decisionT = 0;
  private readonly author: ReturnProgram;

  constructor(private readonly ctx: KurganCtx, input: unknown) {
    this.author = ReturnProgram.page(kingRows().programs.rules, ctx.game.levelScope);
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
    this.play = play;
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
      lockInput: (on) => { this.locked = on; play.setWeaponsEnabled(!on); this.applyMove(); },
      respawn: (pos, yaw) => { player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0; play.refill(); },
      skipHeld: () => this.skipKeys || this.skipTouch || app.input.held('jump') || app.input.held('use'),
      toast: play.toast, feed: play.feed,
      ...(play.persistence === undefined ? {} : { persistence: play.persistence }),
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    });
    this.ui = encounter.ui; this.boss = encounter.boss;
    // the King starts outside every list until you walk in; the reward, once won, is yours at every boot
    encounter.fight.reset(0);
    this.fight?.setPresent(false);
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
      this.enter(true, 13.2);
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
  }

  /** a death: in the fight → back at the checkpoint (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  private applyMove(): void {
    const want = this.locked ? 0 : this.slow ? 0.5 : 1;
    if (this.ctx.player.moveScale !== want) this.ctx.player.moveScale = want;
  }

  /** into the dromos (from the mound's door, or `?boss=`) */
  private enter(immediate = false, atZ = DROMOS_SPAWN.z): void {
    const { player, game } = this.ctx;
    const play = this.play;
    if (!play || !this.boss || !this.fight) return;
    const go = () => {
      this.dungeon.world(DROMOS_SPAWN.x, 0, atZ, player.position);
      player.velocity.set(0, 0, 0); player.yaw = DROMOS_SPAWN.yaw; player.pitch = 0;
      this.inside = true;
      this.dungeon.setVisible(true);
      // the outdoor world goes dark (sealed interior: nothing out there can be seen) — everything at the scene root
      // but the interior, the animals, the camera (the viewmodel), the lights and the sky
      this.hidden = [];
      for (const o of game.scene.children) {
        if (!o.visible || o === this.dungeon.group || o === play.animals.group || o === game.camera || o instanceof THREE.Light || KEEP.test(o.name) || o.type === 'Points' || isTiny(o)) continue;
        o.visible = false; this.hidden.push(o);
      }
      this.calmWas = play.animals.calm; play.animals.calm = true;
      this.fight?.setPresent(true);
      this.boss?.arm();
    };
    if (immediate) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }
  private pending: (() => void) | null = null;

  /** back out onto the mound's flank */
  private exit(teleport: boolean): void {
    const { player } = this.ctx;
    const play = this.play;
    const go = () => {
      if (teleport) {
        const e = this.ctx.entrance;
        if (e) {
          const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
          player.position.set(e.x + fx * 2.4, e.y, e.z + fz * 2.4);
          player.yaw = e.facing; player.pitch = 0; player.velocity.set(0, 0, 0);
        }
      }
      this.inside = false;
      this.dungeon.setVisible(false);
      for (const o of this.hidden) o.visible = true;
      this.hidden = [];
      if (play) play.animals.calm = this.calmWas;
      this.boss?.disarm();
      this.fight?.setPresent(false);
      this.slow = false; this.locked = false; this.applyMove();
    };
    if (!teleport) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }

  update(dt: number, t: number): void {
    const p = this.ctx.player.position;
    // the door fades: black → move → back
    if (this.fadeT >= 0) {
      this.fadeT -= dt;
      if (this.fadeT < 0) { const go = this.pending; this.pending = null; go?.(); this.ui?.fade(false, 420); }
      return;
    }
    this.decisionT += dt;
    if (this.decisionT >= .1 - 1e-9) {
      const e = this.ctx.entrance, localZ = p.z - DUNGEON.z;
      const sand = this.dungeon.inChamber(p) ? this.dungeon.sandAt(p.x - DUNGEON.x, localZ) : 0;
      const result = this.author.project('kingDoor', { px: p.x, pz: p.z, y: p.y, ex: e?.x ?? 0, ey: e?.y ?? 0, ez: e?.z ?? 0, facing: e?.facing ?? 0,
        volume: Number(this.dungeon.inVolume(p)), inside: Number(this.inside), corridor: localZ, land: DROMOS_END, engaged: Number(this.boss?.engaged === true),
        sand, floor: this.dungeon.floorHeightAt(p.x, p.z) ?? DUNGEON.y, cy: DUNGEON.y });
      this.decisionT = 0;
      if (!this.inside) { if (e && this.boss && result['enter'] === 1) this.enter(); }
      else if (result['exit'] !== 0) { this.exit(result['exit'] === 2); return; }
      if (this.inside) { this.slow = result['slow'] === 1; this.applyMove(); }
    }
    if (!this.inside) return;
    // never below the dungeon floor: a drift that rises > 0.5 m under you in one step (a shove into a mound) is a platform
    // the Player refuses, and the terrain is 100 m down — lift the feet back onto the floor the same frame
    const fl = this.dungeon.floorHeightAt(p.x, p.z);
    if (fl !== undefined && p.y < fl - 0.02 && p.y > fl - 4) { p.y = fl; if (this.ctx.player.velocity.y < 0) this.ctx.player.velocity.y = 0; }
    this.boss?.update(dt, t);
    this.dungeon.update(dt, t);
  }
}

/** the wiring's one call (src/shards/nalati-grasslands/index.ts): the interior built at boot, the fight bound later by main.ts */
/** `wireKurgan`, its hidden static interior built a task apart per part (SF67: the load's long task) */
export async function wireKurganSliced(ctx: KurganCtx, product: Pick<ShardProduct, 'json'>, yieldTask: () => Promise<void>): Promise<KurganBoss> { await prepareKurganRows(product); return new KurganBoss(ctx, kingRows().arenaRoom).buildSliced(yieldTask); }

