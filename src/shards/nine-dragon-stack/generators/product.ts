import courseProgram from '../behaviour/practice.generated.json' with { type: 'json' };
import { nineCastsProgram } from './castsProgram';
import { nineSignsProgram } from './signsProgram';
import { nineDeclarationsProgram } from './declarationsProgram';
import { nineWorldProgram } from './worldProgram';
import { nineWorldScenes } from './worldScenes';
import { nineProductFrom, type NineProductInputs } from './productDefinition';
import { nineNavigation } from './navigationProgram';
import { nineHeldProfile } from './heldProfile';
import { createHeldGraphFiles } from './heldGraphFiles';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nineNativeSignAtlas } from './nativeSignAtlas';
import nativeAtlasInputs from '../data/nativeSignAtlas.json' with { type: 'json' };

const DEFAULT_MOVERS = { pages: 1 };

/** Remaining world/course readers accompany this invocation's source-owned navigation. */
export async function readNineProductInputs(ctx: ProjectGenerationContext): Promise<NineProductInputs> {
  const native = await nineNativeSignAtlas(ctx, nativeAtlasInputs);
  const profile = await nineHeldProfile(ctx), ownedWorld = await nineWorldProgram(ctx, native.atlas), casts = await nineCastsProgram(ctx), signs = await nineSignsProgram(ctx);
  const declarations = await nineDeclarationsProgram(ctx, ownedWorld);
  return { casts, signs, courseProgram, navigation: await nineNavigation(ctx), world: ownedWorld.metadata, ownedWorld, scenes: nineWorldScenes(ownedWorld.layout, casts.material, signs, declarations.world), held: { profile, files: createHeldGraphFiles(profile) } };
}

/** Build the declaration from this invocation's admitted source results. */
export async function nineProduct(ctx: ProjectGenerationContext, movers: { readonly pages: number } = DEFAULT_MOVERS): Promise<ReturnType<typeof nineProductFrom>> {
  return nineProductFrom(await readNineProductInputs(ctx), movers);
}
