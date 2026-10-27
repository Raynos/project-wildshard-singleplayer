import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiChargeRows, type NalatiCharge } from './chargeRows';
import { NALATI_DECISION_SOURCES } from './decisionSourceInventory';

/** The charge rows and the compiled module bytes. */
export interface NalatiChargeProgram { readonly rows: NalatiCharge; readonly wasm: Uint8Array }

const decode = new TextDecoder('utf-8', { fatal: true }), encode = new TextEncoder();
/** GR6 (G783): the Qara Batyr charge compiled in the build from the complete authored behaviour inventory, cached under
 *  the author program, in place of the retired `nalati-elite-charge` job's captain outputs. */
export async function nalatiChargeProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'compileDecisionRows'>): Promise<NalatiChargeProgram> {
  const compile = ctx.compileDecisionRows;
  if (compile === undefined) throw new Error('Nalati charge needs decision-row compilation');
  const files = await ctx.cached({ id: 'charge-program', inputs: NALATI_DECISION_SOURCES }, async read => {
    const authored = new Map(NALATI_DECISION_SOURCES.map((name): [string, string] => {
      const bytes = read.get(name); if (bytes === undefined) throw new Error(`Missing Nalati charge source ${name}`);
      return [name, decode.decode(bytes)];
    }));
    const built = await nalatiChargeRows(compile, authored);
    return new Map([['charge.json', encode.encode(JSON.stringify(built.rows))], ['charge.wasm', built.wasm]]);
  });
  const document = files.get('charge.json'), wasm = files.get('charge.wasm');
  if (files.size !== 2 || document === undefined || wasm === undefined) throw new Error('Nalati charge cache inventory differs');
  return { rows: nalatiChargeWire(decode.decode(document)), wasm };
}

/** Read the charge rows back from their JSON (this module's cache envelope, or a test's compiled copy). */
export function nalatiChargeWire(text: string): NalatiCharge {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || !('script' in value) || !('strikes' in value) || !('compiled' in value)) throw new Error('Invalid cached Nalati charge rows');
  // the envelope is written from the builder's NalatiCharge and read back unchanged
  return value as NalatiCharge;
}
