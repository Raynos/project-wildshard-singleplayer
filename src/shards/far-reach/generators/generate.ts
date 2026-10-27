import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { skyProductRows } from './product';
import { prepareOutput } from './sourceOutput';
import { skyProductBoot } from './bootInventory';
import { skyRigAssetSources } from './rigAssetSources';
import { GPU_FILES } from '../ktx2.generated';
import { skyMapPalette } from './fixedLayouts';
import { skyViewDiscovery } from './viewData';
import { skyNavigationProgram, type SkyNavigationRows } from './navigation';
import { skyMapProgram } from './mapProgram';

/** Publish declaration, native output and discovery from one source invocation. */
export async function generate(ctx: ProjectGenerationContext): Promise<{
  readonly shard: ReturnType<typeof skyProductRows>;
  readonly output: Awaited<ReturnType<typeof prepareOutput>>;
  readonly map: Awaited<ReturnType<typeof skyMapProgram>>;
  readonly discovery: ReturnType<typeof skyProductBoot> & ReturnType<typeof skyViewDiscovery> & { readonly mapPalette: ReturnType<typeof skyMapPalette>; readonly navigation: SkyNavigationRows };
}> {
  const navigation = await skyNavigationProgram(ctx), output = await prepareOutput(ctx);
  const geometry = output.namedFiles.find(file => file.name === 'world/geometry/prepared-models.glb');
  if (geometry === undefined) throw new Error('Missing owned prepared geometry for boot');
  return { shard: skyProductRows(navigation.rows), output, map: await skyMapProgram(ctx), discovery: { ...skyProductBoot(skyRigAssetSources(output.namedFiles, GPU_FILES)), ...skyViewDiscovery(), mapPalette: skyMapPalette(), navigation: navigation.rows } };
}
