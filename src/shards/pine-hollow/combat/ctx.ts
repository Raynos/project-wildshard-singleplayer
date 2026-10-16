import type * as THREE from 'three';
import { GroundTell } from '@wildshard/game/Elite';
import type { ItemId } from '@wildshard/game/Inventory';
import type { SkinId } from '../runtime/loadout/skins';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Lane } from './lane';
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
  shot: (name: Parameters<DeclaredSoundBank['shot']>[0], at: THREE.Vector3) => void;
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

/** take `a` under a fight's control: out of its herd, the manager's AI off, a hit leaves our state alone */
export function own(a: Animal): void {
  a.herd = -1; a.state = SCRIPTED;
  // the manager's `damaged` pushes a hit animal into flee / charge; a scripted one keeps the state its fight gave it
  a.scripted = true;
}
/** hand `a` back to the manager's AI (a rival bull after the fight) */
export function release(a: Animal): void { a.scripted = false; if (a.alive && a.state === SCRIPTED) a.state = 'alert'; }

/** out of the world for good: hidden, out of the manager's list (minimap, prompts, aim assist, AI) */
export function retire(animals: AnimalManager, a: Animal): void {
  animals.retire(a);
}

/** an AnimalManager sound by name (the manager's own names, plus the species' strings like 'elk_bugle') */
export function voice(animals: AnimalManager, name: string, at: THREE.Vector3): void { animals.onSound?.(name, at); }

/**
 * A telegraphed LANE CHARGE as the page draws it (Old Ironhide's gore charge, the Imperial Bull's and his rivals', the
 * thralls', the King's Last Light): the renderer-free lane (lane.ts: the tell, the run, the one hit, the skid) plus its
 * painted ground decal, which keeps the frame's pre-transition drawing.
 */
export class LaneCharge extends Lane<Animal> {
  readonly tellDecal: GroundTell;
  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation, row: StrikeSpec, reach: PineCtx['reach'] = () => true) {
    super(row, reach);
    this.tellDecal = new GroundTell(scene, 'lane', color);
  }
  override cancel(): void { super.cancel(); this.tellDecal.hide(); }
  /** The simulation has one body clock; the decal retains the old pre-transition drawing frame. */
  override update(a: Animal, dt: number, t: number, player: THREE.Vector3, hurt: (dmg: number) => void): void {
    const state = this.state; if (state === 'none') return;
    const elapsed = this.t + dt;
    super.update(a, dt, t, player, hurt);
    this.tellDecal.setTime(t);
    if (state === 'tell') {
      const k = Math.min(1, elapsed / this.tellT);
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, this.width, 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(t * 22)));
    } else if (state === 'run') {
      this.tellDecal.lane(this.x0, this.z0, this.x1, this.z1, this.width, Math.max(0, 0.6 - elapsed * 1.2));
    } else this.tellDecal.hide();
  }
}
