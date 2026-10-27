/** GR6: the Storm Titan and pasture program builder's typed surface (`stormTitanRows.mjs`). */
import type { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';

type Dual = Awaited<ReturnType<typeof compileReturnProjectionV2>>;
/** One compiled programme: the ABI-1 row and its ABI-2 projection, both with empty inline bytes. */
export interface NalatiTitanProgram { script: Dual['legacy']['script']; bytes: string; v2: Dual['candidate'] & { bytes: string } }
/** The titan rows as the retired job's titan.generated.json held them (`wind` is pasture.generated.json). */
export interface NalatiTitanPrograms {
  attack: NalatiTitanProgram; fire: NalatiTitanProgram; wind: NalatiTitanProgram; rules: NalatiTitanProgram;
  compiled: { witnessBytes: number; attack: { source: string; bytes: number; hash: string }; pasture: { source: string; bytes: number; hash: string } };
}
/** One selected module's bytes and its ABI-1 witness. */
export interface NalatiTitanModule { wasm: Uint8Array; witness: Uint8Array }
export const NALATI_TITAN_MODULE: string, NALATI_PASTURE_MODULE: string;
export function nalatiTitanRows(compile: typeof compileReturnProjectionV2, authored: ReadonlyMap<string, string>):
  Promise<{ programs: NalatiTitanPrograms; titan: NalatiTitanModule; pasture: NalatiTitanModule }>;
