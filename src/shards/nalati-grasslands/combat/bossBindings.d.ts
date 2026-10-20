import type { CoupledMember, EncounterSchedule } from '@wildshard/game/boss/encounterPatrol';
import type * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { BossPersistence } from '@wildshard/game/Boss';
import type { GroundTell } from '@wildshard/game/Elite';
import type { PageWildlife } from '@wildshard/game/population/wildlife';
import type { CrowdDraw as Flock } from '@wildshard/game/ambient/crowdDraw';
import type { SabreWeapon as Sabre, NaizagaiPowerHandle as NaizagaiPower } from '../weapons/nativeMelee';
import type { NalatiWeather } from '../world/installWeather';
import type { Ride } from '../runtime/state';


type Wildlife = PageWildlife<Flock>;

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

export interface Chain { tell: GroundTell; law: EncounterSchedule }

export interface StormRider { a: Animal; lane: GroundTell; law: CoupledMember }

/** The boss borrows an existing native renderer; it never owns that renderer's catalogue. */
export interface TitanRiders {
  spawnRider: (options: { x: number; z: number; yaw: number; variant?: 'rider'; quiet?: boolean }) => Animal | null;
  dissolve: (actor: Animal) => void;
}
