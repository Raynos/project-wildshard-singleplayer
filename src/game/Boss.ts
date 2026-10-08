import { BossBrain, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { app } from '@wildshard/engine/app/runtime';
import type { Player } from '@wildshard/engine/player/Player';
import { WeaponPickup } from '@wildshard/engine/player/WeaponPickup';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { bossesSave, saveSlug } from './saves';
import * as THREE from 'three';

/**
 * Boss — the engine's boss system (docs/design/nalati/elites-and-bosses.md §2 "The boss system"; plan NALATI.md row B13).
 * A boss is a set-piece: an arena with a threshold and a seal, an intro beat with a name card, the wide top bar with
 * phase segments, phase changes that change the room, adds and hazards, a checkpoint per phase, and a legendary reward.
 * This class is the GENERIC half — the state machine, the bar, the cards, the checkpoints, the retry, the reward pickup
 * and the persistence. Everything particular to one fight (what the boss does, what the room does) is a `BossScript`
 * (the Golden King's: src/shards/nalati-grasslands/combat/goldenKing.ts). Nalati has two bosses; every later shard reuses this.
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
  player: Player;
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
