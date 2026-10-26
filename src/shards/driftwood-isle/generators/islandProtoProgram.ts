import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { islandProtoGlb } from './islandProtos';

/** Complete native inputs; generated dressing metadata and hash-named source files are never inputs. */
export const ISLAND_PROTO_INPUTS: readonly string[] = ['/assets/models/driftwood-blender/island.glb', '/assets/models/driftwood-blender/island.json'];
const file = 'world/island/protos.glb';

/** Construct the same compact prototype bank without publishing a source-tree handoff. */
export async function driftwoodIslandProtoSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== ISLAND_PROTO_INPUTS.length || ISLAND_PROTO_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Driftwood prototype input inventory differs');
  }
  const geometry = inputs.get(ISLAND_PROTO_INPUTS[0] ?? ''), metadata = inputs.get(ISLAND_PROTO_INPUTS[1] ?? '');
  if (geometry === undefined || metadata === undefined) throw new Error('Missing native Driftwood prototypes');
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  if (typeof input !== 'object' || input === null || !('protos' in input) || !Array.isArray(input.protos)
    || !('lod' in input) || typeof input.lod !== 'object' || input.lod === null || Array.isArray(input.lod)) throw new Error('Invalid native prototype metadata');
  const protos = input.protos.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('name' in row) || typeof row.name !== 'string') throw new Error('Invalid native prototype name');
    return { name: row.name };
  });
  const lod: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.lod)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid native prototype LOD');
    lod[key] = value;
  }
  return new Map([[file, await islandProtoGlb(geometry, { protos, lod })]]);
}

/** Cache owned bytes outside src and admit the complete original GLB through the normal named-file path. */
export async function driftwoodIslandProtoOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'island-prototypes', native: true, inputs: ISLAND_PROTO_INPUTS }, driftwoodIslandProtoSource);
  const bytes = files.get(file);
  if (files.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Driftwood prototype cache inventory differs');
  return emitNamedBlobs([nameBlob(file, 'glb', bytes)]);
}
