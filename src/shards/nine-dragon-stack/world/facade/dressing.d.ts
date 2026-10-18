import type { BufferGeometry, Color, Matrix4, Vector4 } from 'three';

export interface WindowInst { m: Matrix4; win: Vector4; wall: Color; light: Color }
/** Draw state only; facade grammar, aliases and copy boxes are compiled offline. */
export interface Dressing { readonly windows: WindowInst[]; shell: BufferGeometry | null; towers: number }
