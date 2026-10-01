/**
 * The fog-patch registry (01 §13.2, 10 §X5). The fog chunks (`fog_pars_*`, `fog_*`) are whole-chunk writes on three's
 * ShaderChunk, so the order they land in is the look. Every writer installs through `installFogPatch` with its slot:
 * the engine's fog 100 (Atmosphere), a level's stylize 200, a level's own fog 300 (`LookStrategy.fog.order`). A patch
 * installs once per page (by id). A slot at or below the last installed one is reported: the result would then be the
 * call order, not the slot's (the patch still installs, so a page that switches levels keeps today's behaviour).
 */
export const FOG_SLOT = { engine: 100, stylize: 200, level: 300 } as const;

export interface FogPatchEntry { id: string; order: number }
const installed: FogPatchEntry[] = [];

/** run `install` once for `id` in slot `order`; false when that id is already installed */
export function installFogPatch(id: string, order: number, install: () => void): boolean {
  if (installed.some((p) => p.id === id)) return false;
  const last = installed.at(-1);
  if (last !== undefined && order <= last.order) console.warn(`[fog] patch ${id} (slot ${order}) installs after ${last.id} (slot ${last.order})`);
  installed.push({ id, order });
  install();
  return true;
}

/** the installed fog patches, in install order (the WebGPU port inventory, tests) */
export function fogPatches(): readonly FogPatchEntry[] { return installed; }
