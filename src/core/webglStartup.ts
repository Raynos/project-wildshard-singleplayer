/** Wait for WebKit's graphics context to be usable before Three reads its capabilities. */
export const GAME_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false,
  depth: true, premultipliedAlpha: true, preserveDrawingBuffer: false,
};

export interface ContextStartupState { attempt: number; elapsedMs: number; contextLost: boolean; precisionReady: boolean; contextCreated: boolean }

export async function readyWebGLContext(
  canvas: HTMLCanvasElement,
  waiting: (state: ContextStartupState) => void = () => undefined,
): Promise<WebGL2RenderingContext> {
  // This must precede getContext(): loss can happen during context creation itself.
  // Without preventDefault the browser is not permitted to restore that context.
  const allowRestore = (event: Event): void => { event.preventDefault(); };
  canvas.addEventListener('webglcontextlost', allowRestore);
  const start = performance.now();
  let attempt = 0;
  try {
    for (;;) {
      const gl = canvas.getContext('webgl2', GAME_CONTEXT_ATTRIBUTES);
      const contextLost = gl?.isContextLost() ?? false;
      // A non-null getContext result is insufficient: lost contexts return null for precision.
      // Three dereferences these objects in its constructor before installing game recovery.
      const precisionReady = gl !== null && !contextLost &&
        [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].every((shader) =>
          [gl.HIGH_FLOAT, gl.MEDIUM_FLOAT, gl.LOW_FLOAT].every((precision) =>
            gl.getShaderPrecisionFormat(shader, precision) !== null));
      if (gl !== null && precisionReady && !gl.isContextLost()) return gl;
      const state = { attempt: ++attempt, elapsedMs: Math.round(performance.now() - start), contextLost, precisionReady, contextCreated: gl !== null };
      waiting(state);
      if (state.elapsedMs >= 10_000) throw new Error(`Graphics context did not recover during startup (${contextLost ? 'context lost' : gl === null ? 'context unavailable' : 'shader capabilities unavailable'})`);
      // Yield for GPU-process restart / webglcontextrestored instead of reloading the document.
      await new Promise<void>((resolve) => { setTimeout(resolve, 250); });
    }
  } finally { canvas.removeEventListener('webglcontextlost', allowRestore); }
}
