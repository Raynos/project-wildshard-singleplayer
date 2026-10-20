import type { Scope } from '@wildshard/engine/app/scope';
import { BossBrain, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { app } from '@wildshard/engine/app/runtime';
import type { Player } from '@wildshard/engine/player/Player';
import { WeaponPickup } from '@wildshard/engine/player/WeaponPickup';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { bossesSave, saveSlug } from './saves';
import * as THREE from 'three';
import * as v from 'valibot';
import type { ShardContext } from './plugin/context';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { canReach } from '@wildshard/engine/ai/reach';
import { CameraFX } from '@wildshard/engine/player/CameraFX';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import type { ItemId } from './Inventory';
import type { SkinId } from '@wildshard/engine/player/Skins';
import { HeldFinishes } from './loadout/finishes';
import { BossCombatSessionSchema } from '@wildshard/format/bossEncounter';

/** Client-only combat effects over the entered player, equipment and mixer.
 * Content supplies ids and policy values; callbacks, renderers and save owners
 * are never author inputs. Existing encounters retain their own update phase. */
export class PageCombatSession {
  readonly context;
  private readonly legsOwner;
  private readonly equipment;
  private readonly rows;
  private introLock = false;
  private bank: DeclaredSoundBank | null = null;
  private readonly owner: ShardContext;
  constructor(owner: ShardContext, input: unknown) {
    this.owner = owner;
    const rows = this.rows = v.parse(BossCombatSessionSchema, input), runtime = owner.game.runtime, world = runtime?.world, play = runtime?.play;
    if (owner.scope.disposed || world === undefined || world === null || play === undefined || play === null) throw new Error('Combat session requires its entered player');
    const { game, sky, player } = world, { animals } = play, direction = new THREE.Vector3();
    this.legsOwner = player; this.equipment = play.weapons;
    this.context = {
      game, sky, player, animals, god: rows.god,
      reach: (actor: Animal, target: { x: number; y: number; z: number }) => canReach(actor, target, owner.app.physics),
      hurt: (actor: Animal, amount: number, throughWalls = false): void => {
        const target = owner.app.player;
        if (owner.scope.disposed || rows.god || target === null || (!throughWalls && !canReach(actor, player.position, owner.app.physics))) return;
        owner.app.combat.hit({ source: actor.combatActor(), sourceTags: [`${rows.bossKinds.includes(actor.kind) ? 'boss' : 'creature'}.${actor.kind}`, 'feel.blow', 'cover.checked'],
          target, amount, point: actor.position, dir: direction, throughWalls, cause: { kind: actor.kind, label: actor.label } });
      },
      stun: (seconds: number): void => {
        const target = owner.app.player; if (owner.scope.disposed || rows.god || target === null) return;
        owner.app.effects?.apply(target, rows.stunEffect, undefined, { duration: seconds }); this.legs();
      },
      trauma: (amount: number): void => { if (!owner.scope.disposed) CameraFX.for(game).addTrauma(amount); },
      sound: (name: string, at: THREE.Vector3): void => { if (!owner.scope.disposed) animals.onSound?.(name, at); },
      shot: (name: string, at: THREE.Vector3): void => { if (!owner.scope.disposed) this.bank?.shot(name, { at }); },
      toast: (text: string): void => { if (!owner.scope.disposed) play.hud.toast(text); },
      feed: (text: string): void => { if (!owner.scope.disposed) play.hud.killFeed(text); },
      addItem: (id: ItemId, count?: number): void => { if (!owner.scope.disposed) play.inventory.add(id, count); },
      ownSkin: (id: SkinId): void => {
        if (owner.scope.disposed) return;
        const skin = HeldFinishes.current(owner.product.slug).get(id); play.skins.own(id); play.wearSkin(skin);
        if (rows.unlockSkins.includes(skin.weapon)) play.weapons.unlock(skin.weapon);
      },
      dusk: () => sky.dayNight?.dusk ?? 0, night: () => sky.dayNight?.night ?? 0,
    };
    owner.scope.onDispose(() => { this.bank = null; });
  }
  legs(): void { this.legsOwner.carried = (this.owner.app.player?.attributes['moveLocked'] ?? 0) > 0 || this.introLock; }
  lockInput(on: boolean): void { this.introLock = on; this.legs(); this.equipment.setEnabled(!on); }
  onPlayerDeath(): void {
    const target = this.owner.app.player; if (target !== null) this.owner.app.effects?.remove(target, this.rows.stunEffect);
    this.introLock = false; this.legs();
  }
  useSfx(bank: DeclaredSoundBank): void { this.bank = bank; }
}

/**
 * Boss — the engine's boss system (docs/design/nalati/elites-and-bosses.md §2 "The boss system"; plan NALATI.md row B13).
 * A boss is a set-piece: an arena with a threshold and a seal, an intro beat with a name card, the wide top bar with
 * phase segments, phase changes that change the room, adds and hazards, a checkpoint per phase, and a legendary reward.
 * This class is the GENERIC half — the state machine, the bar, the cards, the checkpoints, the retry, the reward pickup
 * and the persistence. Everything particular to one fight (what the boss does, what the room does) is a `BossScript`
 * supplied by the content owner. Every encounter reuses the same presentation and checkpoint host.
 *
 *   const boss = new Boss(def, script, host, ui);     // ui = new BossBar() (src/engine/ui/BossBar.ts)
 *   boss.arm();                                        // the player is at the door: the next step over the threshold starts it
 *   boss.update(dt, t);                                // every frame
 *   boss.onPlayerDeath() → true when the death happened in this fight (the player is back at the checkpoint; do not
 *                          send them to the shard spawn)
 *   boss.disarm();                                     // the player left the dungeon: the fight and its checkpoint reset
 *
 * States: `dormant` (not set up) → `armed` (waiting at the threshold) → `intro` (input locked, the camera eases to face
 * the boss, letterbox + name card, HOLD TO SKIP; every retry plays the short one) → `fight` ⇄ `beat` (a phase change:
 * 1.5 s invulnerable, the caption, the script's `enterPhase`) → `victory` (the seal opens, the reward appears once).
 *
 * Phase checkpoints (the user's decision): dying sends you to the script's respawn point with full health and your
 * ammo refilled (`host.respawn`), the "THE KING ENDURES · ATTEMPT n" card shows, and the fight resets to the START OF
 * THE PHASE YOU REACHED (the boss's health to that phase's threshold, the room to that phase's layout). Leaving the
 * dungeon (`disarm`) forgets the checkpoint.
 *
 * The reward: a legendary-tier `WeaponPickup` (the gold orb) at `script.rewardPoint()`, prompt `def.reward.prompt`;
 * taking it calls `def.reward.grant()` once ever (persisted, 'ws.boss.v1'); a re-fight pays `def.reward.trophy` only.
 * The kill itself goes through the AnimalManager like any kill, so `Progress.recordKill` → the achievement + title.
 */

export interface BossPhaseDef {
  /** health fraction (of max) at which this phase starts — the first phase is 1 */
  at: number;
  /** the caption under the bar when it starts ("PHASE II") */
  caption: string;
  /** the design's name for it ("The Kurgan Wakes") — shown in the kill feed on entry */
  name: string;
}

export interface BossReward {
  tier: string;              // 'LEGENDARY'
  name: string;              // 'THE GOLDEN BOW'
  flavour: string;           // 'Bow of the Saka King'
  prompt: string;            // 'TAKE THE GOLDEN BOW'
  /** the model floating in the orb (world-space object, origin near its centre) */
  model: () => THREE.Object3D;
  /** the real unlock (Weapons.unlock / the upgrade) — called when the orb is taken, and at boot when already owned */
  grant: () => void;
  /** a re-fight's (and the first kill's) trophy: an inventory item */
  trophy?: () => void;
}

/** a boss's row: its id (saved), name and title, phases, retry card, reward and intro lengths */
export interface BossDef {
  /** unique per shard; persisted */
  id: string;
  /** the name on the bar and the card ("THE GOLDEN KING") and the card's title line ("LORD OF THE GREAT KURGAN") */
  name: string;
  title: string;
  phases: BossPhaseDef[];
  /** the retry card ("THE KING ENDURES") */
  retryTitle: string;
  reward: BossReward;
  /** intro length (s), full and the retry's short one */
  intro: number; introShort: number;
}


export interface BossHost {
  scene: THREE.Scene;
  player: Pick<Player, 'position' | 'yaw' | 'pitch'>;
  camera: THREE.PerspectiveCamera;
  renderer?: Renderer;
  /** a point light that is always in the scene from boot (intensity 0): hidden while the reward orb's own light is up,
   *  so the scene's light count — part of every lit program's key — never changes (no recompile hitch at the victory) */
  spareLight?: THREE.Light;
  /** the intro locks movement + weapons */
  lockInput: (on: boolean) => void;
  /** a dead player back at the checkpoint: full health, the quiver / javelins refilled */
  respawn: (pos: THREE.Vector3, yaw: number) => void;
  /** the reward orb's interact prompt goes into the game's interactables ([E] / USE) */
  addInteractable: (it: Interactable) => void;
  removeInteractable: (it: Interactable) => void;
  /** HOLD TO SKIP is held (a key / a touch on the screen) */
  skipHeld: () => boolean;
  toast?: (text: string) => void;
  feed?: (text: string) => void;
  /** music: the fight's intensity (0..1) and the stings */
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  /** the orb hums while you stand in its prompt radius */
  pickupHum?: (inside: boolean) => void;
}

const _to = new THREE.Vector3();

/** Optional typed persistence for a runtime owner; omitted adapters keep the legacy shard slot. */
export interface BossPersistence {
  read: (slug: string) => ReturnType<typeof bossesSave.read>;
  write: (value: ReturnType<typeof bossesSave.read>, slug: string) => void;
}

/** Scene, reward and persistence adapter around the pure encounter clock. */
export class Boss extends BossBrain {
  override readonly def: BossDef;
  private readonly renderHost: BossHost;
  private readonly renderUi: BossBar;
  private drop: WeaponPickup | null = null;
  get reward(): WeaponPickup | null { return this.drop; }
  constructor(def: BossDef, script: BossScript, host: BossHost, ui: BossBar, chunkId = 'local', persistence: BossPersistence = bossesSave) {
    const slug = saveSlug(chunkId), key = def.id;
    const saved = persistence.read(slug)[key] ?? { defeated: false, rewardTaken: false, kills: 0 };
    super(def, script, { player: host.player, lockInput: host.lockInput, respawn: host.respawn,
      skipHeld: host.skipHeld, feed: host.feed, toast: host.toast, music: host.music,
      faceToward: (target, dt) => { this.faceToward(target, dt); }, spawnReward: () => { this.spawnReward(); },
      events: app.events,
      persist: (value) => { const all = persistence.read(slug); all[key] = value; persistence.write(all, slug); },
    }, ui, saved);
    this.def = def; this.renderHost = host; this.renderUi = ui;
  }
  override update(dt: number, t: number): void {
    super.update(dt, t);
    if (this.drop !== null) {
      this.drop.update(dt, t, this.renderHost.renderer, this.renderHost.camera);
      if (this.drop.group.parent === null) { this.drop = null; if (this.renderHost.spareLight) this.renderHost.spareLight.visible = true; }
    }
  }

  private spawnReward(): void {
    const r = this.def.reward;
    if (this.renderHost.spareLight) this.renderHost.spareLight.visible = false;
    const drop = new WeaponPickup({ scene: this.renderHost.scene, item: r.model(), position: this.script.rewardPoint(), tier: 'legendary', prompt: r.prompt, scale: 1.7, radius: 2.6 });
    this.drop = drop;
    this.renderHost.addInteractable(drop.interactable);
    drop.onNear = (inside) => this.renderHost.pickupHum?.(inside);
    drop.onPickup = () => {
      this.saved.rewardTaken = true; this.save();
      r.grant();
      this.renderHost.removeInteractable(drop.interactable);
      this.renderHost.pickupHum?.(false);
      this.renderHost.music?.('pickup');
      this.renderUi.hideReward();
      this.renderHost.toast?.(`${r.name} — ${r.flavour}`);
    };
    this.renderUi.showReward(r.tier, r.name, r.flavour);
  }

  /** ease the camera toward a world point (the intro: "the camera stays first person but eases to face the boss") */
  private faceToward(target: THREE.Vector3, dt: number): void {
    const pl = this.renderHost.player;
    _to.copy(target).sub(this.renderHost.camera.position);
    const yaw = Math.atan2(-_to.x, -_to.z), pitch = Math.atan2(_to.y, Math.hypot(_to.x, _to.z));
    let dy = yaw - pl.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = 1 - Math.exp(-dt * 3.2);
    pl.yaw += dy * k;
    pl.pitch += (THREE.MathUtils.clamp(pitch, -0.6, 0.8) - pl.pitch) * k;
  }
}

/** Ordered score actions at the existing encounter clock's five music boundaries. */
export type BossScoreAction =
  | { readonly kind: 'scene'; readonly value: string }
  | { readonly kind: 'ambient' }
  | { readonly kind: 'phase'; readonly value: 1 | 2 | 3 }
  | { readonly kind: 'phase-index'; readonly values: readonly (1 | 2 | 3)[]; readonly otherwise: 1 | 2 | 3 }
  | { readonly kind: 'combat'; readonly value: number }
  | { readonly kind: 'sting'; readonly value: 'chunk' | 'death' | 'pickup' };
/** Encounter and reward cards are authored rows; executable reward ownership stays lent by the caller. */
export interface BossEncounterRows {
  readonly definition: Omit<BossDef, 'reward' | 'phases'> & { readonly phases: readonly BossPhaseDef[] };
  readonly reward: Omit<BossReward, 'model' | 'grant' | 'trophy'>;
  readonly score?: Readonly<Record<'intro' | 'phase' | 'victory' | 'death' | 'pickup', readonly BossScoreAction[]>>;
}
/** A lazy score owner: using the host does not open an audio context or start music at construction. */
export interface BossEncounterScore {
  setScene?: (scene: string) => void;
  setBossPhase?: (phase: 1 | 2 | 3) => void;
  combat: (intensity: number) => void;
  playSting: (sting: 'chunk' | 'death' | 'pickup') => void;
}
/** Native fight, equipment, presence, save and reward owners remain borrowed; no replacement body is created. */
export interface BossEncounterPorts<S extends BossScript> extends Omit<BossHost, 'scene' | 'camera' | 'renderer' | 'addInteractable' | 'removeInteractable' | 'music'> {
  readonly game: Pick<BossHost, 'scene' | 'camera' | 'renderer'>;
  readonly interactables: Interactable[];
  readonly scope: Scope | null;
  readonly chunkId: string;
  readonly persistence?: BossPersistence;
  readonly reward: Pick<BossReward, 'model' | 'grant' | 'trophy'>;
  readonly score?: () => BossEncounterScore;
  readonly ambientScene?: () => string;
  readonly scorePhase?: (script: S) => number;
  readonly music?: BossHost['music'];
  readonly advance?: (boss: Boss, script: S, dt: number, t: number) => void;
}
/** The original bar, reward pickup and boss record over the caller's exact fight. */
export interface BossEncounter<S extends BossScript> {
  readonly fight: S;
  readonly boss: Boss;
  readonly ui: BossBar;
  update: (dt: number, t: number) => void;
  onPlayerDeath: () => boolean;
}
/** Assemble the existing rendered Boss once. Bar construction precedes fight preparation/prewarm, and registration
 * follows Boss construction. Optional score rows preserve action order; presence/dormant stepping stays with the caller.
 */
export function installBossEncounter<S extends BossScript>(rows: BossEncounterRows, makeScript: () => S, ports: BossEncounterPorts<S>): BossEncounter<S> {
  if (rows.score !== undefined && (ports.score === undefined || ports.music !== undefined)) throw new Error('Encounter score rows require one score owner');
  for (const actions of Object.values(rows.score ?? {})) {
    if (actions.length > 16) throw new RangeError('Too many encounter score actions');
    for (const action of actions) {
      if (action.kind === 'combat' && (!Number.isFinite(action.value) || action.value < 0 || action.value > 1)) throw new RangeError('Invalid encounter intensity');
      if (action.kind === 'scene' && (action.value.length === 0 || action.value.length > 512)) throw new RangeError('Invalid encounter score scene');
      if (action.kind === 'ambient' && ports.ambientScene === undefined) throw new Error('Encounter requires its ambient scene owner');
      if (action.kind === 'phase-index' && (ports.scorePhase === undefined || action.values.length === 0 || action.values.length > 16)) throw new Error('Encounter requires its bounded phase owner');
    }
  }
  const ui = new BossBar(), fight = makeScript();
  const scoreRows = rows.score, scoreOwner = ports.score;
  const music: BossHost['music'] = scoreRows === undefined || scoreOwner === undefined ? ports.music : event => {
    const score = scoreOwner(), actions = scoreRows[event];
    // Refuse missing borrowed methods before the first effect of this event.
    for (const action of actions) {
      if ((action.kind === 'scene' || action.kind === 'ambient') && score.setScene === undefined) throw new Error('Encounter score cannot select a scene');
      if ((action.kind === 'phase' || action.kind === 'phase-index') && score.setBossPhase === undefined) throw new Error('Encounter score cannot select a phase');
    }
    for (const action of actions) {
      if (action.kind === 'scene') score.setScene?.(action.value);
      else if (action.kind === 'ambient') { const scene = ports.ambientScene?.(); if (scene === undefined) throw new Error('Missing ambient scene'); score.setScene?.(scene); }
      else if (action.kind === 'phase') score.setBossPhase?.(action.value);
      else if (action.kind === 'phase-index') { const phase = ports.scorePhase?.(fight); if (phase === undefined) throw new Error('Missing encounter phase'); score.setBossPhase?.(action.values[phase] ?? action.otherwise); }
      else if (action.kind === 'combat') score.combat(action.value);
      else score.playSting(action.value);
    }
  };
  const def: BossDef = { ...rows.definition, phases: rows.definition.phases.map(phase => ({ ...phase })), reward: { ...rows.reward, ...ports.reward } };
  const boss = new Boss(def, fight, { scene: ports.game.scene, player: ports.player, camera: ports.game.camera, ...(ports.game.renderer === undefined ? {} : { renderer: ports.game.renderer }),
    lockInput: ports.lockInput, respawn: ports.respawn, skipHeld: ports.skipHeld,
    addInteractable: it => { ports.interactables.push(it); }, removeInteractable: it => { const index = ports.interactables.indexOf(it); if (index !== -1) ports.interactables.splice(index, 1); },
    ...(ports.spareLight === undefined ? {} : { spareLight: ports.spareLight }), ...(ports.toast === undefined ? {} : { toast: ports.toast }),
    ...(ports.feed === undefined ? {} : { feed: ports.feed }), ...(ports.pickupHum === undefined ? {} : { pickupHum: ports.pickupHum }), ...(music === undefined ? {} : { music }),
  }, ui, ports.chunkId, ports.persistence);
  if (ports.scope !== null) app.encounters.boss(rows.definition.id, boss, ports.scope);
  return { fight, boss, ui, update: (dt, t) => { if (ports.advance === undefined) boss.update(dt, t); else ports.advance(boss, fight, dt, t); }, onPlayerDeath: () => boss.onPlayerDeath() };
}
