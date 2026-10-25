import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nineOutput, type NineOutput, type NineOutputInputs } from './productOutput';
import { NINE_MOVERS_CONTRACT, nineMoversProgram } from './moversProgram';
import { nineEntryProof } from './entryProof';
import { nineNativeDecals } from './nativeDecals';
import { heldViewSchema } from './heldView';
import { parseBurstFields } from './sections';
import bursts from '../data/burstFields.json' with { type: 'json' };
import { readNineProductInputs } from './product';
import { nineProductFrom } from './productDefinition';

type OutputSources = Pick<NineOutputInputs, 'construction' | 'held' | 'ownedWorld' | 'scenes' | 'casts'>;
async function sourcesFor(ctx: ProjectGenerationContext): Promise<OutputSources> {
  const inputs = await readNineProductInputs(ctx), source = nineProductFrom(inputs, { pages: NINE_MOVERS_CONTRACT.pages });
  return { casts: inputs.casts, held: inputs.held, ownedWorld: inputs.ownedWorld, scenes: inputs.scenes, construction: { seed: source.identity.seed, looks: Object.keys(source.look.materials) } };
}

/** One owned output operation, with fresh entry evidence and cached immutable executable/native inputs. */
export async function nineSourceOutput(ctx: ProjectGenerationContext, supplied?: OutputSources): Promise<NineOutput> {
  const sources = supplied ?? await sourcesFor(ctx);
  const movers = await nineMoversProgram(ctx);
  const entryProof = await nineEntryProof(ctx);
  const decals = await nineNativeDecals(ctx);
  return nineOutput(movers, { ...sources, entryProof, decals: { blobs: decals }, bursts: parseBurstFields(bursts),
    graphArmsSchema: heldViewSchema(), scriptRevisions: { compiler: NINE_MOVERS_CONTRACT.compilerRevision, admission: NINE_MOVERS_CONTRACT.admissionRevision } });
}
