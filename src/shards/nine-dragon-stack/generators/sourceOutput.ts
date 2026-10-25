import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nineOutput, type NineOutput } from './productOutput';
import { NINE_MOVERS_CONTRACT, nineMoversProgram } from './moversProgram';
import { nineEntryProof } from './entryProof';
import { nineNativeDecals } from './nativeDecals';
import { heldViewSchema } from './heldView';
import { parseBurstFields } from './sections';
import bursts from '../data/burstFields.json' with { type: 'json' };

/** One owned output operation, with fresh entry evidence and cached immutable executable/native inputs. */
export async function nineSourceOutput(ctx: ProjectGenerationContext): Promise<NineOutput> {
  const movers = await nineMoversProgram(ctx);
  const entryProof = await nineEntryProof(ctx);
  const decals = await nineNativeDecals(ctx);
  return nineOutput(movers, { entryProof, decals: { blobs: decals }, bursts: parseBurstFields(bursts),
    graphArmsSchema: heldViewSchema(), scriptRevisions: { compiler: NINE_MOVERS_CONTRACT.compilerRevision, admission: NINE_MOVERS_CONTRACT.admissionRevision } });
}
