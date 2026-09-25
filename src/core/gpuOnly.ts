/**
 * Content rendered into a texture once at load (a runtime bake: the pine impostor atlas, the branch-card fallback) lives
 * only on the GPU, so an in-place WebGL restore brings it back empty. A module that makes such a bake marks it here, and
 * src/core/GpuRecovery.ts reloads the page on a context loss instead of restoring in place (E54).
 */
import { listSlot, shardSlot } from './shardState';
import { currentScope } from './shardScope';

const labels = new Set<string>();
/** marks made outside any shard (at module load: KTX2 mode drops every texture's mips once uploaded) — the page's, never reset */
const pageLabels = new Set<string>();

export function markGpuOnly(label: string): void { (currentScope() === null ? pageLabels : labels).add(label); }

/**
 * A runtime bake that can paint itself again (Nalati's painted range, look v2's shadow / contact bake) registers its
 * re-bake here instead of marking itself GPU-only: an in-place restore calls it after re-linking the programs, before
 * the first frame (NALATI-MERGE F7), so the restore stays in place instead of reloading the page.
 */
const rebakes: (() => void)[] = [];
export function onGpuRestored(rebake: () => void): void { rebakes.push(rebake); }
/** GpuRecovery.ts: re-paint every registered bake (after an in-place restore) */
export function rebakeGpuContent(): void { for (const f of rebakes) f(); }

/** what was marked (empty: an in-place restore brings the whole scene back) */
export function gpuOnlyContent(): readonly string[] { return [...pageLabels, ...labels]; }

// E155 (src/core/shardState.ts): each resident shard's own bakes
shardSlot('gpuOnly.labels', () => [...labels], (v) => { labels.clear(); for (const l of v) labels.add(l); }, () => []);
listSlot('gpuOnly.rebakes', rebakes);
