import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { NALATI_RIDING_SOURCES, nalatiRidingRows, type NalatiRidingEcology, type NalatiRidingPrograms } from './ridingRows.mjs';

/** The product names the riding module and its witness ship under. */
export const NALATI_RIDING_MODULE = 'behaviour/nalati.mounts.wasm', NALATI_RIDING_WITNESS = 'behaviour/riding-witness.bin';
/** The riding program's rows and its compiled module (an ABI-2 project lane depending on its ABI-1 module) and witness bytes. */
export interface NalatiRiding { readonly programs: NalatiRidingPrograms; readonly wasm: Uint8Array; readonly witness: Uint8Array }
/** The riding module's original critical ABI-2 project admission, from its compiled rows. */
export function ridingModuleOptions(programs: NalatiRidingPrograms, revisions: { readonly compiler: 1; readonly admission: 1 }): {
  dependencies: string[]; critical: true; script: { abi: 2; lane: 'project'; pages: number; ioBytes: number; compilerRevision: 1; admissionRevision: 1 };
} {
  const projection = programs.approach.v2.artifact;
  return { dependencies: [programs.approach.script.module.slice('blobs/wasm/'.length, -'.wasm'.length)], critical: true,
    script: { abi: 2, lane: 'project', pages: projection.pages, ioBytes: projection.ioBytes, compilerRevision: revisions.compiler, admissionRevision: revisions.admission } };
}

const decode = new TextDecoder('utf-8', { fatal: true }), encode = new TextEncoder();
const ECOLOGY = 'data/ecology.generated.json';
/** GR6 (G783): the mounts / taming / riding program compiled in the build from its declared authored sources and the
 *  shard's ecology rows (read as cached input bytes), in place of the retired `nalati-riding` job. */
export async function nalatiRidingProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'compileReturnProjection'>): Promise<NalatiRiding> {
  const compile = ctx.compileReturnProjection;
  if (compile === undefined) throw new Error('Nalati riding needs return-projection compilation');
  const files = await ctx.cached({ id: 'riding-program', inputs: [...NALATI_RIDING_SOURCES, ECOLOGY] }, async inputs => {
    const text = (name: string): string => { const bytes = inputs.get(name); if (bytes === undefined) throw new Error(`Missing Nalati riding input ${name}`); return decode.decode(bytes); };
    const ecology: unknown = JSON.parse(text(ECOLOGY));
    if (typeof ecology !== 'object' || ecology === null || !('species' in ecology) || !('flocks' in ecology) || !('wildlife' in ecology)) throw new Error('Invalid Nalati ecology rows');
    // the ecology rows are the shard's own admitted generated table; the builder reads only the fields NalatiRidingEcology names
    const built = await nalatiRidingRows(compile, text, ecology as NalatiRidingEcology);
    return new Map([['riding.json', encode.encode(JSON.stringify(built.programs))], ['riding.wasm', built.wasm], ['riding-witness.bin', built.witness]]);
  });
  const document = files.get('riding.json'), wasm = files.get('riding.wasm'), witness = files.get('riding-witness.bin');
  if (files.size !== 3 || document === undefined || wasm === undefined || witness === undefined) throw new Error('Nalati riding cache inventory differs');
  return { programs: nalatiRidingWire(decode.decode(document)), wasm, witness };
}

/** Read riding rows back from their JSON (this module's cache envelope, or a test's compiled copy). */
export function nalatiRidingWire(text: string): NalatiRidingPrograms {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || !('approach' in value) || !('compiled' in value)) throw new Error('Invalid cached Nalati riding rows');
  // the envelope is written from the builder's NalatiRidingPrograms and read back unchanged
  return value as NalatiRidingPrograms;
}
