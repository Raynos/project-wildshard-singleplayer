import type { Vector3 } from 'three';
import type { BrainPoint } from '@wildshard/engine/ai/strikes';
import type { LaneBody } from '../combat/lane';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';

/** What the King's goals read of the world, renderer-free (the page's PineCtx satisfies it over its Animal). */
export interface KingGoalEnv<B extends LaneBody> {
  reach: (actor: B, target: BrainPoint) => boolean;
  player: { readonly position: Vector3 };
  hurt: (a: B, dmg: number, throughWalls?: boolean) => void;
  trauma: (k: number) => void;
  shot: (name: Parameters<DeclaredSoundBank['shot']>[0], at: Vector3) => void;
}
