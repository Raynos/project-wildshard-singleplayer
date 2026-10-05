import type * as THREE from 'three';
import { GroundTell } from '@wildshard/game/Elite';
import type { ItemId } from '@wildshard/game/Inventory';
import type { SkinId } from '../loadout/skins';
import type { PhShot } from '../runtime/audio/sfx';
import { inspectBrain } from '@wildshard/engine/ai/inspect';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { DamageDealt } from '@wildshard/engine/combat/pipeline';

/**
 * What Pine Hollow's fights share (src/shards/pine-hollow/: the elites, the Antler King, the combat feel): the world, the player,
 * the herds, and the few ways a fight touches the rest of the game — hurting you, stunning you, the sounds, the pack.
 * index.ts builds it from main.ts's host once.
 */
export interface PineCtx {
  /** Retained encounter listeners are installed only while this home cell is entered. */
  onDamage?: (listener: (event: DamageDealt) => void) => void;
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  reach: (actor: Animal, target: { x: number; y: number; z: number }) => boolean;
  /** `&bossGod=1`: nothing in Pine Hollow's fights hurts you (captures) */
  god: boolean;
  /** `a` hits you for `dmg` (main.ts's onCharge: health, the flash, the shove, the hurt arc, the shake) */
  hurt: (a: Animal, dmg: number, throughWalls?: boolean) => void;
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
  addItem: (id: ItemId, n?: number) => void;
  ownSkin: (id: SkinId) => void;
  skinModel: (id: SkinId) => THREE.Object3D;
  /** the Warden's Longbow (PH-C11, src/engine/player/Longbow.ts): its orb model and its grant (the kit's 'bow'); null = not on this shard */
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
  // the manager's `damaged` pushes a hit animal into flee / charge; a scripted one keeps the state its fight gave it
  a.scripted = true;
  owned.add(a);
}
/** hand `a` back to the manager's AI (a rival bull after the fight) */
export function release(a: Animal): void { owned.delete(a); a.scripted = false; if (a.alive && a.state === SCRIPTED) a.state = 'alert'; }

/** out of the world for good: hidden, out of the manager's list (minimap, prompts, aim assist, AI) */
export function retire(animals: AnimalManager, a: Animal): void {
  owned.delete(a);
  animals.retire(a);
}

/** an AnimalManager sound by name (the manager's own names, plus the species' strings like 'elk_bugle') */
export function voice(animals: AnimalManager, name: string, at: THREE.Vector3): void { animals.onSound?.(name, at); }

/**
 * A telegraphed LANE CHARGE (Old Ironhide's gore charge, the Imperial Bull's and his rivals', the thralls', the King's
 * Last Light): the lane is locked from the animal through where you stand (+ an overshoot) and painted on the ground for
 * `tell` s while it paws (Animal.startAttack's wind-up pose); then it runs the lane flat out and hits you once if you are
 * still in it when it arrives; then it skids to a stop (the shot window).
 */
interface LaneOptions { width: number; speed: number; overshoot: number; dmg: number; skid: number; reach: number }
export class LaneCharge {
  private readonly runner = new StrikeRunner();
  private readonly o: LaneOptions;
  private readonly spec: StrikeSpec;
  private tellT = 1;
  readonly tellDecal: GroundTell;
  private readonly reach: PineCtx['reach'];
  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation, row: LaneOptions | StrikeSpec, reach: PineCtx['reach'] = () => true) {
    this.reach = reach;
    if ('shape' in row) {
      if (row.shape.kind !== 'lane') throw new Error('Lane view requires a lane strike');
      this.spec = row; this.o = { width: row.shape.width, speed: row.motion?.speed ?? 0, overshoot: row.motion?.overshoot ?? 0,
        dmg: row.damage, skid: row.recover, reach: row.range };
    } else {
      this.o = row;
      this.spec = { id: 'strike.lane', shape: { kind: 'lane', length: 0, width: row.width },
        windup: 1, active: 0, recover: row.skid, cooldown: 0, range: row.reach, damage: row.dmg,
        tags: ['creature.charge'], weight: () => 1,
        motion: { speed: row.speed, track: 'lead', overshoot: row.overshoot, skid: row.skid } };
    }
    this.tellDecal = new GroundTell(scene, 'lane', color);
  }
  get state(): 'none' | 'tell' | 'run' | 'skid' {
    return this.runner.state === 'windup' ? 'tell' : this.runner.state === 'active' ? 'run' : this.runner.state === 'recover' ? 'skid' : 'none';
  }
  get t(): number { return this.runner.time; }
  get x0(): number { return this.runner.x0; }
  get z0(): number { return this.runner.z0; }
  get x1(): number { return this.runner.x1; }
  get z1(): number { return this.runner.z1; }
  get yaw(): number { return this.runner.yaw; }
  get len(): number { return this.runner.length; }
  get busy(): boolean { return this.runner.busy; }
  idle(): boolean { return !this.busy; }
  start(a: Animal, px: number, pz: number, tell: number, speedMul = 1): void {
    this.tellT = tell;
    const spec: StrikeSpec = { ...this.spec, windup: tell };
    this.runner.start(spec, a, { x: px, y: a.position.y, z: pz }, speedMul);
    inspectBrain(a, () => ({ state: this.runner.busy ? `charge.${this.runner.state}` : a.state, picks: [{ id: spec.id, score: 1 }], brainHz: 60, pinned: false }));
  }
  cancel(): void { this.runner.cancel(); this.tellDecal.hide(); }
  recoverNow(): void { this.runner.recoverNow(); }
  /** The simulation has one body clock; the decal retains the old pre-transition drawing frame. */
  update(a: Animal, dt: number, t: number, player: THREE.Vector3, hurt: (dmg: number) => void): void {
    const state = this.state; if (state === 'none') return;
    const elapsed = this.t + dt;
    this.runner.update(dt, { actor: a, target: player, canReach: () => this.reach(a, player), hit: (spec) => { hurt(spec.damage); } });
    this.tellDecal.setTime(t);
    if (state === 'tell') {
      const k = Math.min(1, elapsed / this.tellT);
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, this.o.width, 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(t * 22)));
    } else if (state === 'run') {
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, this.o.width, Math.max(0, 0.6 - elapsed * 1.2));
    } else this.tellDecal.hide();
  }
}
