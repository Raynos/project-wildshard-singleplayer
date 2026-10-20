import type { ShardContext } from '@wildshard/game/plugin/context';
import type * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { BossPersistence } from '@wildshard/game/Boss';
import type { GroundTell } from '@wildshard/game/Elite';
import type { PhasedBossFight } from '@wildshard/game/plugin/bossPhase';
import type { Bow } from '@wildshard/game/weapons/Bow';
import type { Wildlife } from '../creatures/wildlife';
import type { SabreWeapon as Sabre, NaizagaiPowerHandle as NaizagaiPower } from '../weapons/nativeMelee';
import type { NalatiWeather } from '../world/installWeather';
import type { Ride } from '../runtime/state';

import type { GoldenBowPower } from '../runtime/weapons/GoldenBow';
import type { KurganEntrance } from '../world/types';

/** Native boss integration contracts, erased before shipping. */
export interface TitanCtx { game: Game; player: Player; weather: NalatiWeather; tieSpot: THREE.Vector3 | null }

export interface TitanFightHost {
  player: Player;
  hurt: (dmg: number, why: string) => void;
  throwRider: () => void;
  mounted: () => boolean;
  horseSteed: (d: number) => void;
  feed: (text: string) => void;
  toast: (text: string) => void;
  riders: () => TitanRiders | null;
  animals: () => AnimalManager | null;
}

export interface TitanPlay {
  persistence?: BossPersistence;
  animals: AnimalManager;
  wildlife: Wildlife | null;
  ride: Ride | null;
  riders?: TitanRiders | null;
  sabre: Sabre | null;
  upgradeSabre?: (power: NaizagaiPower) => void;
  setWeaponsEnabled: (on: boolean) => void;
  refill: () => void;
  /** main's damage path (health, flash; a toast unless `why` is empty) */
  hurt: (dmg: number, why: string) => void;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  /** Progress.recordKill — the achievement *Weather Report* */
  record?: (kind: string, variant: string) => void;
  /** a won skin (the Sky-Marked Saddle — B15 wears it) */
  ownSkin?: (id: string) => void;
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  pickupHum?: (inside: boolean) => void;
  params: URLSearchParams;
}

export interface Puff { bone: THREE.Object3D; p: THREE.Vector3; r: number; ph: number }

export interface Whirl { x: number; z: number; vx: number; vz: number; funnel: THREE.Mesh; on: boolean; k: number }

export interface Chain { tell: GroundTell; x: number; z: number; t: number; on: boolean }

export interface StormRider { a: Animal; mode: 'circle' | 'aim' | 'charge' | 'open'; t: number; th: number; lane: GroundTell; x0: number; z0: number; x1: number; z1: number; hit: boolean }

export interface GoldenKingFight {
  readonly phased: PhasedBossFight<Animal>;
  readonly script: BossScript;
  readonly body: () => Animal | null;
  /** park / unpark every fight animal (the player left / came back): out of the lists the HUD and the minimap read */
  readonly setPresent: (on: boolean) => void;
  /** dev: kill him now (screenshots of the victory) */
  readonly devKill: () => void;
}

export interface KurganPlay {
  context: ShardContext;
  persistence?: BossPersistence;
  animals: AnimalManager;
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

/** The boss borrows an existing native renderer; it never owns that renderer's catalogue. */
export interface TitanRiders {
  spawnRider: (options: { x: number; z: number; yaw: number; variant?: 'rider'; storm?: boolean }) => Animal | null;
  dissolve: (actor: Animal) => void;
}
