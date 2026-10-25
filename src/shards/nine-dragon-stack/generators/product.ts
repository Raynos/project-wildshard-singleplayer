import courseProgram from '../behaviour/practice.generated.json' with { type: 'json' };
import world from '../data/world.generated.json' with { type: 'json' };
import { nineProductFrom, type NineProductInputs } from './productDefinition';
import { nineNavigation } from './navigationProgram';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

const DEFAULT_MOVERS = { pages: 1 };

/** Remaining world/course readers accompany this invocation's source-owned navigation. */
export async function readNineProductInputs(ctx: ProjectGenerationContext): Promise<NineProductInputs> {
  return { courseProgram, navigation: await nineNavigation(ctx), world };
}

/** Build the declaration from this invocation's admitted source results. */
export async function nineProduct(ctx: ProjectGenerationContext, movers: { readonly pages: number } = DEFAULT_MOVERS): Promise<ReturnType<typeof nineProductFrom>> {
  return nineProductFrom(await readNineProductInputs(ctx), movers);
}
