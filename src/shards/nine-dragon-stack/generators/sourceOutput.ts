import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nineOutput, type NineOutput, type NineOutputInputs } from './productOutput';
import { NINE_MOVERS_CONTRACT, nineMoversProgram } from './moversProgram';
import { nineEntryProof } from './entryProof';
import { nineNativeDecals } from './nativeDecals';
import { heldViewSchema } from './heldView';
import { parseBurstFields } from './sections';
import bursts from '../data/burstFields.json' with { type: 'json' };
import { nineProduct } from './product';

async function constructionFor(ctx: ProjectGenerationContext): Promise<NineOutputInputs['construction']> {
  const source = await nineProduct(ctx, { pages: NINE_MOVERS_CONTRACT.pages });
  return { seed: source.identity.seed, looks: Object.keys(source.look.materials) };
}

/** One owned output operation, with fresh entry evidence and cached immutable executable/native inputs. */
export async function nineSourceOutput(ctx: ProjectGenerationContext, construction?: NineOutputInputs['construction']): Promise<NineOutput> {
  const world = construction ?? await constructionFor(ctx);
  const movers = await nineMoversProgram(ctx);
  const entryProof = await nineEntryProof(ctx);
  const decals = await nineNativeDecals(ctx);
  return nineOutput(movers, { construction: world, entryProof, decals: { blobs: decals }, bursts: parseBurstFields(bursts),
    graphArmsSchema: heldViewSchema(), scriptRevisions: { compiler: NINE_MOVERS_CONTRACT.compilerRevision, admission: NINE_MOVERS_CONTRACT.admissionRevision } });
}
