import type { RngState } from '@wildshard/engine/core/rng';
import type { StormReactions } from './weatherStep';

export type StormPhase = string;
interface SteppeNumbers { overcast:number;rain:number;wet:number;wind:number;fog:number;front:number;rainbow:number }


/** something tall the lightning may pick (a spruce, a balbal, a yurt's crown) */
export interface Exposed { x: number; z: number; top: number; kind: 'tree' | 'thing'; ref?: unknown }

export interface LightningPlayer {
  x: number; y: number; z: number;
  crouched: boolean; mounted: boolean;
  /** inside / right beside a yurt: no rain, no lightning */
  sheltered: boolean;
}

export interface LightningWorld {
  heightAt: (x: number, z: number) => number;
  /** push every exposed thing within r of (x, z) into `out` (don't clear it) */
  exposed: (x: number, z: number, r: number, out: Exposed[]) => void;
  player: () => LightningPlayer;
}

export interface Strike {
  x: number; y: number; z: number;
  kind: 'tree' | 'player' | 'ground' | 'thing';
  /** the tree / thing that took it (Exposed.ref) */
  ref?: unknown;
}

/**
 * The storm's whole continuation as plain values (SF72: a renderer-free host saves it in its snapshot): the phase clock,
 * the mode and hold, the continuous numbers, its own random stream, the flash, the wind it asks for, GET LOW, an armed strike
 * (one that took a tree or a thing has a live reference and cannot be saved) and the lightning's countdowns.
 */
export interface StormState {
  state: StormPhase; phaseT: number; phaseLen: number; mode: string; hold: boolean;
  n: SteppeNumbers; rng: RngState;
  flash: number; windSpeed: number | null; windGustiness: number; getLow: boolean; stormFrom: number;
  pending: { x: number; y: number; z: number; kind: Strike['kind']; t: number } | null;
  nextBolt: number; nextGust: number; windTarget: number; getLowFor: number; getLowTick: number;
}
export type Lightning = StormReactions;
