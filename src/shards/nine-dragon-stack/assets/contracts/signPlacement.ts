import type { Vector3 } from 'three';
import type { SignStyle } from '../../data/signs';

export interface SignSpec<S extends string = string> {
  readonly text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the character colour */
  readonly color: string;
  readonly vertical: boolean;
  readonly style: S;
  /** colour styles: the ground (paper, lacquer) */
  readonly ink?: string;
}

export interface SignPlace<S extends string = SignStyle> {
  /** centre of the sign face */
  readonly at: Vector3;
  /** the direction the text faces */
  readonly normal: Vector3;
  /** character height in metres */
  readonly size: number;
  readonly spec: SignSpec<S>;
  readonly gain?: number;
  readonly flicker?: number;
  /** both faces (a blade sign hanging out from a wall) */
  readonly blade?: boolean;
  readonly board?: number;
  readonly fogK?: number;
  /** calligraphy signs: how much of the fog the neon cuts through (`NeonTextDef.clear`) */
  readonly clear?: number;
}

export interface SignBoardBox { readonly c: Vector3; readonly right: Vector3; readonly up: Vector3; readonly normal: Vector3; readonly hx: number; readonly hy: number; readonly hz: number }

/** The writer methods a sign board needs; no runtime renderer or private builder state. */
export interface SignBoardKit {
  boxAxes: (c: Vector3, ax: Vector3, ay: Vector3, az: Vector3, hx: number, hy: number, hz: number, look: { wash: number; line: number }) => void;
}

export interface SignSink<S extends string = SignStyle> {
  place: (p: SignPlace<S>, kit: SignBoardKit | null) => { w: number; h: number };
  light: (c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode?: 1 | 2, seed?: number) => void;
  tube: (a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker?: number) => void;
}

