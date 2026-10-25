import { CONTENT_CAPS as C, type TextureTranscodeSupport } from './contentBounds';
import { worstContentCostSteps, type worstContentCost } from './budget';
import type { Shardfile } from './shardSchema';
import type { MemoryAdmission } from './memoryAdmission';
import { parseKtx2 } from './ktx2Cost';

/** Apply the existing total-memory policy to declared or measured costs. */
export function acceptsProductCost(memory: MemoryAdmission | undefined, source: Shardfile, stage: 'declared' | 'actual', cost: ReturnType<typeof worstContentCost>): boolean {
  if (memory === undefined) return cost.playing <= C.playing && cost.loading <= C.loading;
  return memory.accept({ stage, owner: source.identity.slug, id: `${source.identity.slug}:worst-location`,
    claimedBytes: cost.accounted, accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading });
}

/** Reapply the current trusted memory policy to a previously validated exact declaration. */
export function acceptValidatedCost(source: Shardfile, cost: ReturnType<typeof worstContentCost>, memory?: MemoryAdmission): void {
  if (!acceptsProductCost(memory, source, 'declared', cost)) throw new Error(`declared worst-location total exceeds envelope: ${cost.playing}`);
}

/** Device cost projection after byte admission; source ceilings retain their full RGBA fallback. */
export function textureLibrarySource(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, support?: TextureTranscodeSupport): Shardfile {
  if (support === undefined || (!support.astc && !support.bc7)) return source;
  const files = new Map(source.files.map(file => [file.hash, file])), seen = new Set<string>(), pending = [...source.library];
  let saving = 0;
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined || seen.has(ref)) continue;
    seen.add(ref);
    const file = files.get(ref); if (file === undefined) continue;
    pending.push(...file.dependencies);
    if (file.kind !== 'ktx2') continue;
    const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing admitted texture cost bytes');
    saving += parseKtx2(bytes).gpu - parseKtx2(bytes, support).gpu;
  }
  return { ...source, budgets: { ...source.budgets, library: { ...source.budgets.library, resident: Math.max(0, source.budgets.library.resident - saving) } } };
}

/** Trusted device's exact library projection, with all existing conservative neighbour and fallback ceilings retained. */
export function* deviceLibraryCostSteps(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, support?: TextureTranscodeSupport): Generator<void, ReturnType<typeof worstContentCost>> {
  const commons = Object.values(source.requires.commonsCosts).reduce((sum, row) => sum + row.decoded + row.gpu, 0);
  return yield* worstContentCostSteps(textureLibrarySource(source, assets, support), commons);
}
