import type { Color, Vector3 } from 'three';
/** A static glow: its lantern, its reflection card (generators/receiverCards.ts) and its baked light. */
export interface Emitter {
  at: Vector3; color: Color;
  w: number; h: number; power: number; spill: number;
}
