/** GR6: the riding program builder's typed surface (`ridingRows.mjs`). */
import type { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import type rules from '../data/ridingRules.json';
import type reins from '../data/reins.json';
import type forager from '../data/marmotForager.json';

type Dual = Awaited<ReturnType<typeof compileReturnProjectionV2>>;
type Rules = typeof rules;
/** The mounts / taming / riding program: the ABI-1 row and its ABI-2 projection, both with empty inline bytes. */
export interface NalatiRidingProgram { script: Dual['legacy']['script']; bytes: string; v2: Dual['candidate'] & { bytes: string } }
/** Population rows the native groups and the elite assembly read (the authored rows plus variants, flocks, forager). */
export type NalatiRidingPopulation = Rules['population'] & {
  variants: { kind: string; rows: { id: string; scale: unknown }[] }[];
  flocks: { row: Record<string, unknown> & { seed: number }; dog: boolean }[];
  forager: { row: typeof forager; seed: number };
};
/** The riding rows as the retired job's riding.generated.json held them. */
export interface NalatiRidingPrograms {
  client: Rules['client']; reins: typeof reins; population: NalatiRidingPopulation; initial: Rules['initial'];
  approach: NalatiRidingProgram; breaking: NalatiRidingProgram; riding: NalatiRidingProgram;
  compiled: { witnessBytes: number; source: string; bytes: number; hash: string };
}
/** The ecology rows the population reads. */
export interface NalatiRidingEcology {
  readonly species: { readonly kokbori: { readonly kind: string; readonly variants: readonly { readonly id: string; readonly scale: unknown }[] } };
  readonly flocks: { readonly world: readonly { readonly seed: number }[] };
  readonly wildlife: { readonly flocks: readonly { readonly dog?: boolean }[] };
}
export const NALATI_RIDING_SOURCES: readonly string[];
export function nalatiRidingPopulation(ecology: NalatiRidingEcology): NalatiRidingPopulation;
export function nalatiRidingRows(compile: typeof compileReturnProjectionV2, read: (source: string) => string, ecology: NalatiRidingEcology):
  Promise<{ programs: NalatiRidingPrograms; wasm: Uint8Array; witness: Uint8Array }>;
