import * as THREE from 'three';
import type { BossBar } from '../ui/BossBar';
import type { Player } from '../player/Player';
import { WeaponPickup } from '../player/WeaponPickup';
import type { Interactable } from '../world/Cabin';

/**
 * Boss — the engine's boss system (docs/design/nalati/elites-and-bosses.md §2 "The boss system"; plan NALATI.md row B13).
 * A boss is a set-piece: an arena with a threshold and a seal, an intro beat with a name card, the wide top bar with
 * phase segments, phase changes that change the room, adds and hazards, a checkpoint per phase, and a legendary reward.
 * This class is the GENERIC half — the state machine, the bar, the cards, the checkpoints, the retry, the reward pickup
 * and the persistence. Everything particular to one fight (what the boss does, what the room does) is a `BossScript`
 * (the Golden King's: src/nalati/kurganBoss.ts). Nalati has two bosses; every later shard reuses this.
 *
 *   const boss = new Boss(def, script, host, ui);     // ui = new BossBar() (src/ui/BossBar.ts)
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

/** what one fight implements (the arena, the boss, the adds, the hazards) */
export interface BossScript {
  /** the player (feet) is past the threshold: inside the sealed volume */
  inArena: (p: THREE.Vector3) => boolean;
  /** set the room and the boss up at the START of phase `phase` (0-based), boss dormant, seal open */
  reset: (phase: number) => void;
  /** seal / unseal the arena */
  seal: (on: boolean) => void;
  /** the intro, `t` seconds in: pose the boss (rise, eyes ignite …); returns the world point the camera eases to face */
  intro: (t: number, short: boolean) => THREE.Vector3;
  /** the intro ended (or was skipped): the boss is up and fighting in `phase` */
  begin: (phase: number) => void;
  /** a phase change: the room changes, the new moves unlock (the beat's invulnerability is `setInvulnerable`) */
  enterPhase: (phase: number) => void;
  /** the fight's own tick (AI glue, hazards) while intro / fight / beat / victory */
  update: (dt: number, t: number, fighting: boolean) => void;
  /** boss health 0..1 of max; `shielded` shows the bar's gold shimmer; `dead` ends the fight */
  readonly hpFrac: number;
  readonly shielded: boolean;
  readonly dead: boolean;
  /** clamp the boss's health to exactly `frac` (a phase threshold is never skipped by one big hit) */
  clampHp: (frac: number) => void;
  setInvulnerable: (on: boolean) => void;
  /** the boss fell: the arena's victory dressing (the heap of plaques, the seal drains, the light on the pedestal) */
  victory: () => void;
  /** where the reward orb floats, and where a dead player comes back (feet + yaw) */
  rewardPoint: () => THREE.Vector3;
  respawnPoint: () => { pos: THREE.Vector3; yaw: number };
}

export interface BossHost {
  scene: THREE.Scene;
  player: Player;
  camera: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
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

export type BossState = 'dormant' | 'armed' | 'intro' | 'fight' | 'beat' | 'victory';

const STORE = 'ws.boss.v1';
interface Saved { defeated: boolean; rewardTaken: boolean; kills: number }
function loadAll(): Record<string, Saved> { try { return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Saved> | null) ?? {}; } catch { return {}; } }

const BEAT = 1.5, SKIP_HOLD = 0.6;
const _to = new THREE.Vector3();

export class Boss {
  state: BossState = 'dormant';
  /** the phase being fought (0-based) and the checkpoint (the phase a death sends you back to the start of) */
  phase = 0;
  checkpoint = 0;
  /** attempts this visit (the retry card counts them) */
  attempts = 1;
  private t = 0;
  private skipT = 0;
  private short = false;
  private drop: WeaponPickup | null = null;
  private readonly key: string;
  private saved: Saved;
  /** the reward orb (while it floats) — update() ticks it */
  get reward(): WeaponPickup | null { return this.drop; }

  constructor(readonly def: BossDef, readonly script: BossScript, private readonly host: BossHost, private readonly ui: BossBar, chunkId = 'local') {
    this.key = `${chunkId}#${def.id}`;
    this.saved = loadAll()[this.key] ?? { defeated: false, rewardTaken: false, kills: 0 };
  }

  /** beaten at least once / the reward taken (persisted) */
  get defeated(): boolean { return this.saved.defeated; }
  get rewardTaken(): boolean { return this.saved.rewardTaken; }
  get engaged(): boolean { return this.state === 'intro' || this.state === 'fight' || this.state === 'beat'; }

  private save(): void {
    try { const all = loadAll(); all[this.key] = this.saved; localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* not persisted this session */ }
  }

  /** ready at the threshold: the room at the checkpoint phase, the seal open */
  arm(): void {
    if (this.state === 'victory' || this.state === 'armed') return;
    this.script.setInvulnerable(false);
    this.script.reset(this.checkpoint);
    this.script.seal(false);
    this.phase = this.checkpoint;
    this.state = 'armed';
  }

  /** the player left: forget the fight (a later visit starts from phase I; a beaten boss is back in his coffin) */
  disarm(): void {
    if (this.engaged) this.host.lockInput(false);
    this.ui.hideBar(); this.ui.hideNameCard(); this.ui.hideReward();
    this.checkpoint = 0; this.attempts = 1;
    this.state = 'dormant';
  }

  /** the player died. In this fight → back at the checkpoint (true); anywhere else → not ours (false) */
  onPlayerDeath(): boolean {
    if (!this.engaged) return false;
    this.host.lockInput(false);
    this.attempts++;
    this.ui.hideBar(); this.ui.hideNameCard();
    this.ui.showRetry(this.def.retryTitle, this.attempts);
    this.host.music?.('death');
    const r = this.script.respawnPoint();
    this.host.respawn(r.pos, r.yaw);
    this.state = 'dormant';
    this.arm();
    return true;
  }

  /** dev: jump straight into phase `phase` (0-based) as if the checkpoint were there */
  devStartAt(phase: number): void {
    this.checkpoint = Math.max(0, Math.min(this.def.phases.length - 1, phase));
    this.state = 'dormant'; this.arm();
  }

  update(dt: number, t: number): void {
    this.ui.update(dt);
    const p = this.host.player.position;
    switch (this.state) {
      case 'dormant': break;
      case 'armed':
        if (this.script.inArena(p)) this.startIntro();
        break;
      case 'intro': {
        this.t += dt;
        const len = this.short ? this.def.introShort : this.def.intro;
        const focus = this.script.intro(this.t, this.short);
        this.faceToward(focus, dt);
        this.skipT = this.host.skipHeld() ? this.skipT + dt : 0;
        this.ui.setSkip(this.skipT / SKIP_HOLD);
        if (this.t >= len || this.skipT >= SKIP_HOLD) this.beginFight();
        break;
      }
      case 'beat':
        this.t += dt;
        if (this.t >= BEAT) { this.script.setInvulnerable(false); this.state = 'fight'; }
        this.syncBar();
        break;
      case 'fight': {
        this.syncBar();
        if (this.script.dead) { this.win(); break; }
        const next = this.def.phases[this.phase + 1];
        if (next !== undefined && this.script.hpFrac <= next.at) {
          this.phase++;
          this.checkpoint = this.phase;
          this.script.clampHp(next.at);
          this.script.setInvulnerable(true);
          this.script.enterPhase(this.phase);
          this.ui.setPhase(this.phase, next.caption);
          this.host.feed?.(`${this.def.name} · ${next.name}`);
          this.host.music?.('phase', 1);
          this.state = 'beat'; this.t = 0;
        }
        break;
      }
      case 'victory':
        this.t += dt;
        if (this.t > 1.4 && this.ui.barShown) this.ui.hideBar();
        break;
      default: break;
    }
    if (this.state !== 'dormant') this.script.update(dt, t, this.state === 'fight' || this.state === 'beat');
    if (this.drop !== null) {
      this.drop.update(dt, t, this.host.renderer, this.host.camera);
      // the orb burst and removed itself (its light with it): the spare light takes its place in the same frame
      if (this.drop.group.parent === null) { this.drop = null; if (this.host.spareLight) this.host.spareLight.visible = true; }
    }
  }

  private syncBar(): void {
    this.ui.setHp(this.script.hpFrac);
    this.ui.setShield(this.script.shielded || this.state === 'beat');
  }

  private startIntro(): void {
    this.short = this.attempts > 1 || this.saved.defeated;
    this.script.seal(true);
    this.host.lockInput(true);
    this.ui.showNameCard(this.def.name, this.def.title, this.short);
    this.host.music?.('intro', 1);
    this.t = 0; this.skipT = 0;
    this.state = 'intro';
  }

  private beginFight(): void {
    this.ui.hideNameCard();
    this.host.lockInput(false);
    this.script.begin(this.phase);
    this.ui.showBar(this.def.name, this.def.phases.slice(1).map((ph) => ph.at));
    this.syncBar();
    if (this.phase > 0) { const ph = this.def.phases[this.phase]; if (ph) this.ui.setPhase(this.phase, ph.caption); }
    this.state = 'fight';
  }

  private win(): void {
    this.state = 'victory'; this.t = 0;
    this.ui.setHp(0); this.ui.setShield(false);
    this.script.victory();
    this.script.seal(false);
    this.host.music?.('victory');
    this.saved.kills++;
    const first = !this.saved.rewardTaken;
    this.saved.defeated = true;
    this.save();
    this.def.reward.trophy?.();
    if (first) this.spawnReward();
    else this.host.toast?.(`${this.def.name} falls again — the gold is already yours`);
  }

  private spawnReward(): void {
    const r = this.def.reward;
    if (this.host.spareLight) this.host.spareLight.visible = false;
    const drop = new WeaponPickup({ scene: this.host.scene, item: r.model(), position: this.script.rewardPoint(), tier: 'legendary', prompt: r.prompt, scale: 1.7, radius: 2.6 });
    this.drop = drop;
    this.host.addInteractable(drop.interactable);
    drop.onNear = (inside) => this.host.pickupHum?.(inside);
    drop.onPickup = () => {
      this.saved.rewardTaken = true; this.save();
      r.grant();
      this.host.removeInteractable(drop.interactable);
      this.host.pickupHum?.(false);
      this.host.music?.('pickup');
      this.ui.hideReward();
      this.host.toast?.(`${r.name} — ${r.flavour}`);
    };
    this.ui.showReward(r.tier, r.name, r.flavour);
  }

  /** ease the camera toward a world point (the intro: "the camera stays first person but eases to face the boss") */
  private faceToward(target: THREE.Vector3, dt: number): void {
    const pl = this.host.player;
    _to.copy(target).sub(this.host.camera.position);
    const yaw = Math.atan2(-_to.x, -_to.z), pitch = Math.atan2(_to.y, Math.hypot(_to.x, _to.z));
    let dy = yaw - pl.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = 1 - Math.exp(-dt * 3.2);
    pl.yaw += dy * k;
    pl.pitch += (THREE.MathUtils.clamp(pitch, -0.6, 0.8) - pl.pitch) * k;
  }
}
