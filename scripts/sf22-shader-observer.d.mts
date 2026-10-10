/** A compile interval with shader text attribution captured without a native query. */
export interface ObservedShaderCompilation {
  start: number; end: number; phase: 'explicit-warm-up' | 'draw-or-driver'; sourceKnown: boolean;
  name: string | null; lightCounts: [string, number][]; flags: string[];
}
/** Classify only synchronous explicit warm-up and parse source after the measurement interval. */
export interface ShaderCompilationObserver {
  duringWarmUp: <T>(work: () => T) => T;
  snapshot: () => ObservedShaderCompilation[];
  dispose: () => void;
}
/** Install before boot; text supplied before installation remains unknown rather than queried or guessed. */
export function observeShaderCompilations(prototype: Pick<WebGL2RenderingContext, 'shaderSource' | 'compileShader'>,
  clock?: () => number): ShaderCompilationObserver;
