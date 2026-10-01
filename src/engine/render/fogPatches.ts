/**
 * The fog-patch registry (01 §13.2, 10 §X5). The fog chunks (`fog_pars_*`, `fog_*`) are whole-chunk writes on three's
 * ShaderChunk, so the order they land in is the look. Every writer installs through `installFogPatch` with its slot:
 * the engine's fog 100 (Atmosphere), a level's stylize 200, a level's own fog 300 (`LookStrategy.fog.order`). A patch
 * installs once per page (by id). A new id at or below the last installed slot in its stage throws before changing the registry
 * or shader chunks: otherwise the result would be the call order, not the slot's (E357 L11 / B72).
 */
export const FOG_SLOT = { engine: 100, stylize: 200, level: 300 } as const;

export interface FogPatchEntry { id: string; order: number }
const installed: FogPatchEntry[] = [];
const lastByStage = new Map<string | undefined, FogPatchEntry>();

/** Run once per id; enforce slot order in the engine stage (omitted) or the supplied level stage. */
export function installFogPatch(id: string, order: number, install: () => void, stage?: string): boolean {
  if (installed.some((p) => p.id === id)) return false;
  const last = lastByStage.get(stage);
  if (last !== undefined && order <= last.order) throw new Error(`[fog] patch ${id} (slot ${order}) installs after ${last.id} (slot ${last.order})`);
  install();
  const entry = { id, order };
  installed.push(entry);
  lastByStage.set(stage, entry);
  return true;
}

/** the installed fog patches, in install order (the WebGPU port inventory, tests) */
export function fogPatches(): readonly FogPatchEntry[] { return installed; }
