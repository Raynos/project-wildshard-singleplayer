import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import type { AnimalManager, AnimalSound } from '../entities/AnimalManager';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { ItemId } from '../game/Inventory';
import type { SkinId } from '../player/Skins';
import type { PhShot } from '../audio/PineHollowSfx';
import { GroundTell } from '../game/Elite';
import { inLane } from './combatMath';

/**
 * What Pine Hollow's fights share (src/pinehollow/: the elites, the Antler King, the combat feel): the world, the player,
 * the herds, and the few ways a fight touches the rest of the game — hurting you, stunning you, the sounds, the pack.
 * index.ts builds it from main.ts's host once.
 */
export interface PineCtx {
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  /** `&bossGod=1`: nothing in Pine Hollow's fights hurts you (captures) */
  god: boolean;
  /** `a` hits you for `dmg` (main.ts's onCharge: health, the flash, the shove, the hurt arc, the shake) */
  hurt: (a: Animal, dmg: number) => void;
  /** rooted for `s` seconds (a roar): no walking, no jumping */
  stun: (s: number) => void;
  /** a camera trauma² shake (0..1) */
  trauma: (k: number) => void;
  /** an animal voice at a point (AnimalManager.onSound: bear_roar, elk_bugle …) */
  sound: (name: string, at: THREE.Vector3) => void;
  /** a Pine Hollow one-shot (PineHollowSfx: king_roar, king_stomp, king_bells, thrall_call …); silently nothing before it decodes */
  shot: (name: PhShot, at: THREE.Vector3) => void;
  toast: (text: string) => void;
  feed: (text: string) => void;
  addItem: (id: ItemId) => void;
  ownSkin: (id: SkinId) => void;
  skinModel: (id: SkinId) => THREE.Object3D;
  /** the Warden's Longbow (PH-C11, src/player/Longbow.ts): its orb model and its grant (the kit's 'bow'); null = not on this shard */
  longbow: { model: () => THREE.Object3D; grant: () => void } | null;
  /** PineDayNight's 0..1 getters (0 with the fixed sky) */
  dusk: () => number;
  night: () => number;
}

/** an animal a fight scripts from its own tick: the manager's senses / flee / charge loop leaves it alone */
export const SCRIPTED: Animal['state'] = 'sidestep';

const owned = new WeakSet<Animal>();

/** take `a` under a fight's control: out of its herd, the manager's AI off, a hit leaves our state alone */
export function own(a: Animal): void {
  a.herd = -1; a.state = SCRIPTED;
  const prev = a.onDamaged;
  // the manager's `damaged` pushes a hit animal into flee / charge; a scripted one keeps the state its fight gave it
  a.onDamaged = (an, amount, point, dir, died) => { const s = an.state; prev?.(an, amount, point, dir, died); if (!died && owned.has(an)) an.state = s; };
  owned.add(a);
}
/** hand `a` back to the manager's AI (a rival bull after the fight) */
export function release(a: Animal): void { owned.delete(a); if (a.alive && a.state === SCRIPTED) a.state = 'alert'; }

/** out of the world for good: hidden, out of the manager's list (minimap, prompts, aim assist, AI) */
export function retire(animals: AnimalManager, a: Animal): void {
  owned.delete(a);
  a.hidden = true; a.mesh.visible = false; a.alive = false; a.position.y = -9999;
  const i = animals.animals.indexOf(a); if (i !== -1) animals.animals.splice(i, 1);
  a.mesh.removeFromParent();
}

/** an AnimalManager sound by name (the manager's own names, plus the species' strings like 'elk_bugle') */
export function voice(animals: AnimalManager, name: string, at: THREE.Vector3): void { animals.onSound?.(name as AnimalSound, at); }

const _p = new THREE.Vector3();

/**
 * A telegraphed LANE CHARGE (Old Ironhide's gore charge, the Imperial Bull's and his rivals', the thralls', the King's
 * Last Light): the lane is locked from the animal through where you stand (+ an overshoot) and painted on the ground for
 * `tell` s while it paws (Animal.startAttack's wind-up pose); then it runs the lane flat out and hits you once if you are
 * still in it when it arrives; then it skids to a stop (the shot window).
 */
export class LaneCharge {
  state: 'none' | 'tell' | 'run' | 'skid' = 'none';
  t = 0;
  x0 = 0; z0 = 0; x1 = 0; z1 = 0; yaw = 0; len = 0;
  private hit = false;
  private tellT = 1;
  readonly tellDecal: GroundTell;
  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation, private readonly o: { width: number; speed: number; overshoot: number; dmg: number; skid: number; reach: number }) {
    this.tellDecal = new GroundTell(scene, 'lane', color);
  }
  get busy(): boolean { return this.state !== 'none'; }
  /** the charge is over (a method, so a caller's earlier `busy` check does not narrow it) */
  idle(): boolean { return this.state === 'none'; }
  /** lock the lane at the player and start the tell */
  start(a: Animal, px: number, pz: number, tell: number, speedMul = 1): void {
    const dx = px - a.position.x, dz = pz - a.position.z, d = Math.hypot(dx, dz) || 1;
    this.len = d + this.o.overshoot;
    this.x0 = a.position.x; this.z0 = a.position.z;
    this.x1 = this.x0 + (dx / d) * this.len; this.z1 = this.z0 + (dz / d) * this.len;
    this.yaw = Math.atan2(dx, dz);
    this.state = 'tell'; this.t = 0; this.tellT = tell; this.hit = false; this.speedMul = speedMul;
    a.startAttack(tell);
  }
  private speedMul = 1;
  cancel(): void { this.state = 'none'; this.tellDecal.hide(); }
  /** per frame; `hurt` is called once if the run catches the player */
  update(a: Animal, dt: number, t: number, player: THREE.Vector3, hurt: (dmg: number) => void): void {
    if (this.state === 'none') return;
    this.t += dt;
    this.tellDecal.setTime(t);
    const w = this.o.width;
    if (this.state === 'tell') {
      a.setMotion(this.yaw, 0, 6);
      const k = Math.min(1, this.t / this.tellT);
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, w, 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(t * 22)));
      if (this.t >= this.tellT) { this.state = 'run'; this.t = 0; a.cancelAttack(); }
      return;
    }
    if (this.state === 'run') {
      a.setMotion(this.yaw, this.o.speed * this.speedMul, 0.35);
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, w, Math.max(0, 0.6 - this.t * 1.2));
      const reach = this.o.reach * Math.max(1, a.scale);
      if (!this.hit && a.alive) {
        _p.set(player.x - a.position.x, 0, player.z - a.position.z);
        if (_p.length() < reach && inLane(player.x, player.z, this.x0, this.z0, this.x1, this.z1, w * 0.5 + 0.4)) { this.hit = true; hurt(this.o.dmg); }
      }
      const along = ((a.position.x - this.x0) * (this.x1 - this.x0) + (a.position.z - this.z0) * (this.z1 - this.z0)) / (this.len * this.len);
      if (along >= 1 || this.t > this.len / Math.max(1, this.o.speed * this.speedMul) + 1.2) { this.state = 'skid'; this.t = 0; }
      return;
    }
    // skid: stopped, head low — the window
    a.setMotion(a.yaw, 0, 1.5);
    this.tellDecal.hide();
    if (this.t >= this.o.skid) this.state = 'none';
  }
}
