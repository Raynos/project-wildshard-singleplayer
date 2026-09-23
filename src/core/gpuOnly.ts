/**
 * Content rendered into a texture once at load (a runtime bake: the pine impostor atlas, the branch-card fallback) lives
 * only on the GPU, so an in-place WebGL restore brings it back empty. A module that makes such a bake marks it here, and
 * src/core/GpuRecovery.ts reloads the page on a context loss instead of restoring in place (E54).
 */
const labels = new Set<string>();

export function markGpuOnly(label: string): void { labels.add(label); }

/** what was marked (empty: an in-place restore brings the whole scene back) */
export function gpuOnlyContent(): readonly string[] { return [...labels]; }
