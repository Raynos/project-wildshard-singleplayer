import type { GraphIr } from './materialGraph';
/** Client presentation rows for G478's post chain with scaled targets.
 * Programs are admitted arithmetic graphs. Targets are declared in dependency
 * order; draws never allocate, read back, or render the world a second time. */
/** Select only when the executor's actual render target storage matches; omitted rows run on both. */
export type PostStorage = 'float16' | 'unorm8';
export type PostCameraTerm = 'projection' | 'projectionInverse' | 'view' | 'world' | 'nearFar' | 'near' | 'far';
export type PostPackTerm = number | string | null | { readonly param: string }
  | { readonly setting: string; readonly div?: number; readonly per?: { readonly target: string; readonly axis: 'width' | 'height' } };
export interface ScaledPostProgram {
  readonly graph: GraphIr;
  readonly links?: readonly string[];
  readonly depth?: string;
  readonly camera?: Readonly<Record<string, PostCameraTerm>>;
  readonly pack?: Readonly<Record<string, readonly PostPackTerm[]>>;
  readonly blend?: 'addKeepAlpha';
}
export interface ScaledPostRow {
  readonly name: string;
  readonly programs: Readonly<Record<string, ScaledPostProgram>>;
  readonly targets: Readonly<Record<string, { readonly name: string; readonly of: string; readonly scale: number; readonly filter: 'linear' | 'nearest'; readonly storage?: PostStorage }>>;
  readonly draws: readonly { readonly program: string; readonly to: string; readonly storage?: PostStorage; readonly textures?: Readonly<Record<string, string>>; readonly texel?: { readonly uniform: string; readonly of: string } }[];
  readonly settings: Readonly<Record<string, number>>;
  readonly when?: string;
  readonly outputs: Readonly<Record<string, string>>;
  readonly drawnOnly?: boolean;
}

