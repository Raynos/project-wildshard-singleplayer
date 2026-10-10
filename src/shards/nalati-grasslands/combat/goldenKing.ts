import { NALATI_STRIKES, sampleStrike, sampleArena } from './strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { listenPage } from '@wildshard/engine/input/dom';
import type { Player } from '@wildshard/engine/player/Player';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { encounterHit } from './damage';
import * as THREE from 'three';
import type { Bow } from '@wildshard/game/weapons/Bow';
import { phasedBossFight, type PhasedBossFight } from '@wildshard/sdk/phasedBoss';
import type { KurganEntrance } from '../world/KurganField';
import { GOLDEN_KING, bindGoldenKing } from '../species/goldenKing';
import { BALBAL as KURGAN_BALBAL } from '../species/balbal';
import { KurganDungeon, DUNGEON, CH, PEDESTAL, CHECKPOINT, DROMOS_SPAWN, DROMOS_END } from '../world/KurganDungeon';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { Boss, type BossDef, type BossPersistence } from '@wildshard/game/Boss';
import { GoldenBowPower, goldenBowModel } from '../runtime/weapons/GoldenBow';
import { KING_ENCOUNTER, KING_REWARD } from '../data/goldenKingFight';
import { GOLDEN_KING_ROW } from './goldenKingRow';
import { goldenKingViews } from './goldenKingViews';


/**
 * The Golden King fight (plan row B13; design docs/design/nalati/elites-and-bosses.md §2 "The Golden King fight, step by
 * step"; mockups art/nalati-grasslands/round-2/5-bosses/). Two pieces:
 *
 *   goldenKingFight — the platform phased boss fight (`@wildshard/sdk/phasedBoss`, SHARD-PLATFORM SF27) on his row
 *     (combat/goldenKingRow.ts) with the chamber's views (combat/goldenKingViews.ts): the King's brain (`bindGoldenKing`,
 *     the species forwards its 10 Hz tick here), his damage rule, the three phases and what each does to the room:
 *       I   "The King's Court" (100 → 60 %): he duels you on the open floor — the akinakes combo (14 / 14 / 22; the blade
 *           glints before each cut, the third's wide arc is painted on the floor) and the SUNBURST (sword up, gold spirals
 *           in, a gold ring races out across the floor from his feet — jump it: 25). Gold scale takes half from arrows,
 *           the face full (×2.5 headshot); every sabre / spear hit knocks plaques loose, and after six his chest takes
 *           arrows in full.
 *       II  "The Kurgan Wakes" (60 → 30 %): he staggers back to his coffin and kneels behind a dome of gold light
 *           (shielded — the bar shimmers). Two balbals step out of the wall niches, two more if you are slow; the dome
 *           holds while any stands. Sand pours through the ceiling where a gold shimmer marks it a second before, and
 *           drifts build (walking in sand halves your speed; the fallen beams and the coffin plinth are the high
 *           ground). The last balbal falls → the dome breaks, he is stunned 4 s, then fights until he kneels again.
 *       III "The Gold Burns" (30 → 0 %): he tears off his cloak — faster, a fourth strike, a DOUBLE sunburst. The
 *           looter's-hole light becomes a burning beam sweeping the floor on a gold line (15 to you; lure him through it:
 *           50 to him). His headdress glows: 200 hp of headshots knock it off and drop him to one knee for 3 s.
 *     Victory: he crumbles into a heap of gold plaques, the sand drains, the pedestal's shaft lights the Golden Bow.
 *
 *   KurganBoss — the glue `src/shards/nalati-grasslands/index.ts` wires: builds the interior (KurganDungeon), the doors (walk into the POI
 *     agent's dark passage in the mound → fade → the dromos; walk back out of the dromos → the mound's flank), hides the
 *     outdoor world and calms the steppe's animals while you are inside, the Boss + BossBar, the Golden Bow reward (and
 *     re-applies it at boot once owned), the dev hooks (`?boss=golden-king` starts at the chamber door; `&bossPhase=2|3`
 *     at that checkpoint; `window.__boss`).
 */

/** NALATI-MERGE F9: the chamber floor is level, and it is not the terrain. Animal.sampleTerrain tilts a body to the slope
 *  heightAt reads under it, and under the dungeon (140 m up, over the kurgan field's mound) that slope is steep: the King
 *  stood pitched ~44° and rolled ~26° through the whole fight (procedural and model alike). levelGround keeps him (and
 *  the balbal adds) upright; `sampleTerrain` re-zeroes the tilt spawn() already sampled. */
function standOnFloor(a: Animal): void { a.levelGround = true; a.sampleTerrain(); }

/** The arena strikes the fight's hazards resolve by name. */
const KING_HAZARDS: Readonly<Record<string, StrikeSpec>> = { sunburst: NALATI_STRIKES.sunburst, sand: NALATI_STRIKES.sand, beam: NALATI_STRIKES.beam };

/** What the Golden King fight is lent by the glue: the player, the animals, an optional body spawner, the player's hurt and the feed. */
export interface FightHost {
  player: Player;
  animals: AnimalManager;
  spawnKing?: () => Animal | null;
  /** the player takes `dmg` from the King / a hazard (routed to the shared damage pipeline) */
  hurt: (dmg: number, throughWalls?: boolean) => void;
  feed: (text: string) => void;
}

/** The Golden King fight: the platform phased fight on his row, its `BossScript`, his body and the glue's park / dev hooks. */
export interface GoldenKingFight {
  readonly phased: PhasedBossFight<Animal>;
  readonly script: BossScript;
  readonly king: () => Animal | null;
  /** park / unpark every fight animal (the player left / came back): out of the lists the HUD and the minimap read */
  readonly setPresent: (on: boolean) => void;
  /** dev: kill him now (screenshots of the victory) */
  readonly devKill: () => void;
}

/** The Golden King's fight in the kurgan chamber: his row on the platform phased boss fight, the chamber as its arena and views. */
export function goldenKingFight(dungeon: KurganDungeon, host: FightHost): GoldenKingFight {
  /** out of the fight for good: hidden, out of the animals list (the minimap, the harvest prompt, the aim assist) */
  const retire = (a: Animal): void => {
    a.hidden = true; a.mesh.visible = false;
    a.position.y = -9999;
    const list = host.animals.animals, i = list.indexOf(a);
    if (i !== -1) list.splice(i, 1);
    a.mesh.removeFromParent();
  };
  const phased: PhasedBossFight<Animal> = phasedBossFight<Animal>(GOLDEN_KING_ROW, {
    arena: {
      floorAt: dungeon.floorHeightAt,
      pile: (x, z, r, dh, cap) => { dungeon.addSand(x, z, r, dh, cap); },
      clear: () => { dungeon.clearSand(); },
      drain: (dt, rate) => { dungeon.drainSand(dt, rate); },
      inArena: (p) => dungeon.inChamber(p) && p.z - DUNGEON.z < CH - 1.1,
      seal: (on) => { dungeon.setSealed(on); },
    },
    body: {
      spawn: (x, z) => {
        const k = host.spawnKing === undefined ? host.animals.spawn(GOLDEN_KING, x, z, 0, 'king') : host.spawnKing();
        if (k === null) return null;
        k.herd = -1;
        standOnFloor(k);
        return k;
      },
      retire,
      bind: (a, brain) => { bindGoldenKing(a, { think: brain.think, act: brain.act, damageMul: brain.damageMul }); },
      ready: (k, floorY) => { k.yOffset = floorY - k.position.y; k.mesh.visible = true; },
    },
    spawnAdd: (_i, x, z, yaw) => {
      const a = host.animals.spawn(KURGAN_BALBAL, x, z, yaw, 'warrior');
      a.herd = -1;
      standOnFloor(a);
      const m = a.mem;
      m['floorY'] = DUNGEON.y; m['emergeT'] = 1.9;
      m['minX'] = DUNGEON.x - CH + 0.9; m['maxX'] = DUNGEON.x + CH - 0.9; m['minZ'] = DUNGEON.z - CH + 0.9; m['maxZ'] = DUNGEON.z + CH - 0.9;
      a.yOffset = DUNGEON.y - a.position.y;
      return a;
    },
    player: { get position() { return host.player.position; }, dash: (x, z, seconds) => { host.player.dash(x, z, seconds); } },
    hurt: (damage, throughWalls) => { host.hurt(damage, throughWalls); },
    cut: (i, a, onHit) => {
      const spec = NALATI_STRIKES.cuts[i] ?? NALATI_STRIKES.cuts[0], pl = host.player.position;
      return spec !== undefined && sampleStrike(spec, a, pl, onHit, { reach: () => canReach(a, pl, app.physics) });
    },
    hazard: (strike, from, onHit, opts) => {
      const spec = KING_HAZARDS[strike];
      if (spec === undefined) throw new Error(`Golden King: no arena strike ${strike}`);
      sampleArena(spec, from, host.player.position, onHit, app.physics, opts);
    },
    rng: () => app.rng.stream('ai').next(),
    feed: (line) => { host.feed(line); },
    views: goldenKingViews(dungeon, () => phased.body()),
    rewardPoint: () => dungeon.world(PEDESTAL.x, PEDESTAL.h + 0.02, PEDESTAL.z),
    respawnPoint: () => ({ pos: dungeon.world(CHECKPOINT.x, 0, CHECKPOINT.z), yaw: CHECKPOINT.yaw }),
  });
  const king = (): Animal | null => phased.body();
  return {
    phased, script: phased.script, king,
    setPresent: (on) => {
      const list = host.animals.animals;
      const mine: Animal[] = [];
      const k = king();
      if (k) mine.push(k);
      for (const a of phased.adds()) mine.push(a);
      for (const a of mine) {
        const i = list.indexOf(a);
        if (on && i === -1 && !a.hidden) { list.push(a); host.animals.group.add(a.mesh); }
        if (!on && i !== -1) { list.splice(i, 1); a.mesh.removeFromParent(); }
      }
    },
    devKill: () => { phased.kill(); },
  };
}

// ─────────────────────────────── the glue ───────────────────────────────

/** scene-root objects that stay on inside: the sky (the looter's hole shows it) and effects near the player */
const KEEP = /sky|planet|cloud|kurgan|projectile|arrow|arc|pickup|streak|csm|light/i;
function isTiny(o: THREE.Object3D): boolean {
  // a group of a few nodes near the dungeon (weapon effects, pickups): leave it alone
  const dx = o.position.x - DUNGEON.x, dy = o.position.y - DUNGEON.y, dz = o.position.z - DUNGEON.z;
  return dx * dx + dy * dy + dz * dz < 40 * 40;
}


export interface KurganPlay {
  persistence?: BossPersistence;
  animals: AnimalManager;
  spawnKing?: () => Animal | null;
  setWeaponsEnabled: (on: boolean) => void;
  bow: Bow | null;
  upgradeBow: (power: GoldenBowPower) => void;
  refill: () => void;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  pickupHum?: (inside: boolean) => void;
  params: URLSearchParams;
}

export interface KurganCtx { game: Game; sky: Sky; player: Player; entrance: KurganEntrance | null; registry: WorldRegistry }

/** Authored arena and reward adapter; the encounter clock is BossBrain. */
export class GoldenKing extends Boss {}

export class KurganBoss {
  readonly dungeon = new KurganDungeon();
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

  constructor(private readonly ctx: KurganCtx) {}

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
    this.golden = new GoldenBowPower({ scene: game.scene, sky, camera: game.camera, raycast: (o, d, max) => play.animals.raycast(o, d, max) });
    this.ui = new BossBar();
    this.fight = goldenKingFight(this.dungeon, {
      player, animals: play.animals,
      ...(play.spawnKing === undefined ? {} : { spawnKing: play.spawnKing }),
      hurt: (dmg, throughWalls) => { const k = this.fight?.king() ?? null; if (k) encounterHit(k, dmg, 'boss.golden-king', player.position, throughWalls); },
      feed: play.feed,
    });
    const def: BossDef = {
      ...KING_ENCOUNTER,
      reward: {
        ...KING_REWARD,
        model: () => goldenBowModel(sky),
        grant: () => { if (play.bow && this.golden) { play.upgradeBow(this.golden); } },
      },
    };
    this.boss = new GoldenKing(def, this.fight.script, {
      scene: game.scene, player, camera: game.camera, renderer: game.renderer, spareLight: this.spareLight,
      lockInput: (on) => { this.locked = on; play.setWeaponsEnabled(!on); this.applyMove(); },
      respawn: (pos, yaw) => { player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0; play.refill(); },
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      skipHeld: () => this.skipKeys || this.skipTouch || app.input.held('jump') || app.input.held('use'),
      toast: play.toast, feed: play.feed,
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    }, this.ui, 'nalati-grasslands', play.persistence);
    app.encounters.boss('golden-king', this.boss, game.levelScope);
    // the King starts outside every list until you walk in; the reward, once won, is yours at every boot
    this.fight.script.reset(0);
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
      this.enter(true, 13.2);
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.boss', this));
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
      this.inside = true; this.dungeon.inside = true;
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
      this.inside = false; this.dungeon.inside = false;
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
    if (!this.inside) {
      const e = this.ctx.entrance;
      if (e && this.boss) {
        const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
        const dx = p.x - e.x, dz = p.z - e.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
        if (lz > 0.8 && lz < 3 && Math.abs(lx) < 1.3 && Math.abs(p.y - e.y) < 1.5) this.enter();
      }
      return;
    }
    // inside
    if (!this.dungeon.inVolume(p)) { this.exit(false); return; }         // respawned elsewhere (a death outside the fight)
    const lz = p.z - DUNGEON.z;
    if (lz > DROMOS_END - 0.7 && this.boss?.engaged !== true) { this.exit(true); return; }
    // never below the dungeon floor: a drift that rises > 0.5 m under you in one step (a shove into a mound) is a platform
    // the Player refuses, and the terrain is 100 m down — lift the feet back onto the floor the same frame
    const fl = this.dungeon.floorHeightAt(p.x, p.z);
    if (fl !== undefined && p.y < fl - 0.02 && p.y > fl - 4) { p.y = fl; if (this.ctx.player.velocity.y < 0) this.ctx.player.velocity.y = 0; }
    // sand drifts slow you (the plinth, the beams and the pedestal step are the high ground)
    const lx = p.x - DUNGEON.x;
    const sand = this.dungeon.inChamber(p) ? this.dungeon.sandAt(lx, lz) : 0;
    const floor = this.dungeon.floorHeightAt(p.x, p.z) ?? DUNGEON.y;
    const onSand = sand > 0.12 && Math.abs(floor - (DUNGEON.y + sand)) < 0.05;
    if (onSand !== this.slow) { this.slow = onSand; this.applyMove(); }
    this.boss?.update(dt, t);
    this.dungeon.update(dt, t);
  }
}

/** the wiring's one call (src/shards/nalati-grasslands/index.ts): the interior built at boot, the fight bound later by main.ts */
export function wireKurgan(ctx: KurganCtx): KurganBoss { return new KurganBoss(ctx).build(); }
/** `wireKurgan`, its hidden static interior built a task apart per part (SF67: the load's long task) */
export function wireKurganSliced(ctx: KurganCtx, yieldTask: () => Promise<void>): Promise<KurganBoss> { return new KurganBoss(ctx).buildSliced(yieldTask); }
