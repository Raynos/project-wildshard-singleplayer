/** Observe native shader calls without querying the driver or parsing GLSL during a measured task.
 * Text comes only from successful shaderSource calls; missing provenance stays explicit. Inject this
 * self-contained function before boot, and take the parsed snapshot after measurement has stopped. */
export function observeShaderCompilations(prototype, clock = () => performance.now()) {
  const sourceOriginal = prototype.shaderSource, compileOriginal = prototype.compileShader;
  const sources = new WeakMap(), calls = [];
  let depth = 0;
  function source(shader, text) {
    const result = sourceOriginal.call(this, shader, text);
    if (typeof shader === 'object' && shader !== null && typeof text === 'string') sources.set(shader, text);
    return result;
  }
  function compile(shader) {
    const start = clock(), phase = depth > 0 ? 'explicit-warm-up' : 'draw-or-driver';
    try { return compileOriginal.call(this, shader); }
    finally { calls.push({ start, end: clock(), phase, source: sources.get(shader) ?? null }); }
  }
  prototype.shaderSource = source; prototype.compileShader = compile;
  return {
    duringWarmUp(work) { depth++; try { return work(); } finally { depth--; } },
    snapshot() {
      return calls.map(call => {
        const text = call.source;
        return { start: call.start, end: call.end, phase: call.phase, sourceKnown: text !== null,
        name: text?.match(/#define SHADER_NAME (\S+)/u)?.[1] ?? null,
        lightCounts: [...(text?.matchAll(/uniform\s+\w+\s+(sunLights|directionalLights|pointLights|spotLights|rectAreaLights|hemisphereLights|directionalLightShadows|pointLightShadows|spotLightShadows)\s*\[\s*(\d+)\s*\]/gu) ?? [])]
          .map(match => [match[1], Number(match[2])]),
        flags: [...(text?.matchAll(/^#define (USE_FOG|FOG_EXP2|USE_INSTANCING|USE_INSTANCING_COLOR|USE_BATCHING|USE_BATCHING_COLOR|USE_SKINNING|USE_COLOR|USE_COLOR_ALPHA|ENVMAP_TYPE_CUBE_UV|USE_SHADOWMAP|SHADOWMAP_TYPE_PCF|SHADOWMAP_TYPE_VSM|FLAT_SHADED)(?:\s|$)/gmu) ?? [])].map(match => match[1]),
        };
      });
    },
    dispose() {
      // Another observer can own a newer wrapper. Never overwrite it while retiring this one.
      if (prototype.shaderSource === source) prototype.shaderSource = sourceOriginal;
      if (prototype.compileShader === compile) prototype.compileShader = compileOriginal;
    },
  };
}
