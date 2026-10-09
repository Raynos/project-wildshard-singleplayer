// The facade grammar's output (../../generators/facadeGrammar.ts `dressTower` / `dressWall` / `spanStreet` fill it at
// layout time): the instanced pieces, the interior-mapped windows, the sign slots and the merged shell. The page reads it
// back from the layout bake (../layoutBake.ts) and draws it (./batch.ts), so it stays with the runtime.
import type { Color, Matrix4, Vector3, Vector4 } from 'three';
import { Builder } from './geo';
import type { PieceId } from './pieces';

export interface Placement { piece: PieceId; m: Matrix4; c: Color }
export interface WindowInst { m: Matrix4; win: Vector4; wall: Color; light: Color }
/** a slot the lead's sign system fills with real calligraphy (words.ts): position, facing, size in metres */
export interface SignSlot { at: Vector3; normal: Vector3; size: number; color: number; blade: boolean }

/** everything dressTower emits; pass the same one to many towers to batch a whole street */
export class Dressing {
  readonly pieces: Placement[] = [];
  readonly windows: WindowInst[] = [];
  private readonly early: SignSlot[] = [];
  private readonly lateSigns: SignSlot[] = [];
  /**
   * While set, new sign slots go after every other. build.ts fills the slots in order from one rng, so a slot added in
   * the middle re-rolls the word of every sign after it, all over the city (§12): a new street's slots go late.
   */
  late = false;
  /** every sign slot, in the order build.ts fills them */
  get signs(): readonly SignSlot[] { return this.lateSigns.length === 0 ? this.early : [...this.early, ...this.lateSigns]; }
  addSign(slot: SignSlot): void { (this.late ? this.lateSigns : this.early).push(slot); }
  /** merged opaque geometry: shells, galleries, parapets, cables, antennas (one draw) */
  shell = new Builder();
  towers = 0;
}
