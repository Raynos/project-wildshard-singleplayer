import { GPU_FILES } from '../ktx2.generated';
import { pineMemoryTrim } from '../debug/options';
import { ASTC6_PHONE } from './astc6/ktx2.generated';
import { usePineGpuFiles } from './files';

/**
 * Pine Hollow's KTX2 table (the manifest's `ktx2`, read at the boot's ktx2 stage). G180 B2 (Jake, E450): with the Pine
 * memory trim on, the phone's UASTC 4×4 stand-ins give way to ASTC 6×6 ones (scripts/bake-astc6.mjs: 16/36 of the GPU
 * bytes; the ETC1S data planes stay). The overlay also replaces the engine table's entries for the sets Pine reads (the
 * Poly Haven building sets, the props), so a neighbour reading the same set in the grid samples the same 6×6 file.
 * Raw ASTC: the phone tier's GPUs (every iPhone) sample it as uploaded; the desktop table is never overlaid.
 * The boot lists (boot/files.ts) read the same table, so the boot fetches exactly the files the build loads.
 */
export function pineKtx2(): { GPU_FILES: typeof GPU_FILES } {
  const table = pineMemoryTrim() ? { phone: { ...GPU_FILES.phone, ...ASTC6_PHONE }, desktop: GPU_FILES.desktop } : GPU_FILES;
  usePineGpuFiles(table);
  return { GPU_FILES: table };
}
