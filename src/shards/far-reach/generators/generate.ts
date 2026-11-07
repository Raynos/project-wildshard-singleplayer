import type { ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import { phoneOverlayRows } from '@wildshard/sharddev/bootInventory';
import { skyProductRows } from './product';
import { prepareOutput } from './sourceOutput';
import { skyProductBoot } from './bootInventory';
import { skyRigAssetSources } from './rigAssetSources';
import { GPU_FILES } from '../ktx2.generated';
import { skyMapPalette } from './fixedLayouts';
import { skyViewDiscovery } from './viewData';
import { skyNavigationProgram, type SkyNavigationRows } from './navigation';
import { skyMapProgram } from './mapProgram';
import { skyMoverProgram } from './moverHeader';

/** The phone's ASTC 6×6 overlay, read off the baked files. */
function phoneAliases(ctx: Pick<ProjectGenerationContext, 'inputFiles'>): Readonly<Record<string, string>> {
  if (ctx.inputFiles === undefined) throw new Error('Sky discovery requires the inputFiles capability');
  return phoneOverlayRows(GPU_FILES.phone, ctx.inputFiles(['/assets/far-reach/astc6/']), 'far-reach');
}

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
  return { shard: skyProductRows(navigation.rows, await skyMoverProgram(ctx)), output, map: await skyMapProgram(ctx), discovery: { ...skyProductBoot(skyRigAssetSources(output.namedFiles, { phone: { ...GPU_FILES.phone, ...phoneAliases(ctx) }, desktop: GPU_FILES.desktop })), ...skyViewDiscovery(), mapPalette: skyMapPalette(), navigation: navigation.rows } };
}
